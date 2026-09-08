"""
Módulo de Cinemática para Manos Robóticas
Calcula flexión por dedo, abducción, apertura de pinza y orientación de palma
a partir de los 21 landmarks 3D de MediaPipe.
"""

import math
from typing import Dict, List, Tuple, Any

# Índices canónicos de MediaPipe Hands
WRIST = 0
THUMB_CMC = 1
THUMB_MCP = 2
THUMB_IP = 3
THUMB_TIP = 4

INDEX_MCP = 5
INDEX_PIP = 6
INDEX_DIP = 7
INDEX_TIP = 8

MIDDLE_MCP = 9
MIDDLE_PIP = 10
MIDDLE_DIP = 11
MIDDLE_TIP = 12

RING_MCP = 13
RING_PIP = 14
RING_DIP = 15
RING_TIP = 16

PINKY_MCP = 17
PINKY_PIP = 18
PINKY_DIP = 19
PINKY_TIP = 20

FINGERS = {
    "thumb": [THUMB_CMC, THUMB_MCP, THUMB_IP, THUMB_TIP],
    "index": [INDEX_MCP, INDEX_PIP, INDEX_DIP, INDEX_TIP],
    "middle": [MIDDLE_MCP, MIDDLE_PIP, MIDDLE_DIP, MIDDLE_TIP],
    "ring": [RING_MCP, RING_PIP, RING_DIP, RING_TIP],
    "pinky": [PINKY_MCP, PINKY_PIP, PINKY_DIP, PINKY_TIP],
}


def _vector(p1: Dict[str, float], p2: Dict[str, float]) -> Tuple[float, float, float]:
    """Retorna vector p2 - p1 en 3D."""
    return (p2["x"] - p1["x"], p2["y"] - p1["y"], p2.get("z", 0.0) - p1.get("z", 0.0))


def _dot(v1: Tuple[float, float, float], v2: Tuple[float, float, float]) -> float:
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]


def _magnitude(v: Tuple[float, float, float]) -> float:
    return math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)


def _angle_between_vectors(v1: Tuple[float, float, float], v2: Tuple[float, float, float]) -> float:
    """Calcula ángulo entre dos vectores en grados (0 a 180°)."""
    mag1 = _magnitude(v1)
    mag2 = _magnitude(v2)
    if mag1 < 1e-9 or mag2 < 1e-9:
        return 0.0
    cos_theta = _dot(v1, v2) / (mag1 * mag2)
    cos_theta = max(-1.0, min(1.0, cos_theta))
    rad = math.acos(cos_theta)
    return math.degrees(rad)


def _cross(v1: Tuple[float, float, float], v2: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return (
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0],
    )


def calculate_finger_flexion(landmarks: List[Dict[str, float]], finger_name: str) -> Dict[str, float]:
    """
    Calcula la flexión del dedo sumando la curvatura de sus articulaciones.
    Devuelve ángulos individuales y ángulo acumulado normalizado (0° = extendido, ~180° = doblado completo).
    """
    indices = FINGERS[finger_name]
    p0 = landmarks[indices[0]]
    p1 = landmarks[indices[1]]
    p2 = landmarks[indices[2]]
    p3 = landmarks[indices[3]]

    # Vectores de segmentos de falanges
    v_prox = _vector(p0, p1)
    v_med = _vector(p1, p2)
    v_dist = _vector(p2, p3)

    # Ángulos de flexión articular: desviación angular entre segmentos consecutivos
    angle_mcp = _angle_between_vectors(v_prox, v_med)
    angle_pip = _angle_between_vectors(v_med, v_dist)

    # Para pulgar la anatomía tiene menor rango MCP pero mayor oposición
    if finger_name == "thumb":
        total_flex = max(0.0, angle_mcp) * 0.5 + max(0.0, angle_pip) * 0.9
    else:
        # En dedos estándar, PIP y DIP están fuertemente acoplados mecánicamente
        total_flex = max(0.0, angle_mcp) * 0.45 + max(0.0, angle_pip) * 0.75

    # Clamping a rango representativo de 0 a 180 grados
    total_flex = max(0.0, min(180.0, total_flex))

    return {
        "mcp": angle_mcp,
        "pip": angle_pip,
        "total": total_flex,
    }


