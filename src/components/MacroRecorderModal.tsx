import React, { useState, useEffect, useRef } from "react";
import { ServoState, MacroKeyframe } from "../types/teleop";
import {
  Play,
  Square,
  Repeat,
  Download,
  Copy,
  Check,
  Film,
  FileSpreadsheet,
  Code,
  Clock,
  Trash2,
} from "lucide-react";

interface MacroRecorderModalProps {
  leftServos: ServoState;
  rightServos: ServoState;
  leftPinch: number;
  rightPinch: number;
  onPlaybackState?: (left: ServoState | null, right: ServoState | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const MacroRecorderModal: React.FC<MacroRecorderModalProps> = ({
  leftServos,
  rightServos,
  leftPinch,
  rightPinch,
  onPlaybackState,
  isOpen,
  onClose,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [keyframes, setKeyframes] = useState<MacroKeyframe[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [copiedCpp, setCopiedCpp] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const startTimeRef = useRef<number>(0);
  const recordIntervalRef = useRef<number | null>(null);
  const playIntervalRef = useRef<number | null>(null);

  // Stop playback when unmounting or modal closes
  useEffect(() => {
    if (!isOpen) {
      if (isPlaying) stopPlayback();
      if (isRecording) stopRecording();
    }
  }, [isOpen]);

  // Start recording keyframes at 25Hz (every 40ms)
  const startRecording = () => {
    setKeyframes([]);
    setIsRecording(true);
    setIsPlaying(false);
    startTimeRef.current = performance.now();

    recordIntervalRef.current = window.setInterval(() => {
      const elapsed = Math.round(performance.now() - startTimeRef.current);
      setKeyframes((prev) => [
        ...prev,
        {
          timestamp: elapsed,
          left: { ...leftServos },
          right: { ...rightServos },
          leftPinch,
          rightPinch,
        },
      ]);
    }, 40);
  };

  const stopRecording = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    setIsRecording(false);
  };

  // Playback recorded keyframes
  const startPlayback = () => {
    if (keyframes.length === 0) return;
    setIsPlaying(true);
    setPlaybackIndex(0);

    let idx = 0;
    playIntervalRef.current = window.setInterval(() => {
      if (idx >= keyframes.length) {
        if (isLooping) {
          idx = 0;
          setPlaybackIndex(0);
        } else {
          stopPlayback();
          return;
        }
      }

      const frame = keyframes[idx];
      if (frame && onPlaybackState) {
        onPlaybackState(frame.left, frame.right);
      }
      setPlaybackIndex(idx);
      idx++;
    }, 40);
  };

  const stopPlayback = () => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setIsPlaying(false);
    if (onPlaybackState) {
      onPlaybackState(null, null); // Return control to live tracking
    }
  };

  // Export CSV
  const exportCSV = () => {
    if (keyframes.length === 0) return;
    const headers = [
      "time_ms",
      "L_thumb",
      "L_index",
      "L_middle",
      "L_ring",
      "L_pinky",
      "L_wrist",
      "R_thumb",
      "R_index",
      "R_middle",
      "R_ring",
      "R_pinky",
      "R_wrist",
      "L_pinch",
      "R_pinch",
    ];

    const rows = keyframes.map((k) => [
      k.timestamp,
      Math.round(k.left.thumb * 180),
      Math.round(k.left.index * 180),
      Math.round(k.left.middle * 180),
      Math.round(k.left.ring * 180),
      Math.round(k.left.pinky * 180),
      Math.round(k.left.wrist * 180),
      Math.round(k.right.thumb * 180),
      Math.round(k.right.index * 180),
      Math.round(k.right.middle * 180),
      Math.round(k.right.ring * 180),
      Math.round(k.right.pinky * 180),
      Math.round(k.right.wrist * 180),
      k.leftPinch.toFixed(2),
      k.rightPinch.toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `teleop_trajectory_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate Arduino C++ PROGMEM array
  const generateCppCode = () => {
    const stepSample = Math.max(1, Math.floor(keyframes.length / 100)); // limit sample to max 100 frames for Arduino memory
    const sampled = keyframes.filter((_, i) => i % stepSample === 0);

    const lines = sampled.map((k) => {
      const vals = [
        Math.round(k.left.thumb * 180),
        Math.round(k.left.index * 180),
        Math.round(k.left.middle * 180),
        Math.round(k.left.ring * 180),
        Math.round(k.left.pinky * 180),
        Math.round(k.left.wrist * 180),
        Math.round(k.right.thumb * 180),
        Math.round(k.right.index * 180),
        Math.round(k.right.middle * 180),
        Math.round(k.right.ring * 180),
        Math.round(k.right.pinky * 180),
        Math.round(k.right.wrist * 180),
      ];
      return `  { ${vals.join(", ")} }`;
    });

    return `// ========================================================
// SECUENCIA AUTÓNOMA PREGRABADA PARA ARDUINO / ESP32
// Total de frames: ${sampled.length} (~${(keyframes.length * 0.04).toFixed(1)} segundos a 25Hz)
// Canales: [L_T, L_I, L_M, L_R, L_P, L_W, R_T, R_I, R_M, R_R, R_P, R_W]
// ========================================================
#include <avr/pgmspace.h>

const uint16_t NUM_RECORDED_FRAMES = ${sampled.length};
const uint8_t MOTION_SEQUENCE[][12] PROGMEM = {
${lines.join(",\n")}
};

void playRecordedMotion(uint16_t delayMs = 40) {
  for (uint16_t f = 0; f < NUM_RECORDED_FRAMES; f++) {
    for (uint8_t ch = 0; ch < 12; ch++) {
      uint8_t deg = pgm_read_byte(&(MOTION_SEQUENCE[f][ch]));
      // setServoAngle(ch, deg);
    }
    delay(delayMs);
  }
}`;
  };

  const copyCpp = () => {
    navigator.clipboard.writeText(generateCppCode());
    setCopiedCpp(true);
    setTimeout(() => setCopiedCpp(false), 2000);
  };

  const durationSec = (keyframes.length * 0.04).toFixed(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-100 font-mono text-sm">
                Grabador &amp; Reproductor de Rutinas (Macro Recorder)
              </h3>
              <p className="text-xs text-zinc-400">
                Captura secuencias bimanuales en vivo y expórtalas a C++ para Arduino o CSV
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

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Controls Bar */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isPlaying}
                  className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-md transition"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  Grabar Rutina
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs font-mono font-bold flex items-center gap-2 border border-rose-500/40 transition"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Detener ({keyframes.length} frames)
                </button>
              )}

              {!isPlaying ? (
                <button
                  onClick={startPlayback}
                  disabled={keyframes.length === 0 || isRecording}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-zinc-950 text-xs font-mono font-bold flex items-center gap-2 shadow-md transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Reproducir
                </button>
              ) : (
                <button
                  onClick={stopPlayback}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-mono font-bold flex items-center gap-2 shadow-md transition"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Pausar
                </button>
              )}

              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`px-3 py-2 rounded-lg text-xs font-mono border transition flex items-center gap-1.5 ${
                  isLooping
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="Repetir indefinidamente"
              >
                <Repeat className="w-3.5 h-3.5" />
                Loop
              </button>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                {durationSec}s
              </span>
              <span className="text-zinc-600">|</span>
              <span>{keyframes.length} Keyframes (25Hz)</span>
              {keyframes.length > 0 && !isRecording && (
                <button
                  onClick={() => {
                    setKeyframes([]);
                    setPlaybackIndex(0);
                  }}
                  className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                  title="Borrar grabación"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Timeline progress bar */}
          {keyframes.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                <span>Línea de tiempo</span>
                <span>
                  {((playbackIndex * 0.04)).toFixed(1)}s / {durationSec}s
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-cyan-400 transition-all duration-75"
                  style={{
                    width: `${(playbackIndex / Math.max(1, keyframes.length - 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Export Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={exportCSV}
              disabled={keyframes.length === 0}
              className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-left transition flex items-center justify-between group"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-200">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Descargar Trayectoria (.CSV)
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  12 canales con marcas de tiempo para análisis cinemático
                </p>
              </div>
              <Download className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition" />
            </button>

            <button
              onClick={copyCpp}
              disabled={keyframes.length === 0}
              className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-left transition flex items-center justify-between group"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-200">
                  <Code className="w-4 h-4 text-cyan-400" />
                  Copiar Código C++ PROGMEM
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Array optimizado para ejecutar la rutina en Arduino sin PC
                </p>
              </div>
              {copiedCpp ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition" />
              )}
            </button>
          </div>

          {/* Quick instructions */}
          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400 space-y-1">
            <p className="font-semibold text-zinc-300 font-mono text-[11px]">
              💡 Cómo usar el Macro Recorder:
            </p>
            <p className="text-[11px]">
              1. Haz clic en <strong>Grabar Rutina</strong> y realiza gestos frente a la cámara (ej. agarrar, saludar, mover dedos).
            </p>
            <p className="text-[11px]">
              2. Presiona <strong>Detener</strong> y luego <strong>Reproducir</strong> para ver a los gemelos digitales imitar la coreografía grabada.
            </p>
            <p className="text-[11px]">
              3. Con <strong>Copiar Código C++</strong> puedes flashear tu Arduino para que repita el movimiento sin necesidad de tener la cámara encendida.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
