/*
 * SISTEMA DE TELEOPERACIÓN BIMANUAL CON MANOS ROBÓTICAS (MediaPipe)
 * Firmware para ESP32 + Driver I2C PCA9685 (16 canales)
 * 
 * Características clave:
 * 1. Control de 12 servomotores (6 DOF por mano: 5 dedos + 1 rotación de muñeca).
 * 2. Comunicación dual: WebSocket en WiFi (red local <10ms) Y Serial USB (115200 baud).
 * 3. Descarte de paquetes con timestamp antiguo (evita movimientos desfasados fuera de orden).
 * 4. Watchdog de seguridad en hardware/software: si pierde conexión por >1.5s, relaja los dedos.
 * 5. Clamping mecánico por software para proteger engranajes de servos SG90 / MG996R.
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

// --- CONFIGURACIÓN DE RED WIFI (Modificar según tu red) ---
const char* WIFI_SSID = "TU_RED_WIFI";
const char* WIFI_PASS = "TU_PASSWORD";
const char* WS_SERVER_HOST = "192.168.1.100"; // IP del PC que corre Python o el Hub
const int   WS_SERVER_PORT = 3000;
const char* WS_SERVER_PATH = "/ws/telemetry";

// --- CONFIGURACIÓN PCA9685 ---
#define PCA9685_I2C_ADDR 0x40
#define SERVO_FREQ 50 // Frecuencia estándar para servos analógicos (50Hz = 20ms ciclo)

// Microsegundos de ancho de pulso calibrados para servos estándar (SG90, MG90S, MG996R)
#define USMIN 550   // Pulso para 0 grados
#define USMAX 2450  // Pulso para 180 grados

Adafruit_PWMServoDriver pca = Adafruit_PWMServoDriver(PCA9685_I2C_ADDR);
WebSocketsClient webSocket;

// --- MAPEO DE CANALES PCA9685 ---
// Mano Izquierda: canales 0-5
const int CH_LEFT_THUMB  = 0;
const int CH_LEFT_INDEX  = 1;
const int CH_LEFT_MIDDLE = 2;
const int CH_LEFT_RING   = 3;
const int CH_LEFT_PINKY  = 4;
const int CH_LEFT_WRIST  = 5;

// Mano Derecha: canales 8-13
const int CH_RIGHT_THUMB  = 8;
const int CH_RIGHT_INDEX  = 9;
const int CH_RIGHT_MIDDLE = 10;
const int CH_RIGHT_RING   = 11;
const int CH_RIGHT_PINKY  = 12;
const int CH_RIGHT_WRIST  = 13;

// --- LÍMITES MECÁNICOS Y SENTIDO DE GIRO (0 a 180 grados) ---
struct ServoLimit {
  int minDeg;
  int maxDeg;
  bool inverted;
};

ServoLimit limitsLeft[6] = {
  {5, 170, false}, // Pulgar
  {5, 175, false}, // Indice
  {5, 175, false}, // Medio
  {5, 175, false}, // Anular
  {5, 170, false}, // Meñique
  {15, 165, false} // Muñeca
};

ServoLimit limitsRight[6] = {
  {5, 170, false},
  {5, 175, false},
  {5, 175, false},
  {5, 175, false},
  {5, 170, false},
  {15, 165, false}
};

// --- CONTROL DE TIEMPO Y WATCHDOG ---
double lastProcessedTsLeft = 0.0;
double lastProcessedTsRight = 0.0;
unsigned long lastPacketReceivedMs = 0;
const unsigned long WATCHDOG_TIMEOUT_MS = 1500; // 1.5s sin datos activa reposo seguro
bool watchdogTriggered = false;

// Convierte grados 0-180 en pulsos PWM para PCA9685
void setServoAngle(int channel, int angleDegrees, ServoLimit limit) {
  // Clamping de seguridad estricto
  int clamped = constrain(angleDegrees, limit.minDeg, limit.maxDeg);
  if (limit.inverted) {
    clamped = 180 - clamped;
  }
  // Mapear ángulo a microsegundos
  int pulseUs = map(clamped, 0, 180, USMIN, USMAX);
  // PCA9685 tiene resolución de 12 bits (4096 cuentas en 20000 µs)
  int pulseCount = int(float(pulseUs) * 4096.0 / 20000.0);
  pca.setPWM(channel, 0, pulseCount);
}

// Envía todos los servos a postura de descanso segura (mano abierta, muñeca centrada)
void enterSafeRestPose() {
  Serial.println("[SEGURIDAD] Watchdog activado: relajando servomotores a postura de reposo.");
  // Mano Izquierda
  setServoAngle(CH_LEFT_THUMB,  0, limitsLeft[0]);
  setServoAngle(CH_LEFT_INDEX,  0, limitsLeft[1]);
  setServoAngle(CH_LEFT_MIDDLE, 0, limitsLeft[2]);
  setServoAngle(CH_LEFT_RING,   0, limitsLeft[3]);
  setServoAngle(CH_LEFT_PINKY,  0, limitsLeft[4]);
  setServoAngle(CH_LEFT_WRIST,  90, limitsLeft[5]);

  // Mano Derecha
  setServoAngle(CH_RIGHT_THUMB,  0, limitsRight[0]);
  setServoAngle(CH_RIGHT_INDEX,  0, limitsRight[1]);
  setServoAngle(CH_RIGHT_MIDDLE, 0, limitsRight[2]);
  setServoAngle(CH_RIGHT_RING,   0, limitsRight[3]);
  setServoAngle(CH_RIGHT_PINKY,  0, limitsRight[4]);
  setServoAngle(CH_RIGHT_WRIST,  90, limitsRight[5]);
}

// Procesa el payload JSON recibido por WebSocket o Serial USB
void processTeleopJson(const char* jsonStr) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, jsonStr);
  if (error) {
    return; // JSON corrupto o incompleto, ignorar
  }

  double ts = doc["ts"] | 0.0;
  const char* hand = doc["hand"] | "";
  JsonObject servos = doc["servos"];

  if (!servos) return;

  // Filtrado de paquetes desordenados o retrasados por jitter de red
  if (strcmp(hand, "left") == 0) {
    if (ts < lastProcessedTsLeft && lastProcessedTsLeft > 0) {
      return; // Descartar paquete viejo
    }
    lastProcessedTsLeft = ts;

    // Mapeo normalizado 0.0-1.0 a grados 0-180
    if (servos.containsKey("thumb"))  setServoAngle(CH_LEFT_THUMB,  int(float(servos["thumb"]) * 180), limitsLeft[0]);
    if (servos.containsKey("index"))  setServoAngle(CH_LEFT_INDEX,  int(float(servos["index"]) * 180), limitsLeft[1]);
    if (servos.containsKey("middle")) setServoAngle(CH_LEFT_MIDDLE, int(float(servos["middle"]) * 180), limitsLeft[2]);
    if (servos.containsKey("ring"))   setServoAngle(CH_LEFT_RING,   int(float(servos["ring"]) * 180), limitsLeft[3]);
    if (servos.containsKey("pinky"))  setServoAngle(CH_LEFT_PINKY,  int(float(servos["pinky"]) * 180), limitsLeft[4]);
    if (servos.containsKey("wrist"))  setServoAngle(CH_LEFT_WRIST,  int(float(servos["wrist"]) * 180), limitsLeft[5]);

  } else if (strcmp(hand, "right") == 0) {
    if (ts < lastProcessedTsRight && lastProcessedTsRight > 0) {
      return;
    }
    lastProcessedTsRight = ts;

    if (servos.containsKey("thumb"))  setServoAngle(CH_RIGHT_THUMB,  int(float(servos["thumb"]) * 180), limitsRight[0]);
    if (servos.containsKey("index"))  setServoAngle(CH_RIGHT_INDEX,  int(float(servos["index"]) * 180), limitsRight[1]);
    if (servos.containsKey("middle")) setServoAngle(CH_RIGHT_MIDDLE, int(float(servos["middle"]) * 180), limitsRight[2]);
    if (servos.containsKey("ring"))   setServoAngle(CH_RIGHT_RING,   int(float(servos["ring"]) * 180), limitsRight[3]);
    if (servos.containsKey("pinky"))  setServoAngle(CH_RIGHT_PINKY,  int(float(servos["pinky"]) * 180), limitsRight[4]);
    if (servos.containsKey("wrist"))  setServoAngle(CH_RIGHT_WRIST,  int(float(servos["wrist"]) * 180), limitsRight[5]);
  }

  lastPacketReceivedMs = millis();
  watchdogTriggered = false;
}

// Manejador de eventos WebSocket
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Desconectado del servidor de teleoperación.");
      break;
    case WStype_CONNECTED:
      Serial.println("[WS] Conectado al servidor WebSocket con éxito.");
      break;
    case WStype_TEXT:
      processTeleopJson((char*)payload);
      break;
    case WStype_BIN:
    case WStype_ERROR:
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== INICIANDO SISTEMA DE TELEOPERACIÓN BIMANUAL (ESP32) ===");

  // Inicializar bus I2C para PCA9685
  Wire.begin(21, 22); // Pines estándar SDA=21, SCL=22 en ESP32 DevKit
  Wire.setClock(400000); // Modo I2C Fast 400kHz para baja latencia
  pca.begin();
  pca.setPWMFreq(SERVO_FREQ);

  enterSafeRestPose();

  // Conexión WiFi
  Serial.printf("[WiFi] Conectando a %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  // Timeout de 6s para WiFi (si no hay WiFi, sigue por Serial USB sin bloquearse)
  unsigned long startWifi = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startWifi < 6000) {
    delay(250);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Conectado. IP local: " + WiFi.localIP().toString());
    webSocket.begin(WS_SERVER_HOST, WS_SERVER_PORT, WS_SERVER_PATH);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(2000);
  } else {
    Serial.println("\n[WiFi] No disponible o fuera de rango. Operando exclusivamente por Serial USB.");
  }

  lastPacketReceivedMs = millis();
}

void loop() {
  // Procesar WebSocket si está activo
  if (WiFi.status() == WL_CONNECTED) {
    webSocket.loop();
  }

  // Procesar comandos directos por Serial USB (JSON por línea)
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      processTeleopJson(line.c_str());
    }
  }

  // Watchdog de seguridad por pérdida de señal
  if (!watchdogTriggered && (millis() - lastPacketReceivedMs > WATCHDOG_TIMEOUT_MS)) {
    enterSafeRestPose();
    watchdogTriggered = true;
  }
}
