"""
Definición del Protocolo y Esquema JSON de Teleoperación
Versión de especificación v1.0.
"""

import json
import time
from typing import Dict, Any, Optional

PROTOCOL_VERSION = "1.0.0"


def create_teleop_packet(
    hand_side: str,
    servos: Dict[str, float],
    sequence_id: int = 0,
    aperture: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Construye el paquete canónico JSON según la sección 6 del diseño:
    {
      "v": "1.0",
      "seq": 1042,
      "ts": 1699999999.123,
      "hand": "left",
      "servos": {"thumb": 0.42, "index": 0.87, "middle": 0.91, "ring": 0.60, "pinky": 0.35, "wrist": 0.50}
    }
    """
    payload = {
        "v": PROTOCOL_VERSION,
        "seq": sequence_id,
        "ts": round(time.time(), 4),
        "hand": hand_side.lower(),
        "servos": {k: round(float(v), 3) for k, v in servos.items()},
    }
    if aperture is not None:
        payload["pinch"] = round(float(aperture), 3)
    return payload


def serialize_packet(packet: Dict[str, Any]) -> str:
    """Serialización JSON compacta (sin espacios innecesarios para minimizar payload en red)."""
    return json.dumps(packet, separators=(",", ":"))


def validate_packet(data: Any) -> Tuple[bool, Optional[str]]:
    """Valida integridad del paquete recibido."""
    if not isinstance(data, dict):
        return False, "Payload no es un diccionario JSON"
    if "ts" not in data or "hand" not in data or "servos" not in data:
        return False, "Faltan campos obligatorios: ts, hand, servos"
    if data["hand"] not in ["left", "right"]:
        return False, f"Hand invalido: {data['hand']}"
    if not isinstance(data["servos"], dict):
        return False, "Campo servos debe ser un objeto"
    return True, None
