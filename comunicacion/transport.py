"""
Capa de Transporte de Red para Teleoperación
Implementa cliente WebSocket asíncrono con auto-reconexión, rate limiting (30-50Hz)
y monitoreo de latencia round-trip.
"""

import asyncio
import json
import time
from typing import Optional, Callable, Dict, Any

try:
    import websockets
except ImportError:
    websockets = None


class TeleopWebSocketClient:
    def __init__(
        self,
        uri: str = "ws://localhost:3000/ws/telemetry",
        target_hz: float = 40.0,
        on_status_change: Optional[Callable[[str], None]] = None,
    ):
        self.uri = uri
        self.target_hz = target_hz
        self.min_interval = 1.0 / max(1.0, target_hz)
        self.on_status_change = on_status_change

        self.ws = None
        self.is_connected = False
        self.running = False
        self.last_sent_ts = 0.0
        self.packets_sent = 0
        self.packets_dropped = 0
        self.last_latency_ms = 0.0

    async def connect(self):
        """Intenta conectar al servidor WebSocket con reintentos automáticos."""
        if websockets is None:
            print("[Transporte] websockets no está instalado. Instala con `pip install websockets`.")
            return

        self.running = True
        while self.running:
            try:
                if self.on_status_change:
                    self.on_status_change(f"Conectando a {self.uri}...")
                print(f"[Transporte] Conectando a {self.uri}...")

                async with websockets.connect(self.uri, ping_interval=5, ping_timeout=3) as ws:
                    self.ws = ws
                    self.is_connected = True
                    if self.on_status_change:
                        self.on_status_change(f"Conectado a {self.uri}")
                    print("[Transporte] Conexión WebSocket establecida con éxito.")

                    # Escuchar mensajes entrantes (ACKs, telemetría o comandos del ESP32)
                    async for message in ws:
                        self._handle_incoming(message)

            except Exception as e:
                self.is_connected = False
                self.ws = None
                if self.on_status_change:
                    self.on_status_change(f"Desconectado ({e}). Reintentando en 2s...")
                print(f"[Transporte] Error de conexión: {e}. Reintentando en 2s...")
                await asyncio.sleep(2.0)

    def _handle_incoming(self, message: str):
        try:
            data = json.loads(message)
            if "ack_ts" in data:
                # Medición de latencia glass-to-network
                rtt = (time.time() - data["ack_ts"]) * 1000.0
                self.last_latency_ms = rtt
        except Exception:
            pass

    async def send_teleop_packet(self, packet: Dict[str, Any]) -> bool:
        """
        Envía un paquete respetando la tasa de envío (30-50Hz).
        Si se intenta enviar más rápido que min_interval, descarta para evitar buffer bloat.
        """
        now = time.time()
        if now - self.last_sent_ts < self.min_interval:
            self.packets_dropped += 1
            return False

        if not self.is_connected or self.ws is None:
            self.packets_dropped += 1
            return False

        try:
            raw = json.dumps(packet, separators=(",", ":"))
            await self.ws.send(raw)
            self.last_sent_ts = now
            self.packets_sent += 1
            return True
        except Exception as e:
            print(f"[Transporte] Error enviando paquete: {e}")
            self.is_connected = False
            return False

    def disconnect(self):
        self.running = False
        self.is_connected = False
