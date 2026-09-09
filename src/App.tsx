import React, { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { CameraTracker } from "./components/CameraTracker";
import { RoboticHandTwin } from "./components/RoboticHandTwin";
import { Bimanual3DStage } from "./components/Bimanual3DStage";
import { ServoTelemetry } from "./components/ServoTelemetry";
import { CalibrationModal } from "./components/CalibrationModal";
import { HardwareConfigModal, HARDWARE_PRESETS } from "./components/HardwareConfigModal";
import { GeminiSupervisor } from "./components/GeminiSupervisor";
import { CodeViewerModal } from "./components/CodeViewerModal";
import { MacroRecorderModal } from "./components/MacroRecorderModal";
import { WiFiConnectModal } from "./components/WiFiConnectModal";
import {
  Move3d,
  Layers,
  Cpu,
  Sun,
  Moon,
  Film,
  Wifi,
  Lock,
  Unlock,
  Shield,
  FileSpreadsheet,
} from "lucide-react";
import {
  HandKinematics,
  ServoState,
  TeleopPacket,
  UserCalibrationProfile,
  HandHardwareProfile,
} from "./types/teleop";
import {
  HandFilterBankTS,
  SlewRateBank,
  DEFAULT_CALIBRATION,
  normalizeServoAngles,
} from "./utils/kinematicsEngine";
import { downloadProjectZip } from "./utils/codeRepository";

export function App() {
  const [activeTab, setActiveTab] = useState<
    "teleop" | "calibration" | "hardware" | "supervisor" | "code"
  >("teleop");

  // Metrics
  const [fps, setFps] = useState<number>(30);
  const [latencyMs, setLatencyMs] = useState<number>(45);
  const [txRateHz, setTxRateHz] = useState<number>(40);
  const [packetsSent, setPacketsSent] = useState<number>(0);
  const [packetsDropped, setPacketsDropped] = useState<number>(0);

  // Settings
  const [mirrorMode, setMirrorMode] = useState<boolean>(true);
  const [hardwareProfile, setHardwareProfile] = useState<HandHardwareProfile>(
    HARDWARE_PRESETS[0] // InMoov 6-DOF default
  );
  const [calibration, setCalibration] = useState<UserCalibrationProfile>(DEFAULT_CALIBRATION);
  const [viewMode, setViewMode] = useState<"servo_cards" | "3d_stage" | "split">("servo_cards");
  const [stageTheme, setStageTheme] = useState<"light" | "dark">("light");

  // Kinematics & Servo States
  const [leftKinematics, setLeftKinematics] = useState<HandKinematics | null>(null);
  const [rightKinematics, setRightKinematics] = useState<HandKinematics | null>(null);

  const [leftServos, setLeftServos] = useState<ServoState>({
    thumb: 0.1,
    index: 0.1,
    middle: 0.1,
    ring: 0.1,
    pinky: 0.1,
    wrist: 0.5,
  });

  const [rightServos, setRightServos] = useState<ServoState>({
    thumb: 0.1,
    index: 0.1,
    middle: 0.1,
    ring: 0.1,
    pinky: 0.1,
    wrist: 0.5,
  });

  const [lastPacketLeft, setLastPacketLeft] = useState<TeleopPacket | null>(null);
  const [lastPacketRight, setLastPacketRight] = useState<TeleopPacket | null>(null);

  // Connectivity
  const [isConnectedWS, setIsConnectedWS] = useState<boolean>(false);
  const [isConnectedSerial, setIsConnectedSerial] = useState<boolean>(false);
  const serialPortRef = useRef<any>(null);
  const serialWriterRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ESP32 Direct WiFi WebSocket
  const [isWiFiModalOpen, setIsWiFiModalOpen] = useState(false);
  const [isConnectedEspWiFi, setIsConnectedEspWiFi] = useState(false);
  const [espWsUrl, setEspWsUrl] = useState("ws://192.168.4.1:81");
  const espWsRef = useRef<WebSocket | null>(null);

  // Advanced Teleoperation Controls
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [playbackLeft, setPlaybackLeft] = useState<ServoState | null>(null);
  const [playbackRight, setPlaybackRight] = useState<ServoState | null>(null);
  const [slewRateEnabled, setSlewRateEnabled] = useState(true);
  const [pinchLockActive, setPinchLockActive] = useState(false);

  // Slew & Filter banks
  const filterBanks = useRef<{ left: HandFilterBankTS; right: HandFilterBankTS }>({
    left: new HandFilterBankTS(),
    right: new HandFilterBankTS(),
  });

  const slewBanks = useRef<{ left: SlewRateBank; right: SlewRateBank }>({
    left: new SlewRateBank(2.8),
    right: new SlewRateBank(2.8),
  });

  const seqCounterRef = useRef<number>(0);
  const lastTxTimeRef = useRef<number>(0);
  const lastSeenRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });

  // Connect to ESP32 WiFi WebSocket
  const handleConnectEspWiFi = (url: string) => {
    try {
      setEspWsUrl(url);
      if (espWsRef.current) espWsRef.current.close();
      const ws = new WebSocket(url);
      ws.onopen = () => {
        setIsConnectedEspWiFi(true);
      };
      ws.onclose = () => {
        setIsConnectedEspWiFi(false);
      };
      ws.onerror = () => {
        setIsConnectedEspWiFi(false);
      };
      espWsRef.current = ws;
    } catch (e) {
      console.warn("Failed to connect to ESP32 WiFi WebSocket:", e);
      setIsConnectedEspWiFi(false);
    }
  };

  const handleDisconnectEspWiFi = () => {
    if (espWsRef.current) {
      espWsRef.current.close();
      espWsRef.current = null;
    }
    setIsConnectedEspWiFi(false);
  };

  // Connect WebSocket to local server hub
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    let ws: WebSocket;
    let reconnectTimeout: any;

    function connect() {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnectedWS(true);
        };

        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === "pong" && data.clientTs) {
              const rtt = Date.now() - data.clientTs;
              setLatencyMs((prev) => prev * 0.7 + rtt * 0.3);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          setIsConnectedWS(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setIsConnectedWS(false);
        };
      } catch (err) {
        setIsConnectedWS(false);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // WebSerial Direct USB Connection for ESP32
  const connectSerial = async () => {
    if (!("serial" in navigator)) {
      alert("La WebSerial API requiere Google Chrome o Microsoft Edge.");
      return;
    }

    try {
      if (isConnectedSerial && serialPortRef.current) {
        if (serialWriterRef.current) {
          await serialWriterRef.current.close();
          serialWriterRef.current = null;
        }
        await serialPortRef.current.close();
        serialPortRef.current = null;
        setIsConnectedSerial(false);
        return;
      }

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      serialWriterRef.current = textEncoder.writable.getWriter();
      serialPortRef.current = port;
      setIsConnectedSerial(true);
    } catch (err) {
      console.warn("Serial connection canceled or failed:", err);
      setIsConnectedSerial(false);
    }
  };

  // Process incoming kinematics from CameraTracker or Simulator
  const handleKinematicsUpdate = useCallback(
    (left: HandKinematics | null, right: HandKinematics | null) => {
      const now = performance.now();
      const intervalMs = 1000 / txRateHz;

      setLeftKinematics(left);
      setRightKinematics(right);

      // Apply filtering & normalization
      let currentLeftServos = leftServos;
      let currentRightServos = rightServos;
      const ts = now / 1000;

      if (playbackLeft) {
        currentLeftServos = playbackLeft;
        setLeftServos(playbackLeft);
      } else if (left) {
        lastSeenRef.current.left = now;
        const rawNorm = normalizeServoAngles(left, calibration);

        // Pinch Lock gesture hold
        if (pinchLockActive) {
          rawNorm.thumb = 0.95;
          rawNorm.index = 0.95;
        }

        // Apply 1-Euro adaptive filter: smooth stillness + zero-latency tracking
        let norm: ServoState = {
          thumb: filterBanks.current.left.filter("thumb", rawNorm.thumb, ts),
          index: filterBanks.current.left.filter("index", rawNorm.index, ts),
          middle: filterBanks.current.left.filter("middle", rawNorm.middle, ts),
          ring: filterBanks.current.left.filter("ring", rawNorm.ring, ts),
          pinky: filterBanks.current.left.filter("pinky", rawNorm.pinky, ts),
          wrist: filterBanks.current.left.filter("wrist", rawNorm.wrist, ts),
        };

        // Apply Slew Rate Limiter (servomechanism protection)
        if (slewRateEnabled) {
          norm = {
            thumb: slewBanks.current.left.limit("thumb", norm.thumb, ts),
            index: slewBanks.current.left.limit("index", norm.index, ts),
            middle: slewBanks.current.left.limit("middle", norm.middle, ts),
            ring: slewBanks.current.left.limit("ring", norm.ring, ts),
            pinky: slewBanks.current.left.limit("pinky", norm.pinky, ts),
            wrist: slewBanks.current.left.limit("wrist", norm.wrist, ts),
          };
        }

        // Apply hardware inversions if set
        const finalLeft: ServoState = {
          thumb: hardwareProfile.servosLeft.thumb.inverted ? 1 - norm.thumb : norm.thumb,
          index: hardwareProfile.servosLeft.index.inverted ? 1 - norm.index : norm.index,
          middle: hardwareProfile.servosLeft.middle.inverted ? 1 - norm.middle : norm.middle,
          ring: hardwareProfile.servosLeft.ring.inverted ? 1 - norm.ring : norm.ring,
          pinky: hardwareProfile.servosLeft.pinky.inverted ? 1 - norm.pinky : norm.pinky,
          wrist: hardwareProfile.servosLeft.wrist.inverted ? 1 - norm.wrist : norm.wrist,
        };
        currentLeftServos = finalLeft;
        setLeftServos(finalLeft);
      }

      if (playbackRight) {
        currentRightServos = playbackRight;
        setRightServos(playbackRight);
      } else if (right) {
        lastSeenRef.current.right = now;
        const rawNorm = normalizeServoAngles(right, calibration);

        // Pinch Lock gesture hold
        if (pinchLockActive) {
          rawNorm.thumb = 0.95;
          rawNorm.index = 0.95;
        }

        let norm: ServoState = {
          thumb: filterBanks.current.right.filter("thumb", rawNorm.thumb, ts),
          index: filterBanks.current.right.filter("index", rawNorm.index, ts),
          middle: filterBanks.current.right.filter("middle", rawNorm.middle, ts),
          ring: filterBanks.current.right.filter("ring", rawNorm.ring, ts),
          pinky: filterBanks.current.right.filter("pinky", rawNorm.pinky, ts),
          wrist: filterBanks.current.right.filter("wrist", rawNorm.wrist, ts),
        };

        // Apply Slew Rate Limiter (servomechanism protection)
        if (slewRateEnabled) {
          norm = {
            thumb: slewBanks.current.right.limit("thumb", norm.thumb, ts),
            index: slewBanks.current.right.limit("index", norm.index, ts),
            middle: slewBanks.current.right.limit("middle", norm.middle, ts),
            ring: slewBanks.current.right.limit("ring", norm.ring, ts),
            pinky: slewBanks.current.right.limit("pinky", norm.pinky, ts),
            wrist: slewBanks.current.right.limit("wrist", norm.wrist, ts),
          };
        }

        const finalRight: ServoState = {
          thumb: hardwareProfile.servosRight.thumb.inverted ? 1 - norm.thumb : norm.thumb,
          index: hardwareProfile.servosRight.index.inverted ? 1 - norm.index : norm.index,
          middle: hardwareProfile.servosRight.middle.inverted ? 1 - norm.middle : norm.middle,
          ring: hardwareProfile.servosRight.ring.inverted ? 1 - norm.ring : norm.ring,
          pinky: hardwareProfile.servosRight.pinky.inverted ? 1 - norm.pinky : norm.pinky,
          wrist: hardwareProfile.servosRight.wrist.inverted ? 1 - norm.wrist : norm.wrist,
        };
        currentRightServos = finalRight;
        setRightServos(finalRight);
      }

      // Rate-limited network transmission (30-50Hz)
      if (now - lastTxTimeRef.current >= intervalMs) {
        lastTxTimeRef.current = now;

        const transmitHand = (side: "left" | "right", kin: HandKinematics | null, servos: ServoState) => {
          seqCounterRef.current++;
          const packet: TeleopPacket = {
            v: "1.0",
            seq: seqCounterRef.current,
            ts: Math.round(Date.now() / 10) / 100,
            hand: side,
            servos: {
              thumb: Number(servos.thumb.toFixed(3)),
              index: Number(servos.index.toFixed(3)),
              middle: Number(servos.middle.toFixed(3)),
              ring: Number(servos.ring.toFixed(3)),
              pinky: Number(servos.pinky.toFixed(3)),
              wrist: Number(servos.wrist.toFixed(3)),
            },
            pinch: kin ? Number(kin.pinchAperture.toFixed(3)) : undefined,
          };

          if (side === "left") setLastPacketLeft(packet);
          else setLastPacketRight(packet);

          setPacketsSent((c) => c + 1);

          // Send via WebSocket hub if open
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(packet));
          }

          // Send via Direct ESP32 WiFi WebSocket if open
          if (espWsRef.current && espWsRef.current.readyState === WebSocket.OPEN) {
            espWsRef.current.send(JSON.stringify(packet));
          }

          // Send via USB Serial if connected
          if (serialWriterRef.current) {
            serialWriterRef.current.write(JSON.stringify(packet) + "\n").catch(() => {});
          }
        };

        if (left || playbackLeft) transmitHand("left", left, currentLeftServos);
        if (right || playbackRight) transmitHand("right", right, currentRightServos);
      }
    },
    [txRateHz, calibration, hardwareProfile, playbackLeft, playbackRight, pinchLockActive, slewRateEnabled]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fps={fps}
        latencyMs={latencyMs}
        txRateHz={txRateHz}
        isConnectedWS={isConnectedWS}
        isConnectedSerial={isConnectedSerial}
        onConnectSerial={connectSerial}
        onDownloadZip={downloadProjectZip}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === "teleop" && (
          <div className="space-y-6">
            {/* Top Workspace Grid: Camera Tracker on Left, Twin Hands on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Camera / MediaPipe Input (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <CameraTracker
                  onKinematicsUpdate={handleKinematicsUpdate}
                  mirrorMode={mirrorMode}
                  setMirrorMode={setMirrorMode}
                  onFpsUpdate={setFps}
                />
              </div>

              {/* Right Column: Robotic Digital Twins & 3D Stage (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Advanced Teleoperation Toolbar */}
                <div className="flex flex-wrap items-center justify-between bg-zinc-900/60 border border-zinc-800/80 px-3 py-2 rounded-xl gap-2 text-xs font-mono shadow-sm">
                  <div className="flex items-center gap-2">
                    {/* Macro Recording Button */}
                    <button
                      id="btn-open-macro-recorder"
                      onClick={() => setIsMacroModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-medium transition"
                      title="Grabar, reproducir y exportar rutinas bimanuales a Arduino C++ PROGMEM o CSV"
                    >
                      <Film className="w-3.5 h-3.5 text-purple-400" />
                      <span>Grabar Macro</span>
                    </button>

                    {/* WiFi ESP32 Modal Trigger */}
                    <button
                      id="btn-open-wifi-modal"
                      onClick={() => setIsWiFiModalOpen(true)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium transition ${
                        isConnectedEspWiFi
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                      }`}
                      title="Configuración de conexión WebSocket directa por WiFi a la ESP32"
                    >
                      <Wifi className={`w-3.5 h-3.5 ${isConnectedEspWiFi ? "text-emerald-400" : "text-zinc-400"}`} />
                      <span>{isConnectedEspWiFi ? "WiFi ESP32: Conectado" : "WiFi ESP32"}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Pinch Lock (Agarre Fijo) Toggle */}
                    <button
                      id="btn-toggle-pinch-lock"
                      onClick={() => setPinchLockActive(!pinchLockActive)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-medium transition ${
                        pinchLockActive
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-semibold"
                          : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                      }`}
                      title="Mantiene bloqueada la pinza para sostener objetos sin fatiga en la mano humana"
                    >
                      {pinchLockActive ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pinza: Bloqueada</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Pinza: Libre</span>
                        </>
                      )}
                    </button>

                    {/* Slew Rate Protection Toggle */}
                    <button
                      id="btn-toggle-slew-protection"
                      onClick={() => setSlewRateEnabled(!slewRateEnabled)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-medium transition ${
                        slewRateEnabled
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : "bg-zinc-950 text-zinc-500 border-zinc-800"
                      }`}
                      title="Protección de aceleración mecánica (S-Curve) para evitar tirones en los engranajes"
                    >
                      <Shield className={`w-3.5 h-3.5 ${slewRateEnabled ? "text-emerald-400" : "text-zinc-500"}`} />
                      <span>S-Curve: {slewRateEnabled ? "ON" : "OFF"}</span>
                    </button>
                  </div>
                </div>

                {/* Visualizer Mode Switcher */}
                <div className="flex flex-wrap items-center justify-between bg-zinc-900/80 border border-zinc-800 px-3 py-2 rounded-xl gap-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Move3d className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono font-semibold text-zinc-200 uppercase tracking-wider">
                      Espacio de Replicación
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Light/Dark Stage Background Toggle */}
                    <button
                      onClick={() => setStageTheme((t) => (t === "light" ? "dark" : "light"))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all border shadow-sm ${
                        stageTheme === "light"
                          ? "bg-amber-400/20 text-amber-300 border-amber-400/40 hover:bg-amber-400/30"
                          : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Alternar fondo claro de laboratorio / fondo oscuro para máxima visibilidad"
                    >
                      {stageTheme === "light" ? (
                        <>
                          <Sun className="w-3.5 h-3.5 text-amber-400" />
                          <span>Fondo Claro</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Fondo Oscuro</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                      <button
                        onClick={() => setViewMode("servo_cards")}
                        className={`px-3 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
                          viewMode === "servo_cards"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                            : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                        }`}
                        title="Gemelos 2.5D en tiempo real con canales PCA9685 y respuesta instantánea (60 FPS)"
                      >
                        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Módulos 2.5D (Tiempo Real)</span>
                      </button>

                      <button
                        onClick={() => setViewMode("3d_stage")}
                        className={`px-3 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
                          viewMode === "3d_stage"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                            : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                        }`}
                        title="Escenario 3D Bimanual con colisiones físicas y choque de puños en Three.js"
                      >
                        <Move3d className="w-3.5 h-3.5" />
                        <span>3D Bimanual</span>
                      </button>

                      <button
                        onClick={() => setViewMode("split")}
                        className={`px-3 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
                          viewMode === "split"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                            : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                        }`}
                        title="Vista combinada: Escenario 3D + Tarjetas individuales de servos"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>3D + Servos</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3D Bimanual Unified Stage (Three.js with collision & fist bump physics) */}
                {(viewMode === "3d_stage" || viewMode === "split") && (
                  <Bimanual3DStage
                    leftKinematics={leftKinematics}
                    rightKinematics={rightKinematics}
                    leftServos={leftServos}
                    rightServos={rightServos}
                    leftDetected={!!leftKinematics}
                    rightDetected={!!rightKinematics}
                    theme={stageTheme}
                    onToggleTheme={() => setStageTheme((t) => (t === "light" ? "dark" : "light"))}
                  />
                )}

                {/* Robotic Hand Twin Cards (2.5D SVG with PCA9685 pin channels) */}
                {(viewMode === "servo_cards" || viewMode === "split") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Mano Izquierda */}
                    <RoboticHandTwin
                      side="left"
                      servos={leftServos}
                      detected={!!leftKinematics}
                      pinchAperture={leftKinematics?.pinchAperture}
                      abductions={leftKinematics?.abductions}
                      theme={stageTheme}
                      channels={{
                        thumb: hardwareProfile.servosLeft.thumb.channel,
                        index: hardwareProfile.servosLeft.index.channel,
                        middle: hardwareProfile.servosLeft.middle.channel,
                        ring: hardwareProfile.servosLeft.ring.channel,
                        pinky: hardwareProfile.servosLeft.pinky.channel,
                        wrist: hardwareProfile.servosLeft.wrist.channel,
                      }}
                    />

                    {/* Mano Derecha */}
                    <RoboticHandTwin
                      side="right"
                      servos={rightServos}
                      detected={!!rightKinematics}
                      pinchAperture={rightKinematics?.pinchAperture}
                      abductions={rightKinematics?.abductions}
                      theme={stageTheme}
                      channels={{
                        thumb: hardwareProfile.servosRight.thumb.channel,
                        index: hardwareProfile.servosRight.index.channel,
                        middle: hardwareProfile.servosRight.middle.channel,
                        ring: hardwareProfile.servosRight.ring.channel,
                        pinky: hardwareProfile.servosRight.pinky.channel,
                        wrist: hardwareProfile.servosRight.wrist.channel,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Telemetry Stream & Protocol Inspector */}
            <ServoTelemetry
              lastPacketLeft={lastPacketLeft}
              lastPacketRight={lastPacketRight}
              packetsSent={packetsSent}
              packetsDropped={packetsDropped}
              targetHz={txRateHz}
              setTargetHz={setTxRateHz}
              latencyMs={latencyMs}
            />
          </div>
        )}

        {activeTab === "calibration" && (
          <CalibrationModal
            currentKinematicsLeft={leftKinematics}
            currentKinematicsRight={rightKinematics}
            calibration={calibration}
            onSaveCalibration={setCalibration}
          />
        )}

        {activeTab === "hardware" && (
          <HardwareConfigModal
            currentProfile={hardwareProfile}
            onUpdateProfile={setHardwareProfile}
          />
        )}

        {activeTab === "supervisor" && (
          <GeminiSupervisor
            leftKinematics={leftKinematics}
            rightKinematics={rightKinematics}
            leftServos={leftServos}
            rightServos={rightServos}
          />
        )}

        {activeTab === "code" && <CodeViewerModal />}
      </main>

      {/* Macro Trajectory Recording & Replay Modal */}
      {isMacroModalOpen && (
        <MacroRecorderModal
          isOpen={isMacroModalOpen}
          onClose={() => setIsMacroModalOpen(false)}
          currentLeftServos={leftServos}
          currentRightServos={rightServos}
          onPlaybackFrame={(frame) => {
            setPlaybackLeft(frame.left);
            setPlaybackRight(frame.right);
          }}
          onPlaybackComplete={() => {
            setPlaybackLeft(null);
            setPlaybackRight(null);
          }}
        />
      )}

      {/* ESP32 WiFi WebSocket Modal */}
      {isWiFiModalOpen && (
        <WiFiConnectModal
          isOpen={isWiFiModalOpen}
          onClose={() => setIsWiFiModalOpen(false)}
          isConnected={isConnectedEspWiFi}
          currentWsUrl={espWsUrl}
          onConnect={handleConnectEspWiFi}
          onDisconnect={handleDisconnectEspWiFi}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-4 text-center text-xs font-mono text-zinc-500">
        PROMPT MAESTRO &bull; Sistema de Teleoperación Bimanual (MediaPipe Tasks Vision + ESP32 PCA9685)
      </footer>
    </div>
  );
}
export default App;
