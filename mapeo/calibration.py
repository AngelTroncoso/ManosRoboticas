"""
Módulo de Calibración de Rango Articular por Usuario
Captura estados de referencia:
1) Mano abierta / extendida (0% de flexión)
2) Puño cerrado (100% de flexión)
3) Pinza fina cerrada (opcional)
Genera límites min/max personalizados y persiste la configuración en JSON.
"""

import json
import os
import time
from typing import Dict, Any, Optional

DEFAULT_CALIBRATION_FILE = "user_calibration.json"

DEFAULT_RANGES = {
    "thumb": {"min_angle": 15.0, "max_angle": 130.0},
    "index": {"min_angle": 10.0, "max_angle": 150.0},
    "middle": {"min_angle": 10.0, "max_angle": 155.0},
    "ring": {"min_angle": 12.0, "max_angle": 150.0},
    "pinky": {"min_angle": 15.0, "max_angle": 145.0},
    "wrist": {"min_angle": -60.0, "max_angle": 60.0},
    "pinch": {"min_dist": 0.05, "max_dist": 1.20},
}


class UserCalibration:
    def __init__(self, filepath: str = DEFAULT_CALIBRATION_FILE):
        self.filepath = filepath
        self.ranges: Dict[str, Dict[str, float]] = self.load_calibration()
        self.calibrated = os.path.exists(filepath)

    def load_calibration(self) -> Dict[str, Dict[str, float]]:
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r") as f:
                    data = json.load(f)
                    print(f"[Calibracion] Cargado perfil desde {self.filepath}")
                    return data
            except Exception as e:
                print(f"[Calibracion] Error leyendo archivo de calibración: {e}")
        return dict(DEFAULT_RANGES)

    def save_calibration(self):
        try:
            with open(self.filepath, "w") as f:
                json.dump(self.ranges, f, indent=2)
            self.calibrated = True
            print(f"[Calibracion] Perfil guardado exitosamente en {self.filepath}")
        except Exception as e:
            print(f"[Calibracion] Error guardando calibración: {e}")

    def capture_open_hand_pose(self, measured_angles: Dict[str, float]):
        """Registra la postura abierta como valor mínimo de flexión (0%)."""
        for finger in ["thumb", "index", "middle", "ring", "pinky"]:
            if finger in measured_angles:
                self.ranges[finger]["min_angle"] = float(measured_angles[finger])
        print("[Calibracion] Postura de Mano Abierta (0%) registrada.")

    def capture_closed_fist_pose(self, measured_angles: Dict[str, float]):
        """Registra la postura de puño como valor máximo de flexión (100%)."""
        for finger in ["thumb", "index", "middle", "ring", "pinky"]:
            if finger in measured_angles:
                val = float(measured_angles[finger])
                # Asegurar que max sea superior a min
                if val <= self.ranges[finger]["min_angle"] + 15.0:
                    val = self.ranges[finger]["min_angle"] + 90.0
                self.ranges[finger]["max_angle"] = val
        print("[Calibracion] Postura de Puño Cerrado (100%) registrada.")

    def normalize_joint(self, finger: str, angle: float) -> float:
        """
        Normaliza el ángulo medido de 0.0 (abierto) a 1.0 (cerrado)
        según los límites calibrados del usuario.
        """
        cfg = self.ranges.get(finger, DEFAULT_RANGES.get(finger, {"min_angle": 10.0, "max_angle": 140.0}))
        min_a = cfg["min_angle"]
        max_a = cfg["max_angle"]

        if max_a <= min_a:
            return 0.0

        norm = (angle - min_a) / (max_a - min_a)
        return max(0.0, min(1.0, norm))

    def normalize_wrist(self, roll_deg: float) -> float:
        """Normaliza la rotación de muñeca (-60 a +60°) a 0.0 - 1.0 (centro = 0.5)."""
        cfg = self.ranges.get("wrist", {"min_angle": -60.0, "max_angle": 60.0})
        min_a = cfg["min_angle"]
        max_a = cfg["max_angle"]
        norm = (roll_deg - min_a) / (max_a - min_a)
        return max(0.0, min(1.0, norm))
