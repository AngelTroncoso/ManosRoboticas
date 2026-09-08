import React, { useState } from "react";
import { UserCalibrationProfile, HandKinematics } from "../types/teleop";
import { DEFAULT_CALIBRATION } from "../utils/kinematicsEngine";
import { Sliders, CheckCircle2, RotateCcw, Save, Hand, Sparkles } from "lucide-react";

interface CalibrationModalProps {
  currentKinematicsLeft: HandKinematics | null;
  currentKinematicsRight: HandKinematics | null;
  calibration: UserCalibrationProfile;
  onSaveCalibration: (cal: UserCalibrationProfile) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  currentKinematicsLeft,
  currentKinematicsRight,
  calibration,
  onSaveCalibration,
}) => {
  const [calState, setCalState] = useState<UserCalibrationProfile>({ ...calibration });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saveMessage, setSaveMessage] = useState(false);

  // Active kinematics for calibration (prefers right hand if detected, else left)
  const activeKin = currentKinematicsRight || currentKinematicsLeft;

  // Step 1: Capture Open Hand (0% baseline)
  const captureOpenPose = () => {
    if (!activeKin) return;
    const newCal: UserCalibrationProfile = { ...calState };
    const fingers = ["thumb", "index", "middle", "ring", "pinky"] as const;

    fingers.forEach((f) => {
      const measured = activeKin.flexions[f].total;
      newCal[f] = {
        ...newCal[f],
        minAngle: Math.round(Math.max(0, measured)),
      };
    });

    setCalState(newCal);
    setStep(2);
  };

  // Step 2: Capture Closed Fist (100% baseline)
  const captureFistPose = () => {
    if (!activeKin) return;
    const newCal: UserCalibrationProfile = { ...calState };
    const fingers = ["thumb", "index", "middle", "ring", "pinky"] as const;

    fingers.forEach((f) => {
      const measured = activeKin.flexions[f].total;
      const minVal = newCal[f].minAngle;
      newCal[f] = {
        ...newCal[f],
        maxAngle: Math.round(Math.max(minVal + 30, measured)),
      };
    });

    setCalState(newCal);
    setStep(3);
  };

  const handleSave = () => {
    onSaveCalibration(calState);
    setSaveMessage(true);
    setTimeout(() => setSaveMessage(false), 2500);
  };

  const handleReset = () => {
    setCalState({ ...DEFAULT_CALIBRATION });
    setStep(1);
  };

  const fingerNames: Record<keyof Omit<UserCalibrationProfile, "wrist">, string> = {
    thumb: "Pulgar",
    index: "Índice",
    middle: "Medio",
    ring: "Anular",
    pinky: "Meñique",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wizard Banner */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 font-mono">
                Asistente de Calibración Articular Bimanual
              </h3>
              <p className="text-xs text-zinc-400">
                Ajusta los rangos biomecánicos individuales: Mano Abierta (0%) &bull; Puño Cerrado (100%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold font-mono shadow transition"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Perfil
            </button>
          </div>
        </div>

        {/* Step Guide Tabs */}
        <div className="grid grid-cols-3 gap-3">
          <div
            onClick={() => setStep(1)}
            className={`p-3 rounded-lg border cursor-pointer transition ${
              step === 1
                ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center">
                1
              </span>
              Mano Abierta (0%)
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Extiende la mano frente a la cámara con los dedos rectos.
            </p>
          </div>

          <div
            onClick={() => setStep(2)}
            className={`p-3 rounded-lg border cursor-pointer transition ${
              step === 2
                ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center">
                2
              </span>
              Puño Cerrado (100%)
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Cierra el puño apretando todos los dedos firmemente.
            </p>
          </div>

          <div
            onClick={() => setStep(3)}
            className={`p-3 rounded-lg border cursor-pointer transition ${
              step === 3
                ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center">
                3
              </span>
              Ajuste Fino Manual
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Modifica los umbrales numéricos de cada articulación.
            </p>
          </div>
        </div>

        {/* Action button based on active step */}
        <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
            <Hand className="w-4 h-4 text-emerald-400" />
            <span>
              {activeKin
                ? `Mano detectada: ${activeKin.side.toUpperCase()}`
                : "Coloca tu mano frente a la cámara (o usa el simulador)"}
            </span>
          </div>

          {step === 1 && (
            <button
              onClick={captureOpenPose}
              disabled={!activeKin}
              className="px-3 py-1.5 rounded-md text-xs font-mono font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 transition"
            >
              Capturar Postura Abierta (0%) &rarr;
            </button>
          )}

          {step === 2 && (
            <button
              onClick={captureFistPose}
              disabled={!activeKin}
              className="px-3 py-1.5 rounded-md text-xs font-mono font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 transition"
            >
              Capturar Puño Cerrado (100%) &rarr;
            </button>
          )}

          {step === 3 && (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Calibración lista para guardar
            </span>
          )}
        </div>

        {saveMessage && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono text-center animate-fade-in">
            ✓ Perfil de calibración guardado y aplicado al servo mapper en vivo.
          </div>
        )}
      </div>

      {/* Manual Calibration Sliders per Finger */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
          Rangos Articulares por Dedo (Grados de Flexión)
        </h4>

        <div className="space-y-4">
          {(["thumb", "index", "middle", "ring", "pinky"] as const).map((finger) => {
            const currentFlex = activeKin ? activeKin.flexions[finger].total : 0;
            const minA = calState[finger].minAngle;
            const maxA = calState[finger].maxAngle;

            return (
              <div
                key={finger}
                className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200">{fingerNames[finger]}</span>
                    <span className="text-zinc-500 text-[11px]">
                      (Medición en vivo:{" "}
                      <span className="text-emerald-400 font-bold">{currentFlex.toFixed(0)}°</span>)
                    </span>
                  </div>
                  <div className="text-zinc-400 text-[11px]">
                    Min: <span className="text-zinc-200">{minA}°</span> | Max:{" "}
                    <span className="text-zinc-200">{maxA}°</span>
                  </div>
                </div>

                {/* Sliders for Min and Max */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[11px]">Min (0%):</span>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={minA}
                      onChange={(e) =>
                        setCalState({
                          ...calState,
                          [finger]: { ...calState[finger], minAngle: Number(e.target.value) },
                        })
                      }
                      className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                    <span className="w-8 text-right text-zinc-200">{minA}°</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[11px]">Max (100%):</span>
                    <input
                      type="range"
                      min="80"
                      max="180"
                      value={maxA}
                      onChange={(e) =>
                        setCalState({
                          ...calState,
                          [finger]: { ...calState[finger], maxAngle: Number(e.target.value) },
                        })
                      }
                      className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                    <span className="w-8 text-right text-zinc-200">{maxA}°</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