def calculate_pinch_aperture(landmarks: List[Dict[str, float]]) -> float:
    """
    Calcula apertura de pinza normalizada:
    Distancia entre punta de pulgar (4) y punta de índice (8),
    normalizada por la escala de la mano (distancia muñeca [0] a MCP medio [9]).
    0.0 = pinza cerrada (contacto punta-punta), 1.0 = apertura máxima (~distancia de mano).
    """
    thumb_tip = landmarks[THUMB_TIP]
    index_tip = landmarks[INDEX_TIP]
    wrist = landmarks[WRIST]
    middle_mcp = landmarks[MIDDLE_MCP]

    # Distancia euclidiana entre puntas
    pinch_vec = _vector(thumb_tip, index_tip)
    pinch_dist = _magnitude(pinch_vec)

    # Escala métrica invariable a distancia a cámara: longitud de la palma
    hand_scale_vec = _vector(wrist, middle_mcp)
    hand_scale = _magnitude(hand_scale_vec)

    if hand_scale < 1e-4:
        return 1.0

    normalized_dist = pinch_dist / hand_scale
    # En una mano humana normal, distancia en contacto es ~0.1-0.2, abierta es ~1.2-1.5
    aperture = (normalized_dist - 0.15) / 1.05
    return max(0.0, min(1.0, aperture))


def calculate_abductions(landmarks: List[Dict[str, float]]) -> Dict[str, float]:
    """
    Calcula abducción (separación lateral entre dedos adyacentes en la base MCP).
    """
    wrist = landmarks[WRIST]
    v_thumb = _vector(wrist, landmarks[THUMB_MCP])
    v_index = _vector(wrist, landmarks[INDEX_MCP])
    v_middle = _vector(wrist, landmarks[MIDDLE_MCP])
    v_ring = _vector(wrist, landmarks[RING_MCP])
    v_pinky = _vector(wrist, landmarks[PINKY_MCP])

    return {
        "thumb_index": _angle_between_vectors(v_thumb, v_index),
        "index_middle": _angle_between_vectors(v_index, v_middle),
        "middle_ring": _angle_between_vectors(v_middle, v_ring),
        "ring_pinky": _angle_between_vectors(v_ring, v_pinky),
    }


def calculate_palm_orientation(landmarks: List[Dict[str, float]]) -> Dict[str, float]:
    """
    Calcula la orientación de la palma:
    Vector normal al plano formado por Muñeca (0), MCP Índice (5) y MCP Meñique (17).
    Estima Roll, Pitch y Yaw relativos a la cámara.
    """
    wrist = landmarks[WRIST]
    index_mcp = landmarks[INDEX_MCP]
    pinky_mcp = landmarks[PINKY_MCP]

    v1 = _vector(wrist, index_mcp)
    v2 = _vector(wrist, pinky_mcp)

    # Vector normal a la palma
    norm = _cross(v1, v2)
    mag = _magnitude(norm)
    nx, ny, nz = norm[0] / mag, norm[1] / mag, norm[2] / mag

    # Roll (rotación en el plano frontal XY)
    # Pitch (inclinación adelante/atrás)
    # Yaw (giro izquierda/derecha)
    roll = math.degrees(math.atan2(ny, nx))
    pitch = math.degrees(math.asin(max(-1.0, min(1.0, -nz))))
    yaw = math.degrees(math.atan2(v1[0], v1[1]))

    return {
        "roll": roll,
        "pitch": pitch,
        "yaw": yaw,
        "normal": {"x": nx, "y": ny, "z": nz},
    }


def extract_full_hand_kinematics(landmarks: List[Dict[str, float]]) -> Dict[str, Any]:
    """
    Extrae el estado articular completo de la mano en un solo diccionario.
    """
    flexions = {}
    flexion_totals = {}
    for finger in ["thumb", "index", "middle", "ring", "pinky"]:
        res = calculate_finger_flexion(landmarks, finger)
        flexions[finger] = res
        flexion_totals[finger] = res["total"]

    pinch = calculate_pinch_aperture(landmarks)
    abductions = calculate_abductions(landmarks)
    palm = calculate_palm_orientation(landmarks)

    return {
        "flexions": flexions,
        "flexion_totals": flexion_totals,
        "pinch_aperture": pinch,
        "abductions": abductions,
        "palm_orientation": palm,
    }
