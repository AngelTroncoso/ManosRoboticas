import React, { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import {
  LandmarkPoint,
  HandKinematics,
} from "../types/teleop";
import {
  computeHandKinematics,
  generateSyntheticHand,
  FINGER_MAP,
} from "../utils/kinematicsEngine";
import { Camera, CameraOff, RefreshCw, Eye, EyeOff, PlayCircle } from "lucide-react";

interface CameraTrackerProps {
  onKinematicsUpdate: (
    left: HandKinematics | null,
    right: HandKinematics | null,
    previewSnapshot?: string
  ) => void;
  mirrorMode: boolean;
  setMirrorMode: (m: boolean) => void;
  onFpsUpdate: (fps: number) => void;
}

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Pulgar
  [0, 5], [5, 6], [6, 7], [7, 8], // Indice
  [5, 9], [9, 10], [10, 11], [11, 12], // Medio
  [9, 13], [13, 14], [14, 15], [15, 16], // Anular
  [13, 17], [17, 18], [18, 19], [19, 20], // Meñique
  [0, 17], // Base de palma
];

export const CameraTracker: React.FC<CameraTrackerProps> = ({
  onKinematicsUpdate,
  mirrorMode,
  setMirrorMode,
  onFpsUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const [simPose, setSimPose] = useState<"open" | "fist" | "pinch" | "point" | "peace" | "bump" | "clap">("open");
  const [showOverlays, setShowOverlays] = useState(true);

  const reqIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());

  // Initialize MediaPipe Tasks Vision HandLandmarker
  useEffect(() => {
    let isMounted = true;

    async function initMediaPipe() {
      try {
        setIsModelLoading(true);
        setModelError(null);

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );

        if (!isMounted) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        if (isMounted) {
          landmarkerRef.current = landmarker;
          setIsModelLoading(false);
        }
      } catch (err: any) {
        console.error("Error initializing MediaPipe:", err);
        if (isMounted) {
          setModelError(
            "No se pudo cargar el modelo GPU de MediaPipe. Se usará el simulador sintético para validar el pipeline cinemático."
          );
          setIsModelLoading(false);
          setSimulationMode(true);
        }
      }
    }

    initMediaPipe();

    return () => {
      isMounted = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, []);

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        setSimulationMode(false);
      }
    } catch (err: any) {
      console.warn("Camera error:", err);
      setCameraError(
        "No se pudo acceder a la cámara Web (permiso denegado o dispositivo ocupado). Activando generador de cinemática interactivo."
      );
      setSimulationMode(true);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const trackedHandsRef = useRef<{
    left: { x: number; y: number; lastSeen: number } | null;
    right: { x: number; y: number; lastSeen: number } | null;
  }>({ left: null, right: null });

  // Draw overlay landmarks on canvas
  const renderLandmarks = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      landmarks: LandmarkPoint[],
      side: "left" | "right",
      width: number,
      height: number,
      kinematics?: HandKinematics
    ) => {
      const isLeft = side === "left";
      const mainColor = isLeft ? "#f59e0b" : "#10b981"; // Amber for left, Emerald for right
      const textColor = isLeft ? "#fef3c7" : "#d1fae5";

      // Draw connections
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = mainColor;
      for (const [i1, i2] of CONNECTIONS) {
        const p1 = landmarks[i1];
        const p2 = landmarks[i2];
        if (!p1 || !p2) continue;

        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }

      // Draw landmark points
      for (let i = 0; i < landmarks.length; i++) {
        const p = landmarks[i];
        const isTip = [4, 8, 12, 16, 20].includes(i);
        const radius = isTip ? 5 : 3.5;

        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isTip ? "#ffffff" : mainColor;
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw active pinch indicator line if close
      if (landmarks[4] && landmarks[8]) {
        const pThumb = landmarks[4];
        const pIndex = landmarks[8];
        const pinchPxDist = Math.hypot((pThumb.x - pIndex.x) * width, (pThumb.y - pIndex.y) * height);
        if (pinchPxDist < 48) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pThumb.x * width, pThumb.y * height);
          ctx.lineTo(pIndex.x * width, pIndex.y * height);
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw live angle labels on fingertips
      if (kinematics && showOverlays) {
        const tipLabels = [
          { idx: 4, name: "P", deg: Math.round(kinematics.flexions.thumb.total) },
          { idx: 8, name: "I", deg: Math.round(kinematics.flexions.index.total) },
          { idx: 12, name: "M", deg: Math.round(kinematics.flexions.middle.total) },
          { idx: 16, name: "A", deg: Math.round(kinematics.flexions.ring.total) },
          { idx: 20, name: "m", deg: Math.round(kinematics.flexions.pinky.total) },
        ];

        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        for (const item of tipLabels) {
          const pt = landmarks[item.idx];
          if (pt) {
            const px = pt.x * width;
            const py = pt.y * height - 8;
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
            ctx.fillRect(px - 14, py - 9, 28, 11);
            ctx.fillStyle = item.deg > 50 ? mainColor : "#e2e8f0";
            ctx.fillText(`${item.deg}°`, px, py);
          }
        }
      }

      // Draw hand label & joint summary
      const wrist = landmarks[0];
      if (wrist && showOverlays) {
        const wx = wrist.x * width;
        const wy = wrist.y * height;

        ctx.fillStyle = "rgba(10, 10, 12, 0.85)";
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(wx - 55, wy + 12, 110, 52, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = mainColor;
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`MANO ${side.toUpperCase()}`, wx, wy + 26);

        if (kinematics) {
          ctx.fillStyle = textColor;
          ctx.font = "9px monospace";
          const pPercent = Math.round((1 - kinematics.pinchAperture) * 100);
          ctx.fillText(`Pinza: ${pPercent}% | Roll:${kinematics.palmOrientation.roll.toFixed(0)}°`, wx, wy + 39);
          ctx.fillText(`Ind:${kinematics.flexions.index.total.toFixed(0)}° Med:${kinematics.flexions.middle.total.toFixed(0)}°`, wx, wy + 52);
        }
      }
    },
    [showOverlays]
  );

  // Main Detection Loop
  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;

      const now = performance.now();
      frameCountRef.current++;
      if (now - fpsTimerRef.current >= 1000) {
        onFpsUpdate(frameCountRef.current);
        frameCountRef.current = 0;
        fpsTimerRef.current = now;
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");

      if (simulationMode || !isCameraActive) {
        // SIMULATION MODE: Generates clean synthetic hands for instant testing
        if (canvas && ctx) {
          canvas.width = 640;
          canvas.height = 480;
          ctx.fillStyle = "#0c0d10";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Grid pattern
          ctx.strokeStyle = "#1f2229";
          ctx.lineWidth = 1;
          for (let x = 0; x < canvas.width; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }
          for (let y = 0; y < canvas.height; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }

          const t = now / 1000;
          const leftLms = generateSyntheticHand("left", simPose, t);
          const rightLms = generateSyntheticHand("right", simPose, t + 0.5);

          const leftKin = computeHandKinematics(leftLms, "left");
          const rightKin = computeHandKinematics(rightLms, "right");

          renderLandmarks(ctx, leftLms, "left", canvas.width, canvas.height, leftKin);
          renderLandmarks(ctx, rightLms, "right", canvas.width, canvas.height, rightKin);

          // Watermark / Mode badge
          ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
          ctx.font = "bold 12px monospace";
          ctx.textAlign = "left";
          ctx.fillText(`MODO SIMULACIÓN ACTIVO [Pose: ${simPose.toUpperCase()}]`, 16, 28);
          ctx.fillStyle = "#94a3b8";
          ctx.font = "10px monospace";
          ctx.fillText("Generador cinemático de prueba bimanual", 16, 44);

          onKinematicsUpdate(leftKin, rightKin);
        }
      } else if (videoRef.current && canvas && ctx && landmarkerRef.current) {
        const video = videoRef.current;
        if (video.readyState >= 2) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;

          ctx.save();
          if (mirrorMode) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          try {
            const results = landmarkerRef.current.detectForVideo(video, now);
            let leftKin: HandKinematics | null = null;
            let rightKin: HandKinematics | null = null;

            if (results && results.landmarks && results.landmarks.length > 0) {
              // Convert raw landmarks to mirrored/normalized screen coordinates
              const detectedHands = results.landmarks.map((rawLms, idx) => {
                const convertedLms: LandmarkPoint[] = rawLms.map((lm) => ({
                  x: mirrorMode ? 1 - lm.x : lm.x,
                  y: lm.y,
                  z: lm.z,
                }));

                const wrist = convertedLms[0] || { x: 0.5, y: 0.5 };
                const indexMcp = convertedLms[5] || wrist;
                const pinkyMcp = convertedLms[17] || wrist;
                const cx = (wrist.x + indexMcp.x + pinkyMcp.x) / 3;
                const cy = (wrist.y + indexMcp.y + pinkyMcp.y) / 3;

                return {
                  landmarks: convertedLms,
                  center: { x: cx, y: cy },
                  index: idx,
                };
              });

              if (detectedHands.length >= 2) {
                // BIMANUAL COLLISION & CONTACT RESOLUTION:
                // When 2 hands are detected, NEVER overwrite or drop either hand.
                const hA = detectedHands[0];
                const hB = detectedHands[1];

                const prevL = trackedHandsRef.current.left;
                const prevR = trackedHandsRef.current.right;

                let assignAIsLeft = true;

                if (prevL && prevR && now - prevL.lastSeen < 1800 && now - prevR.lastSeen < 1800) {
                  // Temporal tracking: minimize distance from previous known positions
                  const distA_L = Math.hypot(hA.center.x - prevL.x, hA.center.y - prevL.y);
                  const distB_R = Math.hypot(hB.center.x - prevR.x, hB.center.y - prevR.y);
                  const distA_R = Math.hypot(hA.center.x - prevR.x, hA.center.y - prevR.y);
                  const distB_L = Math.hypot(hB.center.x - prevL.x, hB.center.y - prevL.y);

                  assignAIsLeft = distA_L + distB_R <= distA_R + distB_L;
                } else {
                  // Spatial tracking: in mirrored view, user's physical left hand is on left side of screen
                  assignAIsLeft = hA.center.x <= hB.center.x;
                }

                const leftHand = assignAIsLeft ? hA : hB;
                const rightHand = assignAIsLeft ? hB : hA;

                leftKin = computeHandKinematics(leftHand.landmarks, "left");
                rightKin = computeHandKinematics(rightHand.landmarks, "right");

                trackedHandsRef.current.left = { x: leftHand.center.x, y: leftHand.center.y, lastSeen: now };
                trackedHandsRef.current.right = { x: rightHand.center.x, y: rightHand.center.y, lastSeen: now };

                renderLandmarks(ctx, leftHand.landmarks, "left", canvas.width, canvas.height, leftKin);
                renderLandmarks(ctx, rightHand.landmarks, "right", canvas.width, canvas.height, rightKin);

                // Check for physical contact / hands touching (< 0.18 normalized distance)
                const handsDistance = Math.hypot(leftHand.center.x - rightHand.center.x, leftHand.center.y - rightHand.center.y);
                if (handsDistance < 0.20 && showOverlays) {
                  ctx.save();
                  const mx = ((leftHand.center.x + rightHand.center.x) / 2) * canvas.width;
                  const my = ((leftHand.center.y + rightHand.center.y) / 2) * canvas.height;
                  const grad = ctx.createRadialGradient(mx, my, 4, mx, my, 42);
                  grad.addColorStop(0, "rgba(56, 189, 248, 0.45)");
                  grad.addColorStop(1, "rgba(56, 189, 248, 0)");
                  ctx.fillStyle = grad;
                  ctx.beginPath();
                  ctx.arc(mx, my, 42, 0, 2 * Math.PI);
                  ctx.fill();

                  // Touch contact line
                  ctx.strokeStyle = "#38bdf8";
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(leftHand.center.x * canvas.width, leftHand.center.y * canvas.height);
                  ctx.lineTo(rightHand.center.x * canvas.width, rightHand.center.y * canvas.height);
                  ctx.stroke();

                  ctx.fillStyle = "#38bdf8";
                  ctx.font = "bold 10px monospace";
                  ctx.textAlign = "center";
                  ctx.fillText("INTERACCIÓN BIMANUAL", mx, my - 20);
                  ctx.restore();
                }
              } else if (detectedHands.length === 1) {
                // SINGLE HAND RESOLUTION:
                const hand = detectedHands[0];
                const prevL = trackedHandsRef.current.left;
                const prevR = trackedHandsRef.current.right;

                let isLeft = false;
                if (prevL && prevR && now - prevL.lastSeen < 2000 && now - prevR.lastSeen < 2000) {
                  const distL = Math.hypot(hand.center.x - prevL.x, hand.center.y - prevL.y);
                  const distR = Math.hypot(hand.center.x - prevR.x, hand.center.y - prevR.y);
                  isLeft = distL < distR;
                } else if (prevL && now - prevL.lastSeen < 1200) {
                  isLeft = true;
                } else if (prevR && now - prevR.lastSeen < 1200) {
                  isLeft = false;
                } else {
                  isLeft = hand.center.x < 0.5;
                }

                if (isLeft) {
                  leftKin = computeHandKinematics(hand.landmarks, "left");
                  trackedHandsRef.current.left = { x: hand.center.x, y: hand.center.y, lastSeen: now };
                  renderLandmarks(ctx, hand.landmarks, "left", canvas.width, canvas.height, leftKin);
                } else {
                  rightKin = computeHandKinematics(hand.landmarks, "right");
                  trackedHandsRef.current.right = { x: hand.center.x, y: hand.center.y, lastSeen: now };
                  renderLandmarks(ctx, hand.landmarks, "right", canvas.width, canvas.height, rightKin);
                }
              }
            }

            onKinematicsUpdate(leftKin, rightKin);
          } catch (err) {
            // Frame skip
          }
        }
      }

      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (reqIdRef.current) {
        cancelAnimationFrame(reqIdRef.current);
      }
    };
  }, [
    isCameraActive,
    simulationMode,
    simPose,
    mirrorMode,
    onKinematicsUpdate,
    onFpsUpdate,
    renderLandmarks,
  ]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex flex-col">
      {/* Video container */}
      <div className="relative aspect-[4/3] bg-zinc-950 flex items-center justify-center overflow-hidden">
        {/* Hidden video element for MediaPipe stream */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="hidden"
        />

        {/* Live Canvas with Landmarks & Kinematics overlay */}
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
        />

        {/* Model loading overlay */}
        {isModelLoading && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur flex flex-col items-center justify-center p-4 text-center z-20">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
            <p className="text-sm font-semibold text-zinc-100 font-mono">
              Iniciando MediaPipe HandLandmarker Tasks API...
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Descargando bundle de red neuronal WebGL / WASM
            </p>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="p-3 bg-zinc-900/90 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isCameraActive ? (
            <button
              id="btn-start-camera"
              onClick={startCamera}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow transition"
            >
              <Camera className="w-4 h-4" />
              Activar Cámara
            </button>
          ) : (
            <button
              id="btn-stop-camera"
              onClick={stopCamera}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition"
            >
              <CameraOff className="w-4 h-4" />
              Pausar Cámara
            </button>
          )}

          {/* Mirror mode toggle */}
          <button
            id="btn-toggle-mirror"
            onClick={() => setMirrorMode(!mirrorMode)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-mono border transition ${
              mirrorMode
                ? "bg-zinc-800 border-zinc-600 text-zinc-200"
                : "bg-zinc-900 border-zinc-800 text-zinc-500"
            }`}
            title="Efecto espejo para facilitar coordinación viso-motora"
          >
            Espejo: {mirrorMode ? "ON" : "OFF"}
          </button>

          {/* Overlay visibility */}
          <button
            id="btn-toggle-overlay"
            onClick={() => setShowOverlays(!showOverlays)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 border border-zinc-700 transition"
            title={showOverlays ? "Ocultar anotaciones" : "Mostrar anotaciones"}
          >
            {showOverlays ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        {/* Simulation Controls (instant testing) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-zinc-400">Simulador:</span>
          {(["open", "fist", "bump", "clap", "pinch", "point", "peace"] as const).map((pose) => (
            <button
              key={pose}
              id={`btn-pose-${pose}`}
              onClick={() => {
                setSimPose(pose);
                setSimulationMode(true);
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition uppercase ${
                simulationMode && simPose === pose
                  ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-semibold"
                  : "bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
              }`}
            >
              {pose === "open"
                ? "Abierta"
                : pose === "fist"
                ? "Puño"
                : pose === "bump"
                ? "🤜🤛 Choque"
                : pose === "clap"
                ? "🙏 Palmas"
                : pose === "pinch"
                ? "Pinza"
                : pose === "point"
                ? "Índice"
                : "V-Peace"}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner if any */}
      {(cameraError || modelError) && (
        <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
          <span>{cameraError || modelError}</span>
          <button
            onClick={() => {
              setCameraError(null);
              setModelError(null);
            }}
            className="text-amber-200 underline ml-2"
          >
            Entendido
          </button>
        </div>
      )}
    </div>
  );
};
