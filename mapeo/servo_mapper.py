"""
Módulo de Mapeo a Servomotores Físicos (PCA9685 / ESP32)
Traduce el estado cinemático normalizado (0.0 a 1.0) a comandos angulares (0-180°)
o microsegundos de pulso PWM (500-2500 µs), aplicando clamping de seguridad y
suavizado ante oclusiones.
"""

import time
from typing import Dict, Any, Optional

# Configuración de límites mecánicos por servomotor (para no quemar engranajes ni forzar topes)
DEFAULT_HARDWARE_LIMITS = {
    "thumb": {"min_deg": 5, "max_deg": 170, "inverted": False, "channel_left": 0, "channel_right": 8},
    "index": {"min_deg": 5, "max_deg": 175, "inverted": False, "channel_left": 1, "channel_right": 9},
    "middle": {"min_deg": 5, "max_deg": 175, "inverted": False, "channel_left": 2, "channel_right": 10},
    "ring": {"min_deg": 5, "max_deg": 175, "inverted": False, "channel_left": 3, "channel_right": 11},
    "pinky": {"min_deg": 5, "max_deg": 170, "inverted": False, "channel_left": 4, "channel_right": 12},
    "wrist": {"min_deg": 15, "max_deg": 165, "inverted": False, "channel_left": 5, "channel_right": 13},
}


class ServoMapper:
    def __init__(self, hardware_limits: Optional[Dict[str, Any]] = None):
        self.limits = hardware_limits or DEFAULT_HARDWARE_LIMITS
        # Guarda el último estado válido por mano para manejar oclusiones suaves
        self.last_valid_command: Dict[str, Dict[str, float]] = {
            "left": {k: 0.0 for k in self.limits.keys()},
            "right": {k: 0.0 for k in self.limits.keys()},
        }
        self.last_seen_ts: Dict[str, float] = {"left": 0.0, "right": 0.0}
        # Centrar muñeca por defecto
        self.last_valid_command["left"]["wrist"] = 0.5
        self.last_valid_command["right"]["wrist"] = 0.5

    def map_hand_to_servos(
        self,
        hand_side: str,
        normalized_state: Optional[Dict[str, float]],
        max_occlusion_jump_rate: float = 0.15,
    ) -> Dict[str, float]:
        """
        Convierte el estado normalizado (0.0 a 1.0) en valores de servo seguros (0.0 a 1.0 y grados 0-180).
        Si la mano está ocluida (None), mantiene la última posición válida con descenso progresivo.
        Si la mano reaparece tras oclusión, interpola gradualmente hacia el nuevo valor para evitar saltos bruscos.
        """
        now = time.time()
        hand_key = hand_side.lower()
        prev_state = self.last_valid_command[hand_key]

        if normalized_state is None:
            # Mano ocluida: si ha pasado más de 1.5s, relajar dedos suavemente hacia reposo (0.0)
            time_lost = now - self.last_seen_ts[hand_key]
            if time_lost > 1.5:
                for k in prev_state:
                    if k != "wrist":
                        prev_state[k] = max(0.0, prev_state[k] - 0.02)
            return dict(prev_state)

        # Mano detectada
        self.last_seen_ts[hand_key] = now
        safe_output = {}

        for joint, target_val in normalized_state.items():
            if joint not in self.limits:
                continue

            target_clamped = max(0.0, min(1.0, float(target_val)))
            prev_val = prev_state.get(joint, target_clamped)

            # Slew-rate limiter (evita azote si hubo discontinuidad en MediaPipe)
            delta = target_clamped - prev_val
            if abs(delta) > max_occlusion_jump_rate:
                actual_val = prev_val + (max_occlusion_jump_rate if delta > 0 else -max_occlusion_jump_rate)
            else:
                actual_val = target_clamped

            safe_output[joint] = round(actual_val, 4)
            prev_state[joint] = actual_val

        return safe_output

    def convert_to_degrees(self, hand_side: str, normalized_servos: Dict[str, float]) -> Dict[str, int]:
        """
        Convierte valores normalizados 0.0-1.0 a grados enteros de servo (0-180°)
        respetando límites de hardware y sentido de rotación (inversión).
        """
        degrees = {}
        for joint, norm_val in normalized_servos.items():
            cfg = self.limits.get(joint, {"min_deg": 0, "max_deg": 180, "inverted": False})
            min_deg = cfg["min_deg"]
            max_deg = cfg["max_deg"]
            inverted = cfg.get("inverted", False)

            val = 1.0 - norm_val if inverted else norm_val
            deg = int(min_deg + val * (max_deg - min_deg))
            degrees[joint] = max(min_deg, min(max_deg, deg))
        return degrees

    def convert_to_pca9685_channels(
        self, hand_side: str, degrees: Dict[str, int]
    ) -> Dict[int, int]:
        """
        Devuelve mapeo directo {canal_pca: grados} para el controlador I2C PCA9685 de 16 canales.
        """
        channel_map = {}
        channel_key = "channel_left" if hand_side.lower() == "left" else "channel_right"

        for joint, deg in degrees.items():
            if joint in self.limits:
                ch = self.limits[joint][channel_key]
                channel_map[ch] = deg
        return channel_map
