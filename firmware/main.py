"""
Firmware MicroPython para ESP32 + PCA9685
Alternativa en Python para el microcontrolador.
"""

import time
import json
from machine import Pin, I2C

# Driver simplificado para PCA9685 en MicroPython
class PCA9685:
    def __init__(self, i2c, address=0x40):
        self.i2c = i2c
        self.address = address
        self.reset()
        self.set_pwm_freq(50)

    def reset(self):
        self.i2c.writeto_mem(self.address, 0x00, b'\x00')

    def set_pwm_freq(self, freq_hz):
        prescale_val = 25000000.0 / 4096.0 / float(freq_hz) - 1.0
        prescale = int(prescale_val + 0.5)
        old_mode = self.i2c.readfrom_mem(self.address, 0x00, 1)[0]
        new_mode = (old_mode & 0x7F) | 0x10  # Modo Sleep
        self.i2c.writeto_mem(self.address, 0x00, bytes([new_mode]))
        self.i2c.writeto_mem(self.address, 0xFE, bytes([prescale]))
        self.i2c.writeto_mem(self.address, 0x00, bytes([old_mode]))
        time.sleep_ms(5)
        self.i2c.writeto_mem(self.address, 0x00, bytes([old_mode | 0xA1]))

    def set_pwm(self, channel, on, off):
        reg = 0x06 + 4 * channel
        data = bytes([on & 0xFF, (on >> 8) & 0xFF, off & 0xFF, (off >> 8) & 0xFF])
        self.i2c.writeto_mem(self.address, reg, data)

    def set_servo_angle(self, channel, deg):
        deg = max(0, min(180, deg))
        us = 550 + (deg / 180.0) * (2450 - 550)
        ticks = int(us * 4096 / 20000)
        self.set_pwm(channel, 0, ticks)


# Setup
i2c = I2C(0, scl=Pin(22), sda=Pin(21), freq=400000)
pca = PCA9685(i2c)

CHANNELS = {
    "left": {"thumb": 0, "index": 1, "middle": 2, "ring": 3, "pinky": 4, "wrist": 5},
    "right": {"thumb": 8, "index": 9, "middle": 10, "ring": 11, "pinky": 12, "wrist": 13}
}

print("[MicroPython] ESP32 Teleoperation Ready on USB Serial. Send JSON lines.")

while True:
    try:
        line = input()
        if not line:
            continue
        packet = json.loads(line)
        hand = packet.get("hand")
        servos = packet.get("servos", {})
        if hand in CHANNELS:
            mapping = CHANNELS[hand]
            for joint, norm_val in servos.items():
                if joint in mapping:
                    deg = int(float(norm_val) * 180)
                    pca.set_servo_angle(mapping[joint], deg)
    except Exception as e:
        pass
