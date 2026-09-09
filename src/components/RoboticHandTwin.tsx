import React, { useState } from "react";
import { ServoState, FingerAbductions } from "../types/teleop";

interface RoboticHandTwinProps {
  side: "left" | "right";
  servos: ServoState;
  detected: boolean;
  pinchAperture?: number;
  abductions?: FingerAbductions;
  channels: Record<keyof ServoState, number>;
  theme?: "light" | "dark";
}

export const RoboticHandTwin: React.FC<RoboticHandTwinProps> = ({
  side,
  servos,
  detected,
  pinchAperture = 1.0,
  abductions,
  channels,
  theme = "light",
}) => {
  const [viewMode, setViewMode] = useState<"2.5d" | "3d">("2.5d");
  const isLight = theme === "light";
  const isLeft = side === "left";
  const title = isLeft ? "Mano Izquierda (Left Hand)" : "Mano Derecha (Right Hand)";
  const themeColor = isLeft ? "#f59e0b" : "#10b981";

  // Degrees per finger: 0° = extended, 180° = fully curled
  const deg = {
    thumb: Math.round(servos.thumb * 180),
    index: Math.round(servos.index * 180),
    middle: Math.round(servos.middle * 180),
    ring: Math.round(servos.ring * 180),
    pinky: Math.round(servos.pinky * 180),
    wrist: Math.round((servos.wrist - 0.5) * 120), // -60 to +60 deg
  };

  // Convert normalized angle to microsecond pulse (550 - 2450 µs)
  const toUs = (norm: number) => Math.round(550 + norm * (2450 - 550));

  // Visual helper for finger rendering in SVG
  const fingerConfigs = [
    {
      key: "thumb" as const,
      name: "Pulgar",
      bx: isLeft ? 155 : 85,
      by: 160,
      len: 54,
      baseAngle: isLeft ? 42 : -42,
      deg: deg.thumb,
      norm: servos.thumb,
      ch: channels.thumb,
    },
    {
      key: "index" as const,
      name: "Índice",
      bx: isLeft ? 140 : 100,
      by: 125,
      len: 76,
      baseAngle: isLeft ? 12 : -12,
      deg: deg.index,
      norm: servos.index,
      ch: channels.index,
    },
    {
      key: "middle" as const,
      name: "Medio",
      bx: 120,
      by: 115,
      len: 84,
      baseAngle: 0,
      deg: deg.middle,
      norm: servos.middle,
      ch: channels.middle,
    },
    {
      key: "ring" as const,
      name: "Anular",
      bx: isLeft ? 100 : 140,
      by: 125,
      len: 75,
      baseAngle: isLeft ? -10 : 10,
      deg: deg.ring,
      norm: servos.ring,
      ch: channels.ring,
    },
    {
      key: "pinky" as const,
      name: "Meñique",
      bx: isLeft ? 82 : 158,
      by: 140,
      len: 62,
      baseAngle: isLeft ? -22 : 22,
      deg: deg.pinky,
      norm: servos.pinky,
      ch: channels.pinky,
    },
  ];

  const isPinching = pinchAperture < 0.25;

  // Estimated PCA9685 + Servo Bank Current (mA)
  const currentMa = Math.round(
    95 +
      (servos.thumb + servos.index + servos.middle + servos.ring + servos.pinky) * 110 +
      Math.abs(servos.wrist - 0.5) * 70
  );
  const isHighLoad = currentMa > 560;

  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden shadow-lg transition-colors duration-200 ${
        isLight
          ? "border-slate-300 bg-white shadow-md"
          : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-2.5 border-b flex items-center justify-between transition-colors duration-200 ${
          isLight ? "bg-slate-100 border-slate-200" : "bg-zinc-950 border-zinc-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full transition-colors duration-200"
            style={{ backgroundColor: detected ? themeColor : isLight ? "#cbd5e1" : "#52525b" }}
          />
          <h3
            className={`text-xs font-bold uppercase tracking-wider font-mono ${
              isLight ? "text-slate-900" : "text-zinc-200"
            }`}
          >
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Virtual Current Load Meter */}
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${
              isHighLoad
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse font-bold"
                : isLight
                ? "bg-slate-200 text-slate-700 border-slate-300"
                : "bg-zinc-800/80 text-zinc-400 border-zinc-700"
            }`}
            title="Consumo eléctrico estimado del banco de servos PCA9685"
          >
            ⚡ {currentMa} mA
          </span>

          {/* View mode toggle */}
          <button
            onClick={() => setViewMode((m) => (m === "2.5d" ? "3d" : "2.5d"))}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              isLight
                ? "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
                : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
            }`}
            title="Cambiar perspectiva de visualización"
          >
            {viewMode === "2.5d" ? "2.5D CABLES" : "3D ISOMÉTRICO"}
          </button>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
              detected
                ? isLight
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : isLight
                ? "bg-slate-200 text-slate-500 border-slate-300"
                : "bg-zinc-800 text-zinc-500 border-zinc-700"
            }`}
          >
            {detected ? "ACTIVO" : "EN ESPERA"}
          </span>
          {isPinching && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border animate-pulse font-bold ${
                isLight
                  ? "bg-cyan-100 text-cyan-800 border-cyan-300"
                  : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
              }`}
            >
              PINZA
            </span>
          )}
        </div>
      </div>

      {/* Interactive Kinematic SVG Twin */}
      <div
        className={`relative p-3 flex items-center justify-center min-h-[290px] border-b transition-colors duration-200 ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950/80 border-zinc-800"
        }`}
        style={
          isLight
            ? {
                backgroundImage: "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)",
                backgroundSize: "16px 16px",
              }
            : {}
        }
      >
        <svg
          viewBox="0 0 240 280"
          className="w-full max-w-[280px] h-auto select-none"
          style={{
            transform: `rotate(${deg.wrist * 0.4}deg)`,
            transition: "transform 0.08s ease-out",
          }}
        >
          <defs>
            {/* Metal chassis gradient */}
            <linearGradient id={`chassis-${side}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={isLight ? "#334155" : "#27272a"} />
              <stop offset="50%" stopColor={isLight ? "#1e293b" : "#18181b"} />
              <stop offset="100%" stopColor={isLight ? "#0f172a" : "#09090b"} />
            </linearGradient>

            {/* Glowing finger joint gradient */}
            <linearGradient id={`joint-${side}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={isLight ? "#64748b" : "#3f3f46"} />
            </linearGradient>

            <filter id={`glow-${side}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Wrist Joint / Servo Base */}
          <g id="wrist-servo">
            <rect
              x="85"
              y="232"
              width="70"
              height="38"
              rx="6"
              fill={isLight ? "#1e293b" : "#18181b"}
              stroke={isLight ? "#0f172a" : "#3f3f46"}
              strokeWidth="2"
            />
            {/* Servo gear wheel */}
            <circle cx="120" cy="246" r="12" fill={isLight ? "#334155" : "#27272a"} stroke={themeColor} strokeWidth="2" />
            <line
              x1="120"
              y1="234"
              x2="120"
              y2="258"
              stroke={themeColor}
              strokeWidth="2.5"
              transform={`rotate(${deg.wrist}, 120, 246)`}
            />
            <text
              x="120"
              y="266"
              textAnchor="middle"
              fill={isLight ? "#cbd5e1" : "#a1a1aa"}
              fontSize="7.5"
              fontFamily="monospace"
            >
              MUÑECA: {deg.wrist > 0 ? `+${deg.wrist}` : deg.wrist}°
            </text>
          </g>

          {/* Palm Chassis (CNC Aluminum / 3D Printed plate) */}
          <path
            d={
              isLeft
                ? "M 80 145 L 85 230 L 155 230 L 165 160 L 150 125 L 90 125 Z"
                : "M 75 160 L 85 230 L 155 230 L 160 145 L 150 125 L 90 125 Z"
            }
            fill={`url(#chassis-${side})`}
            stroke={isLight ? "#0f172a" : "#3f3f46"}
            strokeWidth="2"
          />

          {/* Chassis bolts & servo spools */}
          <circle cx="95" cy="215" r="2.5" fill={isLight ? "#94a3b8" : "#52525b"} />
          <circle cx="145" cy="215" r="2.5" fill={isLight ? "#94a3b8" : "#52525b"} />
          <circle cx="120" cy="180" r="14" fill={isLight ? "#0f172a" : "#18181b"} stroke={isLight ? "#334155" : "#3f3f46"} strokeWidth="1.5" />
          <text
            x="120"
            y="183"
            textAnchor="middle"
            fill={isLight ? "#cbd5e1" : "#71717a"}
            fontSize="7"
            fontFamily="monospace"
          >
            PCA9685
          </text>

          {/* Internal Servo Tendon Pulley Spool */}
          <circle cx="120" cy="202" r="5" fill={isLight ? "#334155" : "#27272a"} stroke={themeColor} strokeWidth="1.5" />

          {/* Render Articulated Fingers */}
          {fingerConfigs.map((f) => {
            const norm = f.norm; // 0.0 (straight) to 1.0 (fully bent fist)

            let p1x = 0;
            let p1y = 0;
            let p2x = 0;
            let p2y = 0;
            let p3x = 0;
            let p3y = 0;

            if (f.key === "thumb") {
              // Thumb kinematics: opposes and folds across the palm
              const baseRad = (f.baseAngle * Math.PI) / 180;
              const extLen1 = 20;
              const extLen2 = 18;
              const extLen3 = 16;

              // When straight (norm = 0)
              const extP1x = f.bx + Math.sin(baseRad) * extLen1;
              const extP1y = f.by - Math.cos(baseRad) * extLen1;
              const extP2x = extP1x + Math.sin(baseRad) * extLen2;
              const extP2y = extP1y - Math.cos(baseRad) * extLen2;
              const extP3x = extP2x + Math.sin(baseRad) * extLen3;
              const extP3y = extP2y - Math.cos(baseRad) * extLen3;

              // When fully curled (norm = 1): folds into palm center (120, 160)
              const curledP1x = f.bx + (isLeft ? -10 : 10);
              const curledP1y = f.by - 4;
              const curledP2x = curledP1x + (isLeft ? -18 : 18);
              const curledP2y = curledP1y - 2;
              const curledP3x = isLeft ? 122 : 118;
              const curledP3y = 158;

              p1x = extP1x * (1 - norm) + curledP1x * norm;
              p1y = extP1y * (1 - norm) + curledP1y * norm;
              p2x = extP2x * (1 - norm) + curledP2x * norm;
              p2y = extP2y * (1 - norm) + curledP2y * norm;
              p3x = extP3x * (1 - norm) + curledP3x * norm;
              p3y = extP3y * (1 - norm) + curledP3y * norm;

              if (viewMode === "3d") {
                // Apply 3D isometric depth projection
                const zOffset = norm * 26;
                p1x += (isLeft ? 1 : -1) * (zOffset * 0.3);
                p1y -= zOffset * 0.4;
                p2x += (isLeft ? 1 : -1) * (zOffset * 0.5);
                p2y -= zOffset * 0.6;
                p3x += (isLeft ? 1 : -1) * (zOffset * 0.7);
                p3y -= zOffset * 0.8;
              }
            } else {
              // Standard fingers (Index, Middle, Ring, Pinky)
              // Real 3-phalanx folding mechanics:
              // Segment lengths
              const l1 = f.len * 0.40;
              const l2 = f.len * 0.34;
              const l3 = f.len * 0.28;

              const baseRad = (f.baseAngle * Math.PI) / 180;

              // MCP Knuckle bends forward and down into palm
              // In 2D projection, the phalanx foreshortens as it bends forward
              const mcpForeshorten = Math.cos(norm * 1.3); // foreshortening
              const p1Len = l1 * (0.35 + 0.65 * mcpForeshorten);
              const p1Angle = baseRad * (1 - norm * 0.4);

              p1x = f.bx + Math.sin(p1Angle) * p1Len;
              // Knuckle bends down towards palm plate
              p1y = f.by - Math.cos(p1Angle) * p1Len + norm * 10;

              // PIP Joint folds sharply toward palm center
              const pipForeshorten = Math.cos(norm * 1.45);
              const p2Len = l2 * (0.25 + 0.75 * pipForeshorten);
              // As finger bends, intermediate phalanx folds downwards
              const p2Angle = p1Angle + (isLeft ? -1 : 1) * (norm * 0.4);
              p2x = p1x + Math.sin(p2Angle) * p2Len;
              p2y = p1y - Math.cos(p2Angle) * p2Len + norm * 26;

              // DIP Joint curls inward: at norm = 1, tip presses onto the palm pad near knuckle!
              const straightP3x = p2x + Math.sin(p2Angle) * l3;
              const straightP3y = p2y - Math.cos(p2Angle) * l3;

              // Curled tip sits snugly on palm chassis
              const curledP3x = f.bx + (120 - f.bx) * 0.12;
              const curledP3y = f.by + 12;

              p3x = straightP3x * (1 - norm) + curledP3x * norm;
              p3y = straightP3y * (1 - norm) + curledP3y * norm;

              if (viewMode === "3d") {
                // 3D Isometric projection: bring curled joints forward towards camera
                const zDepth = norm * 35;
                p1x += (f.bx - 120) * 0.15 * norm;
                p1y -= zDepth * 0.35;
                p2x += (f.bx - 120) * 0.25 * norm;
                p2y -= zDepth * 0.65;
                p3x += (f.bx - 120) * 0.35 * norm;
                p3y -= zDepth * 0.85;
              }
            }

            const isCurled = f.deg > 65;
            const segmentColor = isCurled ? themeColor : "#71717a";

            return (
              <g key={f.key} id={`finger-${side}-${f.key}`}>
                {/* Active Tendon Line: Runs from internal palm servo spool to fingertip */}
                <path
                  d={`M 120 202 Q ${(f.bx + 120) / 2} ${(f.by + 202) / 2} ${f.bx} ${f.by} L ${p1x} ${p1y} L ${p2x} ${p2y} L ${p3x} ${p3y}`}
                  stroke={norm > 0.15 ? themeColor : "#3f3f46"}
                  strokeWidth={1.2 + norm * 1.8}
                  strokeDasharray={norm > 0.05 ? "3 2" : "none"}
                  fill="none"
                  opacity={0.4 + norm * 0.6}
                />

                {/* Finger mechanical segments */}
                {/* Phalanx 1 (MCP to PIP) */}
                <line
                  x1={f.bx}
                  y1={f.by}
                  x2={p1x}
                  y2={p1y}
                  stroke="#3f3f46"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <line
                  x1={f.bx}
                  y1={f.by}
                  x2={p1x}
                  y2={p1y}
                  stroke="#52525b"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                {/* Phalanx 2 (PIP to DIP) */}
                <line
                  x1={p1x}
                  y1={p1y}
                  x2={p2x}
                  y2={p2y}
                  stroke="#27272a"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                />
                <line
                  x1={p1x}
                  y1={p1y}
                  x2={p2x}
                  y2={p2y}
                  stroke="#3f3f46"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Phalanx 3 (DIP to TIP) */}
                <line
                  x1={p2x}
                  y1={p2y}
                  x2={p3x}
                  y2={p3y}
                  stroke="#18181b"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <line
                  x1={p2x}
                  y1={p2y}
                  x2={p3x}
                  y2={p3y}
                  stroke={segmentColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* MCP Joint Pin */}
                <circle cx={f.bx} cy={f.by} r="5" fill="#18181b" stroke={segmentColor} strokeWidth="1.8" />
                <circle cx={f.bx} cy={f.by} r="2" fill="#71717a" />

                {/* PIP Joint Pin */}
                <circle cx={p1x} cy={p1y} r="4" fill="#18181b" stroke={segmentColor} strokeWidth="1.5" />
                <circle cx={p1x} cy={p1y} r="1.5" fill="#a1a1aa" />

                {/* DIP Joint Pin */}
                <circle cx={p2x} cy={p2y} r="3.5" fill="#18181b" stroke={segmentColor} strokeWidth="1.2" />

                {/* Fingertip Rubber Pad */}
                <circle
                  cx={p3x}
                  cy={p3y}
                  r={norm > 0.7 ? "4.5" : "3.5"}
                  fill={segmentColor}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                />

                {/* Contact Pad Glow when fully gripped */}
                {norm > 0.8 && (
                  <circle
                    cx={p3x}
                    cy={p3y}
                    r="8"
                    fill="none"
                    stroke={themeColor}
                    strokeWidth="1.5"
                    opacity="0.8"
                    className="animate-pulse"
                  />
                )}

                {/* Real-time Angle label at tip */}
                <g>
                  <rect
                    x={p3x - 14}
                    y={p3y - 15}
                    width="28"
                    height="10"
                    rx="3"
                    fill="rgba(9, 9, 11, 0.85)"
                    stroke={segmentColor}
                    strokeWidth="0.5"
                  />
                  <text
                    x={p3x}
                    y={p3y - 8}
                    textAnchor="middle"
                    fill="#f4f4f5"
                    fontSize="6.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {f.deg}°
                  </text>
                </g>
              </g>
            );
          })}

          {/* Pinch contact spark if active */}
          {isPinching && (
            <circle
              cx={isLeft ? 135 : 105}
              cy={145}
              r="7"
              fill="#22d3ee"
              opacity="0.85"
              className="animate-ping"
            />
          )}
        </svg>
      </div>

      {/* Per-Servo Meters (0-180° / Microseconds / Clamping) */}
      <div
        className={`p-3 border-t space-y-2 transition-colors duration-200 ${
          isLight ? "bg-white border-slate-200" : "bg-zinc-900 border-zinc-800"
        }`}
      >
        {fingerConfigs.map((f) => {
          const us = toUs(f.norm);
          const percent = Math.round(f.norm * 100);
          return (
            <div key={f.key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span
                  className={`flex items-center gap-1.5 ${
                    isLight ? "text-slate-800 font-medium" : "text-zinc-300"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLight ? "bg-slate-400" : "bg-zinc-600"
                    }`}
                  />
                  {f.name}
                  <span className={isLight ? "text-slate-500 text-[9px]" : "text-zinc-500 text-[9px]"}>
                    (CH {f.ch})
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <span className={isLight ? "text-slate-500 text-[10px]" : "text-zinc-400 text-[10px]"}>
                    {us} µs
                  </span>
                  <span className={`font-semibold ${isLight ? "text-slate-900" : "text-zinc-100"}`}>
                    {f.deg}°
                  </span>
                  <span className={isLight ? "text-[10px] text-slate-500" : "text-[10px] text-zinc-500"}>
                    ({percent}%)
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div
                className={`h-1.5 w-full rounded-full overflow-hidden ${
                  isLight ? "bg-slate-200" : "bg-zinc-800"
                }`}
              >
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: themeColor,
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* Wrist row */}
        <div
          className={`space-y-1 pt-1 border-t ${
            isLight ? "border-slate-200" : "border-zinc-800/80"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span
              className={`flex items-center gap-1.5 ${
                isLight ? "text-slate-800 font-medium" : "text-zinc-300"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLight ? "bg-slate-400" : "bg-zinc-600"
                }`}
              />
              Muñeca (Rotación)
              <span className={isLight ? "text-slate-500 text-[9px]" : "text-zinc-500 text-[9px]"}>
                (CH {channels.wrist})
              </span>
            </span>
            <div className="flex items-center gap-2">
              <span className={isLight ? "text-slate-500 text-[10px]" : "text-zinc-400 text-[10px]"}>
                {toUs(servos.wrist)} µs
              </span>
              <span className={`font-semibold ${isLight ? "text-slate-900" : "text-zinc-100"}`}>
                {deg.wrist}°
              </span>
            </div>
          </div>
          <div
            className={`h-1.5 w-full rounded-full overflow-hidden ${
              isLight ? "bg-slate-200" : "bg-zinc-800"
            }`}
          >
            <div
              className="h-full rounded-full transition-all duration-75 bg-indigo-500"
              style={{ width: `${Math.round(servos.wrist * 100)}%` }}
            />
          </div>
        </div>

        {/* Finger Abductions (Lateral Spread Angles) */}
        {abductions && (
          <div
            className={`pt-2 border-t flex items-center justify-between text-[10px] font-mono ${
              isLight ? "border-slate-200 text-slate-600" : "border-zinc-800/80 text-zinc-400"
            }`}
          >
            <span className="font-semibold text-[9px] uppercase tracking-wider">Abducción:</span>
            <span>T-I: {Math.round(abductions.thumbIndex)}°</span>
            <span>I-M: {Math.round(abductions.indexMiddle)}°</span>
            <span>M-R: {Math.round(abductions.middleRing)}°</span>
            <span>R-P: {Math.round(abductions.ringPinky)}°</span>
          </div>
        )}
      </div>
    </div>
  );
};
