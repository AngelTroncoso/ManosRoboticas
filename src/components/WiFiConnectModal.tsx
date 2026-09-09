import React, { useState } from "react";
import { Wifi, WifiOff, CheckCircle2, AlertCircle, Copy, Check, Terminal } from "lucide-react";

interface WiFiConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  wsUrl: string;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
}

export const WiFiConnectModal: React.FC<WiFiConnectModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  wsUrl,
  onConnect,
  onDisconnect,
}) => {
  const [url, setUrl] = useState(wsUrl || "ws://192.168.4.1:81");
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const sampleEsp32Code = `// ESP32 WebSocket Receiver for Wireless Teleoperation
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

const char* ssid = "RoboHand_AP";
const char* password = "teleoppassword";

WebSocketsServer webSocket = WebSocketsServer(81);
Adafruit_PWMServoDriver pca = Adafruit_PWMServoDriver(0x40);

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_BIN && length >= 12) {
    // 12 bytes received: [L_T, L_I, L_M, L_R, L_P, L_W, R_T, R_I, R_M, R_R, R_P, R_W]
    for (int i = 0; i < 12; i++) {
      int deg = payload[i];
      int pulse = map(deg, 0, 180, 150, 600);
      pca.setPWM(i, 0, pulse);
    }
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.softAP(ssid, password);
  Serial.print("AP IP address: ");
  Serial.println(WiFi.softAPIP()); // Usually 192.168.4.1

  pca.begin();
  pca.setPWMFreq(50);
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(sampleEsp32Code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-100 font-mono text-sm">
                Conexión Inalámbrica WiFi (ESP32 WebSockets)
              </h3>
              <p className="text-xs text-zinc-400">
                Teleopera tu mano robótica sin cables a través de red local o Access Point
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm px-2.5 py-1 rounded-lg hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Connection URL Input */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold text-zinc-300">
              Dirección WebSocket de la ESP32 (IP:Puerto):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ws://192.168.4.1:81"
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 focus:outline-none focus:border-cyan-500 transition"
              />
              {!isConnected ? (
                <button
                  onClick={() => onConnect(url)}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow transition"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  Conectar
                </button>
              ) : (
                <button
                  onClick={onDisconnect}
                  className="px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  Desconectar
                </button>
              )}
            </div>
          </div>

          {/* Connection status badge */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
              isConnected
                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                : "bg-zinc-950 border-zinc-800 text-zinc-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {isConnected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-zinc-500" />
              )}
              <span>
                {isConnected
                  ? `Conectado y transmitiendo paquetes a ${url}`
                  : "Desconectado. Ingresa la IP de tu ESP32 para iniciar."}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              {isConnected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          {/* Code snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                Firmware ESP32 (Arduino IDE)
              </span>
              <button
                onClick={copyCode}
                className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedCode ? "Copiado!" : "Copiar Firmware"}
              </button>
            </div>
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl overflow-x-auto text-[10px] font-mono text-zinc-400 max-h-48">
              <pre>{sampleEsp32Code}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
