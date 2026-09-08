import React from "react";
import {
  Activity,
  Cpu,
  Download,
  Sliders,
  Code2,
  Sparkles,
  Wifi,
  Usb,
  ShieldCheck,
} from "lucide-react";

interface HeaderProps {
  activeTab: "teleop" | "calibration" | "hardware" | "supervisor" | "code";
  setActiveTab: (tab: "teleop" | "calibration" | "hardware" | "supervisor" | "code") => void;
  fps: number;
  latencyMs: number;
  txRateHz: number;
  isConnectedWS: boolean;
  isConnectedSerial: boolean;
  onConnectSerial: () => void;
  onDownloadZip: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  fps,
  latencyMs,
  txRateHz,
  isConnectedWS,
  isConnectedSerial,
  onConnectSerial,
  onDownloadZip,
}) => {
  const isLatencyGood = latencyMs < 80;
  const isLatencyWarn = latencyMs >= 80 && latencyMs < 120;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-40 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100 tracking-tight text-base sm:text-lg font-['Chakra_Petch']">
                PROMPT MAESTRO // BIMANUAL TELEOP
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                v1.0 MediaPipe
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              Control Cinematográfico Continuo &bull; ESP32 + PCA9685
            </p>
          </div>
        </div>

        {/* Telemetry badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Glass-to-Glass Latency */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
              isLatencyGood
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : isLatencyWarn
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
            title="Latencia estimada Glass-to-Glass (Detección a Servo)"
          >
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>Latencia: {latencyMs.toFixed(0)} ms</span>
            <span className="text-[10px] opacity-75">(&lt;100ms)</span>
          </div>

          {/* FPS & Transmission Rate */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
            <span>{fps.toFixed(0)} FPS</span>
            <span className="text-zinc-600">|</span>
            <span>Tx: {txRateHz.toFixed(0)} Hz</span>
          </div>

          {/* Connection Statuses */}
          <div className="flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border ${
                isConnectedWS
                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500"
              }`}
              title="WebSocket Hub status"
            >
              <Wifi className="w-3 h-3" />
              WS
            </span>
            <button
              id="btn-serial-connect"
              onClick={onConnectSerial}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors ${
                isConnectedSerial
                  ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-300"
                  : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400"
              }`}
              title="Conectar directamente por USB Serial a tu ESP32"
            >
              <Usb className="w-3 h-3" />
              {isConnectedSerial ? "USB OK" : "USB Serial"}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            id="tab-teleop"
            onClick={() => setActiveTab("teleop")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "teleop"
                ? "bg-emerald-500 text-zinc-950 font-semibold shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            En Vivo
          </button>
          <button
            id="tab-calibration"
            onClick={() => setActiveTab("calibration")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === "calibration"
                ? "bg-emerald-500 text-zinc-950 font-semibold shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Calibración
          </button>
          <button
            id="tab-hardware"
            onClick={() => setActiveTab("hardware")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === "hardware"
                ? "bg-emerald-500 text-zinc-950 font-semibold shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Hardware &amp; GDL
          </button>
          <button
            id="tab-supervisor"
            onClick={() => setActiveTab("supervisor")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === "supervisor"
                ? "bg-emerald-500 text-zinc-950 font-semibold shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gemini AI
          </button>
          <button
            id="tab-code"
            onClick={() => setActiveTab("code")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === "code"
                ? "bg-emerald-500 text-zinc-950 font-semibold shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Código &amp; ZIP
          </button>
        </div>

        {/* Export Button */}
        <button
          id="btn-download-bundle"
          onClick={onDownloadZip}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
          title="Descargar paquete completo Python + Firmware ESP32"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          Descargar .ZIP
        </button>
      </div>
    </header>
  );
};
