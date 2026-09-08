import React, { useState } from "react";
import { HandHardwareProfile, ServoState } from "../types/teleop";
import { Cpu, Check, AlertTriangle, HelpCircle, Layers, Wrench, Save } from "lucide-react";

interface HardwareConfigModalProps {
  currentProfile: HandHardwareProfile;
  onUpdateProfile: (profile: HandHardwareProfile) => void;
}

export const HARDWARE_PRESETS: HandHardwareProfile[] = [
  {
    id: "inmoov_6dof",
    name: "InMoov Hand (6 GDL por mano — 12 servos)",
    description:
      "5 servos de flexión continua por dedo + 1 servo de rotación de muñeca. Recomendado para v1.",
    dofPerHand: 6,
    microcontroller: "single_esp32_pca9685",
    servosLeft: {
      thumb: { minDeg: 5, maxDeg: 170, inverted: false, channel: 0, minPulseUs: 550, maxPulseUs: 2450 },
      index: { minDeg: 5, maxDeg: 175, inverted: false, channel: 1, minPulseUs: 550, maxPulseUs: 2450 },
      middle: { minDeg: 5, maxDeg: 175, inverted: false, channel: 2, minPulseUs: 550, maxPulseUs: 2450 },
      ring: { minDeg: 5, maxDeg: 175, inverted: false, channel: 3, minPulseUs: 550, maxPulseUs: 2450 },
      pinky: { minDeg: 5, maxDeg: 170, inverted: false, channel: 4, minPulseUs: 550, maxPulseUs: 2450 },
      wrist: { minDeg: 15, maxDeg: 165, inverted: false, channel: 5, minPulseUs: 550, maxPulseUs: 2450 },
    },
    servosRight: {
      thumb: { minDeg: 5, maxDeg: 170, inverted: false, channel: 8, minPulseUs: 550, maxPulseUs: 2450 },
      index: { minDeg: 5, maxDeg: 175, inverted: false, channel: 9, minPulseUs: 550, maxPulseUs: 2450 },
      middle: { minDeg: 5, maxDeg: 175, inverted: false, channel: 10, minPulseUs: 550, maxPulseUs: 2450 },
      ring: { minDeg: 5, maxDeg: 175, inverted: false, channel: 11, minPulseUs: 550, maxPulseUs: 2450 },
      pinky: { minDeg: 5, maxDeg: 170, inverted: false, channel: 12, minPulseUs: 550, maxPulseUs: 2450 },
      wrist: { minDeg: 15, maxDeg: 165, inverted: false, channel: 13, minPulseUs: 550, maxPulseUs: 2450 },
    },
  },
  {
    id: "custom_3d_5dof",
    name: "Mano Impresión 3D Propia (5 GDL por mano — 10 servos)",
    description: "1 servo por dedo para flexión pura mediante tendones (SG90 / MG90S). Sin servo de muñeca.",
    dofPerHand: 5,
    microcontroller: "single_esp32_pca9685",
    servosLeft: {
      thumb: { minDeg: 0, maxDeg: 180, inverted: false, channel: 0, minPulseUs: 500, maxPulseUs: 2500 },
      index: { minDeg: 0, maxDeg: 180, inverted: false, channel: 1, minPulseUs: 500, maxPulseUs: 2500 },
      middle: { minDeg: 0, maxDeg: 180, inverted: false, channel: 2, minPulseUs: 500, maxPulseUs: 2500 },
      ring: { minDeg: 0, maxDeg: 180, inverted: false, channel: 3, minPulseUs: 500, maxPulseUs: 2500 },
      pinky: { minDeg: 0, maxDeg: 180, inverted: false, channel: 4, minPulseUs: 500, maxPulseUs: 2500 },
      wrist: { minDeg: 90, maxDeg: 90, inverted: false, channel: 5, minPulseUs: 1500, maxPulseUs: 1500 },
    },
    servosRight: {
      thumb: { minDeg: 0, maxDeg: 180, inverted: false, channel: 8, minPulseUs: 500, maxPulseUs: 2500 },
      index: { minDeg: 0, maxDeg: 180, inverted: false, channel: 9, minPulseUs: 500, maxPulseUs: 2500 },
      middle: { minDeg: 0, maxDeg: 180, inverted: false, channel: 10, minPulseUs: 500, maxPulseUs: 2500 },
      ring: { minDeg: 0, maxDeg: 180, inverted: false, channel: 11, minPulseUs: 500, maxPulseUs: 2500 },
      pinky: { minDeg: 0, maxDeg: 180, inverted: false, channel: 12, minPulseUs: 500, maxPulseUs: 2500 },
      wrist: { minDeg: 90, maxDeg: 90, inverted: false, channel: 13, minPulseUs: 1500, maxPulseUs: 1500 },
    },
  },
  {
    id: "high_fidelity_11dof",
    name: "Mano Biofiel Multi-Falange (11 GDL por mano)",
    description: "Separa flexión proximal (MCP) y distal (PIP/DIP) + abducción lateral de dedos.",
    dofPerHand: 11,
    microcontroller: "dual_esp32",
    servosLeft: {
      thumb: { minDeg: 5, maxDeg: 175, inverted: false, channel: 0, minPulseUs: 550, maxPulseUs: 2450 },
      index: { minDeg: 5, maxDeg: 175, inverted: false, channel: 1, minPulseUs: 550, maxPulseUs: 2450 },
      middle: { minDeg: 5, maxDeg: 175, inverted: false, channel: 2, minPulseUs: 550, maxPulseUs: 2450 },
      ring: { minDeg: 5, maxDeg: 175, inverted: false, channel: 3, minPulseUs: 550, maxPulseUs: 2450 },
      pinky: { minDeg: 5, maxDeg: 175, inverted: false, channel: 4, minPulseUs: 550, maxPulseUs: 2450 },
      wrist: { minDeg: 15, maxDeg: 165, inverted: false, channel: 5, minPulseUs: 550, maxPulseUs: 2450 },
    },
    servosRight: {
      thumb: { minDeg: 5, maxDeg: 175, inverted: false, channel: 8, minPulseUs: 550, maxPulseUs: 2450 },
      index: { minDeg: 5, maxDeg: 175, inverted: false, channel: 9, minPulseUs: 550, maxPulseUs: 2450 },
      middle: { minDeg: 5, maxDeg: 175, inverted: false, channel: 10, minPulseUs: 550, maxPulseUs: 2450 },
      ring: { minDeg: 5, maxDeg: 175, inverted: false, channel: 11, minPulseUs: 550, maxPulseUs: 2450 },
      pinky: { minDeg: 5, maxDeg: 175, inverted: false, channel: 12, minPulseUs: 550, maxPulseUs: 2450 },
      wrist: { minDeg: 15, maxDeg: 165, inverted: false, channel: 13, minPulseUs: 550, maxPulseUs: 2450 },
    },
  },
];

