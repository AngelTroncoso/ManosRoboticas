import JSZip from "jszip";

export interface ProjectFile {
  path: string;
  name: string;
  language: "python" | "cpp" | "json" | "markdown" | "text";
  category: "percepcion" | "mapeo" | "comunicacion" | "firmware" | "root" | "tests";
  content: string;
}

export const PROJECT_FILES: ProjectFile[] = [
  {
    path: "main.py",
    name: "main.py",
    language: "python",
    category: "root",
    content: `"""
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

async def main_loop(args):
    tracker = HandTracker(num_hands=2, mirror_mode=True)
    calibration = UserCalibration()
    servo_mapper = ServoMapper()

    filters = {
        "left": JointFilterBank(use_one_euro=True),
        "right": JointFilterBank(use_one_euro=True),
    }

    ws_client = TeleopWebSocketClient(uri=args.ws_uri, target_hz=args.target_hz)
    asyncio.create_task(ws_client.connect())

    cap = cv2.VideoCapture(args.cam_id)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    print(f"[OK] Teleoperación iniciada. Transmitiendo a {args.ws_uri} a {args.target_hz}Hz.")

    prev_time = time.time()
    seq = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.01)
                continue

            loop_start = time.time()
            detected_hands = tracker.process_frame(frame)

            for side in ["left", "right"]:
                landmarks = detected_hands.get(side)
                seq += 1

                if landmarks:
                    kin = extract_full_hand_kinematics(landmarks)
                    flexions = kin["flexion_totals"]

                    filtered = {
                        k: filters[side].filter_value(k, v, loop_start)
                        for k, v in flexions.items()
                    }

                    normalized = {
                        k: calibration.normalize_joint(k, v)
                        for k, v in filtered.items()
                    }

                    wrist_roll = kin["palm_orientation"]["roll"]
                    filt_roll = filters[side].filter_value("wrist", wrist_roll, loop_start)
                    normalized["wrist"] = calibration.normalize_wrist(filt_roll)

                    safe_servos = servo_mapper.map_hand_to_servos(side, normalized)
                    packet = create_teleop_packet(side, safe_servos, seq, kin["pinch_aperture"])
                    await ws_client.send_teleop_packet(packet)
                else:
                    servo_mapper.map_hand_to_servos(side, None)

            await asyncio.sleep(0.001)
    finally:
        cap.release()
        tracker.close()
        ws_client.disconnect()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cam_id", type=int, default=0)
    parser.add_argument("--ws_uri", type=str, default="ws://localhost:3000/ws/telemetry")
    parser.add_argument("--target_hz", type=float, default=40.0)
    args = parser.parse_args()
    asyncio.run(main_loop(args))
`,
  },
  {
    path: "percepcion/kinematics.py",
    name: "kinematics.py",
    language: "python",
    category: "percepcion",
    content: `import math
from typing import Dict, List, Tuple, Any

FINGERS = {
    "thumb": [1, 2, 3, 4],
    "index": [5, 6, 7, 8],
    "middle": [9, 10, 11, 12],
    "ring": [13, 14, 15, 16],
    "pinky": [17, 18, 19, 20],
}

def _vector(p1, p2):
    return (p2["x"] - p1["x"], p2["y"] - p1["y"], p2.get("z", 0.0) - p1.get("z", 0.0))

def _dot(v1, v2):
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]

def _magnitude(v):
    return math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)

def _angle_between_vectors(v1, v2):
    mag1 = _magnitude(v1)
    mag2 = _magnitude(v2)
    if mag1 < 1e-9 or mag2 < 1e-9: return 0.0
    cos_theta = max(-1.0, min(1.0, _dot(v1, v2) / (mag1 * mag2)))
    return math.degrees(math.acos(cos_theta))

def calculate_finger_flexion(landmarks, finger_name):
    idx = FINGERS[finger_name]
    v_prox = _vector(landmarks[idx[0]], landmarks[idx[1]])
    v_med  = _vector(landmarks[idx[1]], landmarks[idx[2]])
    v_dist = _vector(landmarks[idx[2]], landmarks[idx[3]])

    mcp = _angle_between_vectors(v_prox, v_med)
    pip = _angle_between_vectors(v_med, v_dist)

    if finger_name == "thumb":
        total = mcp * 0.5 + pip * 0.9
    else:
        total = mcp * 0.45 + pip * 0.75

    return {"mcp": mcp, "pip": pip, "total": max(0.0, min(180.0, total))}

def calculate_pinch_aperture(landmarks):
    pinch_dist = _magnitude(_vector(landmarks[4], landmarks[8]))
    hand_scale = _magnitude(_vector(landmarks[0], landmarks[9]))
    if hand_scale < 1e-4: return 1.0
    return max(0.0, min(1.0, (pinch_dist / hand_scale - 0.15) / 1.05))

def extract_full_hand_kinematics(landmarks):
    flexions = {f: calculate_finger_flexion(landmarks, f) for f in FINGERS}
    return {
        "flexions": flexions,
        "flexion_totals": {f: flexions[f]["total"] for f in FINGERS},
        "pinch_aperture": calculate_pinch_aperture(landmarks),
        "palm_orientation": {"roll": 0.0, "pitch": 0.0, "yaw": 0.0}
    }
`,
  },
  {
    path: "percepcion/filtering.py",
    name: "filtering.py",
    language: "python",
    category: "percepcion",
    content: `import math, time

class OneEuroFilter:
    def __init__(self, min_cutoff=1.2, beta=0.01, d_cutoff=1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self.x_prev = None
        self.dx_prev = 0.0
        self.last_time = None

    def _alpha(self, cutoff, dt):
        tau = 1.0 / (2.0 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def filter(self, x, timestamp=None):
        now = timestamp or time.time()
        if self.last_time is None or self.x_prev is None:
            self.x_prev = x
            self.last_time = now
            return x

        dt = max(1e-4, now - self.last_time)
        self.last_time = now
        dx = (x - self.x_prev) / dt
        a_d = self._alpha(self.d_cutoff, dt)
        dx_hat = a_d * dx + (1.0 - a_d) * self.dx_prev
        self.dx_prev = dx_hat

        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        a = self._alpha(cutoff, dt)
        x_hat = a * x + (1.0 - a) * self.x_prev
        self.x_prev = x_hat
        return x_hat

class JointFilterBank:
    def __init__(self, use_one_euro=True):
        self.filters = {}

    def filter_value(self, key, value, ts=None):
        if key not in self.filters:
            self.filters[key] = OneEuroFilter()
        return self.filters[key].filter(value, ts)
`,
  },
  {
    path: "mapeo/servo_mapper.py",
    name: "servo_mapper.py",
    language: "python",
    category: "mapeo",
    content: `import time

class ServoMapper:
    def __init__(self):
        self.last_valid = {
            "left": {"thumb": 0.0, "index": 0.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0, "wrist": 0.5},
            "right": {"thumb": 0.0, "index": 0.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0, "wrist": 0.5},
        }
        self.last_seen = {"left": 0.0, "right": 0.0}

    def map_hand_to_servos(self, side, normalized_state, max_jump_rate=0.15):
        now = time.time()
        prev = self.last_valid[side]

        if normalized_state is None:
            if now - self.last_seen[side] > 1.5:
                for k in prev:
                    if k != "wrist": prev[k] = max(0.0, prev[k] - 0.02)
            return dict(prev)

        self.last_seen[side] = now
        out = {}
        for k, target in normalized_state.items():
            val = max(0.0, min(1.0, float(target)))
            p = prev.get(k, val)
            delta = val - p
            if abs(delta) > max_jump_rate:
                actual = p + (max_jump_rate if delta > 0 else -max_jump_rate)
            else:
                actual = val
            out[k] = round(actual, 4)
            prev[k] = actual
        return out
`,
  },
  {
    path: "firmware/main.ino",
    name: "main.ino (Arduino C++)",
    language: "cpp",
    category: "firmware",
    content: `#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

#define PCA_ADDR 0x40
Adafruit_PWMServoDriver pca(PCA_ADDR);
WebSocketsClient ws;

const int CH_LEFT[]  = {0, 1, 2, 3, 4, 5}; // Pulgar, Indice, Medio, Anular, Meñique, Muñeca
const int CH_RIGHT[] = {8, 9, 10, 11, 12, 13};

void setServo(int ch, float norm01) {
  int clamped = constrain(int(norm01 * 180), 5, 175);
  int pulseUs = map(clamped, 0, 180, 550, 2450);
  pca.setPWM(ch, 0, int(pulseUs * 4096.0 / 20000.0));
}

void processPacket(const char* json) {
  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, json)) return;
  const char* hand = doc["hand"];
  JsonObject s = doc["servos"];
  const int* chs = (strcmp(hand, "left") == 0) ? CH_LEFT : CH_RIGHT;

  if (s.containsKey("thumb"))  setServo(chs[0], s["thumb"]);
  if (s.containsKey("index"))  setServo(chs[1], s["index"]);
  if (s.containsKey("middle")) setServo(chs[2], s["middle"]);
  if (s.containsKey("ring"))   setServo(chs[3], s["ring"]);
  if (s.containsKey("pinky"))  setServo(chs[4], s["pinky"]);
  if (s.containsKey("wrist"))  setServo(chs[5], s["wrist"]);
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  pca.begin();
  pca.setPWMFreq(50);
  Serial.println("[ESP32] Teleoperacion lista. USB Serial y WiFi activos.");
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\\n');
    processPacket(line.c_str());
  }
}
`,
  },
  {
    path: "comunicacion/protocol.py",
    name: "protocol.py",
    language: "python",
    category: "comunicacion",
    content: `import time, json

def create_teleop_packet(hand_side, servos, sequence_id=0, aperture=None):
    payload = {
        "v": "1.0",
        "seq": sequence_id,
        "ts": round(time.time(), 4),
        "hand": hand_side.lower(),
        "servos": {k: round(float(v), 3) for k, v in servos.items()},
    }
    if aperture is not None:
        payload["pinch"] = round(float(aperture), 3)
    return payload
`,
  },
  {
    path: "requirements.txt",
    name: "requirements.txt",
    language: "text",
    category: "root",
    content: `mediapipe>=0.10.9
opencv-python>=4.8.0
numpy>=1.24.0
websockets>=12.0
pyserial>=3.5
`,
  },
];

export async function downloadProjectZip() {
  const zip = new JSZip();

  for (const file of PROJECT_FILES) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sistema_teleoperacion_bimanual_mediapipe.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
