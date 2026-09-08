"""
Orquestador Principal del Sistema de Teleoperación Bimanual
Loop principal: Captura de Video -> Percepción MediaPipe -> Cinemática -> Filtrado -> Mapeo Servo -> Envío WebSocket / Serial.
"""

import asyncio
import cv2
import time
import argparse
from typing import Dict, Any

from percepcion.hand_tracker import HandTracker
from percepcion.kinematics import extract_full_hand_kinematics
from percepcion.filtering import JointFilterBank
from mapeo.calibration import UserCalibration
from mapeo.servo_mapper import ServoMapper
from comunicacion.protocol import create_teleop_packet
from comunicacion.transport import TeleopWebSocketClient


def draw_hud(frame, fps, latency_ms, packets_sent, hand_states):
    """Dibuja información visual en pantalla (ángulos, FPS, telemetría)."""
    h, w, _ = frame.shape
    # Barra superior semitransparente
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 48), (20, 20, 25), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    # Métricas
    cv2.putText(
        frame,
        f"FPS: {fps:.1f} | Latencia: {latency_ms:.1f}ms | Tx: {packets_sent} pkts",
        (15, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (0, 255, 180),
        2,
    )

    # Panel lateral por mano detectada
    y_offset = 80
    for side in ["left", "right"]:
        state = hand_states.get(side)
        color = (255, 150, 50) if side == "left" else (50, 180, 255)
        title = f"MANO {side.upper()}: " + ("DETECTADA" if state else "SIN DETECCION")
        cv2.putText(frame, title, (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
        y_offset += 24

        if state:
            servos = state.get("servos", {})
            text = " | ".join([f"{k[:2].upper()}:{int(v*180)}d" for k, v in servos.items()])
            cv2.putText(frame, text, (30, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 220, 220), 1)
            y_offset += 24
        y_offset += 10


async def main_loop(args):
    print("==================================================================")
    print("  SISTEMA DE TELEOPERACIÓN BIMANUAL CON MANOS ROBÓTICAS")
    print("  MediaPipe Tasks Vision + ESP32 PCA9685 Servo Mapper")
    print("==================================================================")

    # 1. Inicialización de componentes
    tracker = HandTracker(num_hands=2, mirror_mode=True)
    calibration = UserCalibration()
    servo_mapper = ServoMapper()

    filters = {
        "left": JointFilterBank(use_one_euro=True),
        "right": JointFilterBank(use_one_euro=True),
    }

    # 2. Inicialización de cliente WebSocket
    ws_client = TeleopWebSocketClient(uri=args.ws_uri, target_hz=args.target_hz)
    asyncio.create_task(ws_client.connect())

    # 3. Captura de Cámara
    cap = cv2.VideoCapture(args.cam_id)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    if not cap.isOpened():
        print(f"[Error] No se pudo abrir la cámara {args.cam_id}.")
        return

    print(f"[OK] Cámara iniciada. Frecuencia objetivo: {args.target_hz}Hz.")
    print("Presiona 'c' para calibrar postura abierta/cerrada, 'q' para salir.\n")

    prev_time = time.time()
    seq_counter = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.01)
                continue

            loop_start = time.time()
            fps = 1.0 / max(1e-4, loop_start - prev_time)
            prev_time = loop_start

            # Detección bimanual con MediaPipe
            detected_hands = tracker.process_frame(frame)
            hand_summaries = {}

            for side in ["left", "right"]:
                landmarks = detected_hands.get(side)
                seq_counter += 1

                if landmarks:
                    # Cinemática completa
                    kin = extract_full_hand_kinematics(landmarks)
                    flexions = kin["flexion_totals"]

                    # Filtrado temporal (1 Euro filter)
                    filtered_flexions = {}
                    for finger, val in flexions.items():
                        filtered_flexions[finger] = filters[side].filter_value(
                            finger, val, loop_start
                        )

                    # Normalización con límites de usuario
                    normalized_servos = {}
                    for finger, val in filtered_flexions.items():
                        normalized_servos[finger] = calibration.normalize_joint(finger, val)

                    # Muñeca (Roll)
                    wrist_roll = kin["palm_orientation"]["roll"]
                    filt_roll = filters[side].filter_value("wrist", wrist_roll, loop_start)
                    normalized_servos["wrist"] = calibration.normalize_wrist(filt_roll)

                    # Mapeo a hardware con protección de oclusión
                    safe_servos = servo_mapper.map_hand_to_servos(side, normalized_servos)

                    # Construir paquete según especificación Sección 6
                    packet = create_teleop_packet(
                        hand_side=side,
                        servos=safe_servos,
                        sequence_id=seq_counter,
                        aperture=kin["pinch_aperture"],
                    )

                    # Transmitir por WebSocket
                    await ws_client.send_teleop_packet(packet)

                    hand_summaries[side] = {
                        "servos": safe_servos,
                        "pinch": kin["pinch_aperture"],
                    }
                else:
                    # Oclusión: mantener o decaer suavemente
                    safe_servos = servo_mapper.map_hand_to_servos(side, None)
                    hand_summaries[side] = None

            # Renderizado visual
            if not args.headless:
                draw_hud(frame, fps, ws_client.last_latency_ms, ws_client.packets_sent, hand_summaries)
                cv2.imshow("Teleoperacion Bimanual MediaPipe", frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break
                elif key == ord("c"):
                    print("[Calibracion] Abriendo asistente interactivo de calibración...")

            # Yield al loop de asyncio para flush de red
            await asyncio.sleep(0.001)

    finally:
        cap.release()
        cv2.destroyAllWindows()
        tracker.close()
        ws_client.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Teleoperacion Bimanual Manos Roboticas")
    parser.add_argument("--cam_id", type=int, default=0, help="ID de la cámara (default: 0)")
    parser.add_argument("--ws_uri", type=str, default="ws://localhost:3000/ws/telemetry", help="URI del servidor WebSocket")
    parser.add_argument("--target_hz", type=float, default=40.0, help="Frecuencia de envío de comandos (30-50Hz)")
    parser.add_argument("--headless", action="store_true", help="Ejecutar sin ventana OpenCV")
    args = parser.parse_args()

    asyncio.run(main_loop(args))
