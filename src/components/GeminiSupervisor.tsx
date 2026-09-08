import React, { useState } from "react";
import { HandKinematics, GeminiAnalysisResult, ServoState } from "../types/teleop";
import { Sparkles, ShieldCheck, AlertTriangle, Play, RefreshCw, Cpu, CheckCircle } from "lucide-react";

interface GeminiSupervisorProps {
  leftKinematics: HandKinematics | null;
  rightKinematics: HandKinematics | null;
  leftServos: ServoState;
  rightServos: ServoState;
}

export const GeminiSupervisor: React.FC<GeminiSupervisorProps> = ({
  leftKinematics,
  rightKinematics,
  leftServos,
  rightServos,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoSupervisor, setAutoSupervisor] = useState(false);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const payload = {
        left: {
          detected: !!leftKinematics,
          servos: leftServos,
          pinch: leftKinematics?.pinchAperture ?? 1.0,
          wristRoll: leftKinematics?.palmOrientation.roll ?? 0,
        },
        right: {
          detected: !!rightKinematics,
          servos: rightServos,
          pinch: rightKinematics?.pinchAperture ?? 1.0,
          wristRoll: rightKinematics?.palmOrientation.roll ?? 0,
        },
      };

      const res = await fetch("/api/gemini/analyze-grip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Error en servidor Gemini API: ${res.statusText}`);
      }

      const data = await res.json();
      setAnalysisResult(data);
    } catch (err: any) {
      console.error("Gemini analysis error:", err);
      setError(err.message || "No se pudo completar el análisis del supervisor Gemini.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      {/* Overview Banner */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 font-mono">
                Supervisor Inteligente de Agarre con Gemini
              </h3>
              <p className="text-xs text-zinc-400">
                Análisis de Grasp Stability &bull; Clasificación de Agarre &bull; Protección contra Atascamiento de Servos
              </p>
            </div>
          </div>

          <button
            id="btn-run-gemini-analysis"
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow transition disabled:opacity-50"
          >
            {isAnalyzing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            {isAnalyzing ? "Analizando Cinemática..." : "Ejecutar Diagnóstico AI"}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}
      </div>

      {/* Analysis Results View */}
      {analysisResult ? (
        <div className="space-y-4">
          {/* Overall summary card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-zinc-400">Evaluación General</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                Modelo: Gemini 2.5 Flash
              </span>
            </div>

            <p className="text-sm text-zinc-200 leading-relaxed font-sans">
              {analysisResult.overallAssessment}
            </p>

            {analysisResult.safetyWarning && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{analysisResult.safetyWarning}</span>
              </div>
            )}

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">Acción Asistiva Recomendada:</span>
              <span className="text-emerald-400 font-semibold">{analysisResult.recommendedAction}</span>
            </div>
          </div>

          {/* Hand breakdown cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mano Izquierda */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-bold text-amber-400">MANO IZQUIERDA</h4>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                  Estabilidad: {analysisResult.leftStatus.stabilityScore}/100
                </span>
              </div>

              <div className="text-xs font-mono space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Tipo de Agarre:</span>
                  <span className="text-zinc-100 font-semibold">{analysisResult.leftStatus.graspType}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Riesgo Sobre-extensión:</span>
                  <span className={analysisResult.leftStatus.overextensionRisk ? "text-rose-400" : "text-emerald-400"}>
                    {analysisResult.leftStatus.overextensionRisk ? "ALTO" : "SEGURO"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-normal border-t border-zinc-800/80 pt-2">
                {analysisResult.leftStatus.notes}
              </p>
            </div>

            {/* Mano Derecha */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-bold text-emerald-400">MANO DERECHA</h4>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                  Estabilidad: {analysisResult.rightStatus.stabilityScore}/100
                </span>
              </div>

              <div className="text-xs font-mono space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Tipo de Agarre:</span>
                  <span className="text-zinc-100 font-semibold">{analysisResult.rightStatus.graspType}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Riesgo Sobre-extensión:</span>
                  <span className={analysisResult.rightStatus.overextensionRisk ? "text-rose-400" : "text-emerald-400"}>
                    {analysisResult.rightStatus.overextensionRisk ? "ALTO" : "SEGURO"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-normal border-t border-zinc-800/80 pt-2">
                {analysisResult.rightStatus.notes}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state with explanations */
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-emerald-500/60 mx-auto" />
          <h4 className="text-sm font-semibold text-zinc-200 font-mono">
            Supervisor en Espera de Diagnóstico
          </h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Haz clic en <strong>"Ejecutar Diagnóstico AI"</strong> mientras realizas un agarre frente a la cámara o con el simulador. Gemini evaluará la cinemática articular, determinará el tipo de agarre (pinza de precisión, agarre de fuerza cilíndrico, gancho) y verificará si hay riesgo de tensión excesiva en los tendones de los servos.
          </p>
        </div>
      )}
    </div>
  );
};
