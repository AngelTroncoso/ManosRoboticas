import React, { useState } from "react";
import { TeleopPacket } from "../types/teleop";
import { Terminal, Copy, Check, Radio, Zap, ShieldAlert } from "lucide-react";

interface ServoTelemetryProps {
  lastPacketLeft: TeleopPacket | null;
  lastPacketRight: TeleopPacket | null;
  packetsSent: number;
  packetsDropped: number;
  targetHz: number;
  setTargetHz: (hz: number) => void;
  latencyMs: number;
}

export const ServoTelemetry: React.FC<ServoTelemetryProps> = ({
  lastPacketLeft,
  lastPacketRight,
  packetsSent,
  packetsDropped,
  targetHz,
  setTargetHz,
  latencyMs,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedHand, setSelectedHand] = useState<"left" | "right">("right");

  const currentPacket = selectedHand === "left" ? lastPacketLeft : lastPacketRight;

  const handleCopyJson = () => {
    if (!currentPacket) return;
    navigator.clipboard.writeText(JSON.stringify(currentPacket, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
            Protocolo JSON &bull; Transmisión en Tiempo Real (30-50Hz)
          </h4>
        </div>

        <div className="flex items-center gap-3">
          {/* Rate Limiter Slider */}
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span>Frecuencia:</span>
            <input
              type="range"
              min="20"
              max="60"
              step="5"
              value={targetHz}
              onChange={(e) => setTargetHz(Number(e.target.value))}
              className="w-20 accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
            <span className="text-emerald-400 font-bold">{targetHz} Hz</span>
          </div>

          {/* Hand Selector for JSON view */}
          <div className="flex rounded-md bg-zinc-900 border border-zinc-800 p-0.5 text-xs font-mono">
            <button
              onClick={() => setSelectedHand("left")}
              className={`px-2 py-0.5 rounded transition ${
                selectedHand === "left" ? "bg-amber-500/20 text-amber-300 font-bold" : "text-zinc-500"
              }`}
            >
              Left
            </button>
            <button
              onClick={() => setSelectedHand("right")}
              className={`px-2 py-0.5 rounded transition ${
                selectedHand === "right" ? "bg-emerald-500/20 text-emerald-300 font-bold" : "text-zinc-500"
              }`}
            >
              Right
            </button>
          </div>
        </div>
      </div>

      {/* Network & Safety Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-zinc-500 text-[10px] uppercase">Paquetes Tx</span>
          <p className="text-sm font-semibold text-zinc-200 mt-0.5">{packetsSent}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-zinc-500 text-[10px] uppercase">Filtro Antidesfase (Drops)</span>
          <p className="text-sm font-semibold text-zinc-200 mt-0.5">{packetsDropped}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-zinc-500 text-[10px] uppercase">Latencia Glass-to-Glass</span>
          <p className="text-sm font-semibold text-emerald-400 mt-0.5">
            {latencyMs.toFixed(1)} ms
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-zinc-500 text-[10px] uppercase">Clamping de Seguridad</span>
          <p className="text-sm font-semibold text-cyan-400 mt-0.5 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> 5° - 175°
          </p>
        </div>
      </div>

      {/* Live JSON Payload Viewer */}
      <div className="relative rounded-lg bg-zinc-900 border border-zinc-800/90 p-3 font-mono text-xs overflow-x-auto">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-2 mb-2 border-b border-zinc-800">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Último payload transmitido por WebSocket / Serial:
          </span>
          <button
            onClick={handleCopyJson}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiado" : "Copiar JSON"}
          </button>
        </div>

        <pre className="text-emerald-300/90 leading-relaxed text-[11px]">
          {currentPacket
            ? JSON.stringify(currentPacket, null, 2)
            : `// En espera de detección de mano ${selectedHand}...`}
        </pre>
      </div>

      {/* Safety Watchdog Notice */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800 text-[11px] font-mono text-zinc-400">
        <ShieldAlert className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>
          Protección activa: El firmware del ESP32 descarta timestamps anteriores a la última muestra y activa el watchdog de reposo tras 1500ms sin señal.
        </span>
      </div>
    </div>
  );
};
