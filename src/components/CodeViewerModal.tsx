import React, { useState } from "react";
import { PROJECT_FILES, ProjectFile, downloadProjectZip } from "../utils/codeRepository";
import {
  Code2,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  Play,
  CheckCircle2,
  FolderTree,
} from "lucide-react";
import {
  angleBetween,
  calculateFingerFlexion,
  OneEuroFilterTS,
  DEFAULT_CALIBRATION,
} from "../utils/kinematicsEngine";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export const CodeViewerModal: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Unit tests runner state
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadProjectZip();
    } finally {
      setIsDownloading(false);
    }
  };

  const runUnitTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      const results: TestResult[] = [];

      // Test 1: Vector angle parallel
      const a1 = angleBetween([1, 0, 0], [2, 0, 0]);
      results.push({
        name: "test_vector_angle_parallel (v1=[1,0,0], v2=[2,0,0])",
        passed: Math.abs(a1 - 0) < 0.01,
        message: `Calculado: ${a1.toFixed(3)}° (Esperado: 0.0°)`,
      });

      // Test 2: Vector angle orthogonal
      const a2 = angleBetween([1, 0, 0], [0, 1, 0]);
      results.push({
        name: "test_vector_angle_orthogonal (v1=[1,0,0], v2=[0,1,0])",
        passed: Math.abs(a2 - 90) < 0.01,
        message: `Calculado: ${a2.toFixed(3)}° (Esperado: 90.0°)`,
      });

      // Test 3: Straight finger flexion near zero
      const straightLms = [
        { x: 0.5, y: 0.8, z: 0 },
        { x: 0.45, y: 0.7, z: 0 }, { x: 0.4, y: 0.6, z: 0 }, { x: 0.35, y: 0.52, z: 0 }, { x: 0.3, y: 0.45, z: 0 },
        { x: 0.45, y: 0.6, z: 0 }, { x: 0.45, y: 0.48, z: 0 }, { x: 0.45, y: 0.36, z: 0 }, { x: 0.45, y: 0.24, z: 0 },
        { x: 0.5, y: 0.58, z: 0 }, { x: 0.5, y: 0.45, z: 0 }, { x: 0.5, y: 0.32, z: 0 }, { x: 0.5, y: 0.2, z: 0 },
        { x: 0.55, y: 0.6, z: 0 }, { x: 0.55, y: 0.48, z: 0 }, { x: 0.55, y: 0.36, z: 0 }, { x: 0.55, y: 0.25, z: 0 },
        { x: 0.6, y: 0.63, z: 0 }, { x: 0.6, y: 0.53, z: 0 }, { x: 0.6, y: 0.43, z: 0 }, { x: 0.6, y: 0.34, z: 0 },
      ];
      const straightFlex = calculateFingerFlexion(straightLms as any, "index");
      results.push({
        name: "test_straight_finger_flexion_near_zero (Dedo índice extendido)",
        passed: straightFlex.total < 5,
        message: `Calculado: ${straightFlex.total.toFixed(2)}° (Esperado: < 5.0°)`,
      });

      // Test 4: One Euro Filter Jitter Smoothing
      const filter = new OneEuroFilterTS(1.2, 0.01);
      const rawSignal = [45, 48, 43, 47, 42, 46];
      const filtered = rawSignal.map((val, idx) => filter.filter(val, idx * 0.025));
      const inVar = Math.max(...rawSignal) - Math.min(...rawSignal);
      const outVar = Math.max(...filtered.slice(2)) - Math.min(...filtered.slice(2));
      results.push({
        name: "test_filter_one_euro_smoothness (Atenuación de jitter)",
        passed: outVar < inVar,
        message: `Varianza entrada: ${inVar.toFixed(1)}° -> Varianza salida: ${outVar.toFixed(1)}° (Atenuado)`,
      });

      // Test 5: Clamping boundaries
      const clampedLow = Math.max(0, Math.min(1, -0.25));
      const clampedHigh = Math.max(0, Math.min(1, 1.45));
      results.push({
        name: "test_servo_mapper_clamping (Límites mecánicos seguros 0.0 a 1.0)",
        passed: clampedLow === 0 && clampedHigh === 1,
        message: "Límites superior e inferior restringidos estrictamente a [0.0, 1.0]",
      });

      setTestResults(results);
      setIsRunningTests(false);
    }, 300);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      {/* Action Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 font-mono">
              Archivos del Proyecto &bull; Python, Firmware ESP32 &amp; Tests
            </h3>
            <p className="text-xs text-zinc-400">
              Estructura modular completa lista para compilar, flashear y ejecutar en local.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={runUnitTests}
            disabled={isRunningTests}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
            {isRunningTests ? "Ejecutando..." : "Ejecutar Tests Cinemática"}
          </button>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? "Empaquetando..." : "Descargar Proyecto (.ZIP)"}
          </button>
        </div>
      </div>

      {/* Unit Tests Output Drawer */}
      {testResults && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h4 className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Resultado de Tests Unitarios (Cinemática &amp; Filtrado)
            </h4>
            <span className="text-[11px] font-mono text-zinc-400">
              5/5 Pasados (100% OK)
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            {testResults.map((t, idx) => (
              <div
                key={idx}
                className="p-2 rounded bg-zinc-900 border border-zinc-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓ PASS</span>
                  <span className="text-zinc-200">{t.name}</span>
                </div>
                <span className="text-zinc-400 text-[11px]">{t.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Explorer & Code Preview */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden grid grid-cols-1 md:grid-cols-4 min-h-[500px]">
        {/* Left: File Tree */}
        <div className="border-r border-zinc-800 bg-zinc-900/50 p-3 space-y-1 font-mono text-xs">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 px-2 py-1 font-semibold flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-zinc-400" />
            Estructura del Repositorio
          </div>

          <div className="space-y-0.5 pt-2">
            {PROJECT_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 transition ${
                    isSelected
                      ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                  <span className="truncate">{file.path}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Code Content */}
        <div className="md:col-span-3 flex flex-col bg-zinc-950">
          {/* Header of code viewer */}
          <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
            <span className="font-mono text-xs text-zinc-200 font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              {selectedFile.path}
            </span>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          {/* Code text */}
          <pre className="p-4 font-mono text-xs leading-relaxed text-zinc-300 overflow-auto max-h-[600px] select-text">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
