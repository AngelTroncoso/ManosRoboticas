# Sistema de Teleoperación Bimanual con Manos Robóticas (MediaPipe + ESP32)

Sistema completo de teleoperación continua de baja latencia (<100ms) para dos manos robóticas físicas utilizando visión artificial monocromática con **MediaPipe HandLandmarker Tasks API**, cinemática articular en tiempo real, filtrado temporal adaptativo (One Euro Filter), mapeo a driver PCA9685 y capa de supervisión inteligente con **Google Gemini**.

---

## 🛠️ Arquitectura del Sistema

```
[ Cámara RGB ]
      │
      ▼ (60/30 FPS)
[ MediaPipe Tasks Vision HandLandmarker ]  --> 21 Landmarks 3D por mano (Izquierda/Derecha)
      │
      ▼
[ Módulo Cinemática (/percepcion/kinematics.py) ] --> Flexión continua (0-180°), Abducción, Pinza, Roll
      │
      ▼
[ Filtro Temporal Adaptativo (/percepcion/filtering.py) ] --> 1€ Filter (cero jitter, latencia <5ms)
      │
      ▼
[ Mapeo & Calibración (/mapeo/servo_mapper.py) ] --> 0.0 - 1.0 normalizado + Clamping de seguridad
      │
      ▼ (30-50 Hz)
[ Transporte WebSocket / Serial USB ] --> Protocolo JSON con Timestamp & Anti-Whiplash
      │
      ▼
[ ESP32 + Driver I2C PCA9685 (0x40) ] --> 12 Servomotores (6 DOF x 2 manos)
      │
      ▼
[ Manos Robóticas Físicas (InMoov / Brunel / Custom 3D) ]
```

---

## 🔌 Conexiones de Hardware

### 1. ESP32 DevKit a PCA9685 (I2C)
| Pin ESP32 | Pin PCA9685 | Función |
|-----------|-------------|---------|
| 3V3       | VCC         | Alimentación lógica de la placa (3.3V) |
| GND       | GND         | Tierra común (¡Unir a tierra de la fuente de servos!) |
| GPIO 21   | SDA         | Línea de datos I2C |
| GPIO 22   | SCL         | Línea de reloj I2C |

> ⚠️ **IMPORTANTE**: Los servos NO deben alimentarse del pin 5V del ESP32. Conecta una fuente externa de **5V o 6V (mínimo 3A a 5A)** a la bornera verde de potencia (V+) del PCA9685.

### 2. Canales de Servos en el PCA9685 (16 canales)
- **Mano Izquierda**:
  - Canal 0: Pulgar (Flexión)
  - Canal 1: Índice (Flexión)
  - Canal 2: Medio (Flexión)
  - Canal 3: Anular (Flexión)
  - Canal 4: Meñique (Flexión)
  - Canal 5: Muñeca (Rotación / Roll)
- **Mano Derecha**:
  - Canal 8: Pulgar (Flexión)
  - Canal 9: Índice (Flexión)
  - Canal 10: Medio (Flexión)
  - Canal 11: Anular (Flexión)
  - Canal 12: Meñique (Flexión)
  - Canal 13: Muñeca (Rotación / Roll)

---

## 🚀 Inicio Rápido en Python

1. **Instalar dependencias**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Ejecutar tests unitarios**:
   ```bash
   python -m unittest tests/test_kinematics.py
   ```

3. **Lanzar teleoperación con cámara**:
   ```bash
   python main.py --cam_id 0 --target_hz 40
   ```

---

## 💻 Control Station Web & Simulador

La aplicación web en esta plataforma proporciona una estación de control integral:
1. **Detección en vivo por WebCam**: Corre MediaPipe directamente en el navegador con visualización de esqueleto y ángulos en tiempo real.
2. **Gemelo Digital 3D**: Renderiza ambas manos robóticas articuladas replicando el movimiento humano inmediatamente.
3. **Asistente de Calibración**: Pasos guiados para capturar la postura abierta (0%) y puño cerrado (100%).
4. **WebSerial & WebSocket Bridge**: Conecta tu ESP32 por USB directamente desde el navegador (Google Chrome / Edge) o por WiFi mediante el servidor WebSocket incluido.
5. **Supervisor Gemini**: Análisis de estabilidad de agarre, detección de fatiga y recomendaciones automáticas de seguridad.
