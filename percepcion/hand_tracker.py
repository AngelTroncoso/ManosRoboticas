"""
Wrapper de MediaPipe HandLandmarker (Tasks Vision API)
Captura cámara RGB estándar y extrae landmarks 3D con discriminación Left/Right consistente.
"""

import time
import os
import urllib.request
from typing import List, Dict, Any, Optional, Tuple

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
MODEL_PATH = "hand_landmarker.task"


def ensure_model_downloaded(path: str = MODEL_PATH) -> str:
    """Descarga el bundle de modelo HandLandmarker si no existe localmente."""
    if not os.path.exists(path):
        print(f"[HandTracker] Descargando modelo MediaPipe HandLandmarker desde {MODEL_URL}...")
        urllib.request.urlretrieve(MODEL_URL, path)
        print(f"[HandTracker] Modelo guardado en {path}")
    return path


class HandTracker:
    """
    Gestiona el detector de manos MediaPipe Tasks API con soporte bimanual (num_hands=2).
    """

    def __init__(
        self,
        model_path: str = MODEL_PATH,
        num_hands: int = 2,
        min_hand_detection_confidence: float = 0.65,
        min_hand_presence_confidence: float = 0.60,
        min_tracking_confidence: float = 0.65,
        mirror_mode: bool = True,
    ):
        self.model_path = ensure_model_downloaded(model_path)
        self.num_hands = num_hands
        self.mirror_mode = mirror_mode

        base_options = python.BaseOptions(model_asset_path=self.model_path)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            num_hands=self.num_hands,
            min_hand_detection_confidence=min_hand_detection_confidence,
            min_hand_presence_confidence=min_hand_presence_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self.detector = vision.HandLandmarker.create_from_options(options)
        self.last_ts_ms = 0

    def process_frame(
        self, frame_bgr: Any
    ) -> Dict[str, Optional[List[Dict[str, float]]]]:
        """
        Procesa un frame OpenCV BGR y devuelve landmarks organizados por mano:
        {"left": [...21 landmarks...], "right": [...21 landmarks...]}
        """
        # Efecto espejo para coincidir con la vista del usuario frente a pantalla
        if self.mirror_mode:
            frame_bgr = cv2.flip(frame_bgr, 1)

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

        # Timestamps estrictamente crecientes para RunningMode.VIDEO
        current_ts_ms = int(time.time() * 1000)
        if current_ts_ms <= self.last_ts_ms:
            current_ts_ms = self.last_ts_ms + 1
        self.last_ts_ms = current_ts_ms

        result = self.detector.detect_for_video(mp_image, current_ts_ms)

        detected_hands: Dict[str, Optional[List[Dict[str, float]]]] = {
            "left": None,
            "right": None,
        }

        if not result.hand_landmarks:
            return detected_hands

        # Emparejar lateralidad
        for idx, (landmarks, handedness_list) in enumerate(
            zip(result.hand_landmarks, result.handedness)
        ):
            if not handedness_list:
                continue

            raw_label = handedness_list[0].category_name.lower()  # 'left' o 'right'

            # Nota crítica de MediaPipe: si la imagen fue espejada, la lateralidad aparente
            # coincide con el propio punto de vista del usuario.
            # Sin espejo: 'left' visto por la cámara es la mano derecha del usuario.
            # Con mirror_mode = True: el label de MediaPipe ya es directo.
            label = raw_label

            landmarks_list = [
                {
                    "x": float(lm.x),
                    "y": float(lm.y),
                    "z": float(lm.z),
                    "visibility": getattr(lm, "visibility", 1.0),
                }
                for lm in landmarks
            ]

            detected_hands[label] = landmarks_list

        return detected_hands

    def close(self):
        if self.detector:
            self.detector.close()