export const HardwareConfigModal: React.FC<HardwareConfigModalProps> = ({
  currentProfile,
  onUpdateProfile,
}) => {
  const [profile, setProfile] = useState<HandHardwareProfile>(currentProfile);
  const [saved, setSaved] = useState(false);

  const selectPreset = (preset: HandHardwareProfile) => {
    setProfile(preset);
  };

  const handleSave = () => {
    onUpdateProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateServo = (
    side: "left" | "right",
    joint: keyof ServoState,
    field: string,
    val: any
  ) => {
    const key = side === "left" ? "servosLeft" : "servosRight";
    setProfile({
      ...profile,
      [key]: {
        ...profile[key],
        [joint]: {
          ...profile[key][joint],
          [field]: val,
        },
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      {/* Questionnaire prompt box */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h4 className="font-semibold text-emerald-300 font-mono">
            Configuración de Grados de Libertad (GDL) de la Mano Física
          </h4>
          <p className="text-zinc-300 leading-relaxed">
            Tal como especificaste en la nota del encargo: el mapeo cinemático se adapta a tu mano robótica. Si usas un diseño estándar o InMoov con <strong>1 servomotor por dedo (5 GDL) + 1 para muñeca</strong>, v1 cubre perfectamente toda la flexión continua y pinzas. Si tu modelo cuenta con servos adicionales para separar falange proximal de distal, selecciona el perfil de 11 GDL.
          </p>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-100 font-mono">
              Modelos y Presets de Manos Robóticas
            </h3>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold font-mono shadow transition"
          >
            <Save className="w-3.5 h-3.5" />
            Aplicar Cambios
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {HARDWARE_PRESETS.map((p) => {
            const isSelected = profile.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => selectPreset(p)}
                className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                  isSelected
                    ? "bg-emerald-950/40 border-emerald-500/60 shadow-lg"
                    : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-zinc-200">{p.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">{p.description}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>{p.dofPerHand} GDL/Mano</span>
                  <span>{p.microcontroller === "single_esp32_pca9685" ? "1x ESP32 + PCA" : "2x ESP32"}</span>
                </div>
              </div>
            );
          })}
        </div>

        {saved && (
          <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono text-center">
            ✓ Configuración de hardware actualizada para el firmware y transmisor.
          </div>
        )}
      </div>

      {/* Pinout & Channel Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-100 font-mono">
            Mapeo de Canales PCA9685 e Inversión de Sentido
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mano Izquierda */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
            <h4 className="text-xs font-mono font-bold text-amber-400 flex items-center justify-between">
              <span>MANO IZQUIERDA</span>
              <span className="text-zinc-500 text-[10px]">Canales 0-5</span>
            </h4>

            <div className="space-y-2">
              {(["thumb", "index", "middle", "ring", "pinky", "wrist"] as const).map((joint) => {
                const conf = profile.servosLeft[joint];
                return (
                  <div
                    key={joint}
                    className="flex items-center justify-between text-xs font-mono p-2 rounded bg-zinc-900 border border-zinc-800/80"
                  >
                    <span className="text-zinc-300 capitalize w-16">{joint}:</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-zinc-500">Canal:</span>
                      <input
                        type="number"
                        min="0"
                        max="15"
                        value={conf.channel}
                        onChange={(e) => updateServo("left", joint, "channel", Number(e.target.value))}
                        className="w-10 px-1 py-0.5 bg-zinc-800 rounded text-center text-zinc-200 border border-zinc-700"
                      />
                      <label className="flex items-center gap-1 cursor-pointer text-zinc-400 ml-1">
                        <input
                          type="checkbox"
                          checked={conf.inverted}
                          onChange={(e) => updateServo("left", joint, "inverted", e.target.checked)}
                          className="accent-emerald-500 rounded"
                        />
                        <span>Invertir</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mano Derecha */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
            <h4 className="text-xs font-mono font-bold text-emerald-400 flex items-center justify-between">
              <span>MANO DERECHA</span>
              <span className="text-zinc-500 text-[10px]">Canales 8-13</span>
            </h4>

            <div className="space-y-2">
              {(["thumb", "index", "middle", "ring", "pinky", "wrist"] as const).map((joint) => {
                const conf = profile.servosRight[joint];
                return (
                  <div
                    key={joint}
                    className="flex items-center justify-between text-xs font-mono p-2 rounded bg-zinc-900 border border-zinc-800/80"
                  >
                    <span className="text-zinc-300 capitalize w-16">{joint}:</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-zinc-500">Canal:</span>
                      <input
                        type="number"
                        min="0"
                        max="15"
                        value={conf.channel}
                        onChange={(e) => updateServo("right", joint, "channel", Number(e.target.value))}
                        className="w-10 px-1 py-0.5 bg-zinc-800 rounded text-center text-zinc-200 border border-zinc-700"
                      />
                      <label className="flex items-center gap-1 cursor-pointer text-zinc-400 ml-1">
                        <input
                          type="checkbox"
                          checked={conf.inverted}
                          onChange={(e) => updateServo("right", joint, "inverted", e.target.checked)}
                          className="accent-emerald-500 rounded"
                        />
                        <span>Invertir</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
