"""
Suite de Pruebas Unitarias para Cinemática y Filtrado
Valida ángulos articulares, apertura de pinza y orientación con landmarks sintéticos conocidos.
"""

import unittest
import math
from percepcion.kinematics import (
    calculate_finger_flexion,
    calculate_pinch_aperture,
    calculate_palm_orientation,
    extract_full_hand_kinematics,
    _angle_between_vectors,
)
from percepcion.filtering import OneEuroFilter, EMAFilter
from mapeo.servo_mapper import ServoMapper


def create_straight_finger_landmarks():
    """Genera 21 landmarks sintéticos donde todos los dedos están perfectamente extendidos hacia arriba (+Y o -Y)."""
    landmarks = []
    # Muñeca en (0.5, 0.8, 0.0)
    landmarks.append({"x": 0.5, "y": 0.8, "z": 0.0})

    # Pulgar extendido en diagonal
    landmarks.append({"x": 0.45, "y": 0.70, "z": 0.0})
    landmarks.append({"x": 0.40, "y": 0.60, "z": 0.0})
    landmarks.append({"x": 0.35, "y": 0.52, "z": 0.0})
    landmarks.append({"x": 0.30, "y": 0.45, "z": 0.0})

    # Dedo Índice perfectamente recto hacia arriba
    landmarks.append({"x": 0.45, "y": 0.60, "z": 0.0})
    landmarks.append({"x": 0.45, "y": 0.48, "z": 0.0})
    landmarks.append({"x": 0.45, "y": 0.36, "z": 0.0})
    landmarks.append({"x": 0.45, "y": 0.24, "z": 0.0})

    # Dedo Medio perfectamente recto
    landmarks.append({"x": 0.50, "y": 0.58, "z": 0.0})
    landmarks.append({"x": 0.50, "y": 0.45, "z": 0.0})
    landmarks.append({"x": 0.50, "y": 0.32, "z": 0.0})
    landmarks.append({"x": 0.50, "y": 0.20, "z": 0.0})

    # Dedo Anular recto
    landmarks.append({"x": 0.55, "y": 0.60, "z": 0.0})
    landmarks.append({"x": 0.55, "y": 0.48, "z": 0.0})
    landmarks.append({"x": 0.55, "y": 0.36, "z": 0.0})
    landmarks.append({"x": 0.55, "y": 0.25, "z": 0.0})

    # Dedo Meñique recto
    landmarks.append({"x": 0.60, "y": 0.63, "z": 0.0})
    landmarks.append({"x": 0.60, "y": 0.53, "z": 0.0})
    landmarks.append({"x": 0.60, "y": 0.43, "z": 0.0})
    landmarks.append({"x": 0.60, "y": 0.34, "z": 0.0})

    return landmarks


def create_clenched_fist_landmarks():
    """Genera 21 landmarks sintéticos donde los dedos están doblados 90-120° formando un puño."""
    landmarks = create_straight_finger_landmarks()
    # Doblar índice hacia la palma
    landmarks[6] = {"x": 0.45, "y": 0.60, "z": 0.05} # PIP doblado
    landmarks[7] = {"x": 0.45, "y": 0.65, "z": 0.08} # DIP replegado
    landmarks[8] = {"x": 0.45, "y": 0.68, "z": 0.04} # TIP contra la palma
    return landmarks


class TestKinematics(unittest.TestCase):

    def test_vector_angle_parallel(self):
        v1 = (1.0, 0.0, 0.0)
        v2 = (2.0, 0.0, 0.0)
        angle = _angle_between_vectors(v1, v2)
        self.assertAlmostEqual(angle, 0.0, places=2)

    def test_vector_angle_orthogonal(self):
        v1 = (1.0, 0.0, 0.0)
        v2 = (0.0, 1.0, 0.0)
        angle = _angle_between_vectors(v1, v2)
        self.assertAlmostEqual(angle, 90.0, places=2)

    def test_straight_finger_flexion_near_zero(self):
        lms = create_straight_finger_landmarks()
        res = calculate_finger_flexion(lms, "index")
        # En dedo recto, la flexión debe ser prácticamente 0°
        self.assertLess(res["total"], 5.0)

    def test_bent_finger_flexion_increases(self):
        lms = create_clenched_fist_landmarks()
        res = calculate_finger_flexion(lms, "index")
        # Al doblar hacia la palma, la flexión debe superar 80°
        self.assertGreater(res["total"], 80.0)

    def test_filter_one_euro_smoothness(self):
        f = OneEuroFilter(min_cutoff=1.0, beta=0.01)
        # Señal con ruido oscilante
        signal = [45.0, 47.0, 44.0, 48.0, 43.0, 46.0]
        smoothed = []
        for i, val in enumerate(signal):
            smoothed.append(f.filter(val, timestamp=i * 0.025))
        # La variación en la salida debe ser menor que la entrada
        delta_in = max(signal) - min(signal)
        delta_out = max(smoothed[2:]) - min(smoothed[2:])
        self.assertLess(delta_out, delta_in)

    def test_servo_mapper_clamping(self):
        mapper = ServoMapper()
        # Valores fuera de rango normalizado deben ser limitados a 0.0 - 1.0
        output = mapper.map_hand_to_servos("left", {"index": 1.5, "thumb": -0.2})
        self.assertLessEqual(output["index"], 1.0)
        self.assertGreaterEqual(output["thumb"], 0.0)


if __name__ == "__main__":
    unittest.main()
