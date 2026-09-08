import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { HandKinematics, ServoState } from "../types/teleop";
import {
  RotateCcw,
  Maximize2,
  Sparkles,
  Layers,
  Move3d,
  Zap,
  Sun,
  Moon,
} from "lucide-react";

interface Bimanual3DStageProps {
  leftKinematics: HandKinematics | null;
  rightKinematics: HandKinematics | null;
  leftServos: ServoState;
  rightServos: ServoState;
  leftDetected: boolean;
  rightDetected: boolean;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}

interface InteractionState {
  type: "none" | "fist_bump" | "palm_contact" | "finger_touch" | "approaching";
  distanceCm: number;
  contactPoint: [number, number, number] | null;
}

export const Bimanual3DStage: React.FC<Bimanual3DStageProps> = ({
  leftKinematics,
  rightKinematics,
  leftServos,
  rightServos,
  leftDetected,
  rightDetected,
  theme = "light",
  onToggleTheme,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [stageTheme, setStageTheme] = useState<"light" | "dark">(theme);
  const [interaction, setInteraction] = useState<InteractionState>({
    type: "none",
    distanceCm: 25.0,
    contactPoint: null,
  });
  const [autoRotate, setAutoRotate] = useState(false);

  // Sync external theme prop
  useEffect(() => {
    if (theme) {
      setStageTheme(theme);
    }
  }, [theme]);

  // Keep references to scene objects for dynamic theme switching without scene re-instantiation
  const sceneThemeHandlesRef = useRef<{
    scene: THREE.Scene;
    ambientLight: THREE.AmbientLight;
    keyLight: THREE.DirectionalLight;
    lightGrid: THREE.GridHelper;
    darkGrid: THREE.GridHelper;
    ringMat: THREE.MeshBasicMaterial;
    metalMatDark: THREE.MeshStandardMaterial;
    metalMatSilver: THREE.MeshStandardMaterial;
    leftAccentMat: THREE.MeshStandardMaterial;
    rightAccentMat: THREE.MeshStandardMaterial;
  } | null>(null);

  // Latest state references for the Three.js render loop
  const latestDataRef = useRef({
    leftKinematics,
    rightKinematics,
    leftServos,
    rightServos,
    leftDetected,
    rightDetected,
  });

  useEffect(() => {
    latestDataRef.current = {
      leftKinematics,
      rightKinematics,
      leftServos,
      rightServos,
      leftDetected,
      rightDetected,
    };
  }, [leftKinematics, rightKinematics, leftServos, rightServos, leftDetected, rightDetected]);

  // Update theme in real-time when stageTheme changes
  useEffect(() => {
    const handles = sceneThemeHandlesRef.current;
    if (!handles) return;

    const isLight = stageTheme === "light";
    const bgCol = isLight ? "#f1f5f9" : "#08090d";

    handles.scene.background = new THREE.Color(bgCol);
    if (handles.scene.fog) {
      (handles.scene.fog as THREE.FogExp2).color.set(bgCol);
      (handles.scene.fog as THREE.FogExp2).density = isLight ? 0.011 : 0.018;
    }

    handles.ambientLight.color.set(isLight ? "#ffffff" : "#27272a");
    handles.ambientLight.intensity = isLight ? 2.4 : 1.8;

    handles.keyLight.color.set(isLight ? "#ffffff" : "#f8fafc");
    handles.keyLight.intensity = isLight ? 2.8 : 2.2;

    handles.lightGrid.visible = isLight;
    handles.darkGrid.visible = !isLight;

    handles.ringMat.color.set(isLight ? "#94a3b8" : "#3f3f46");
    handles.ringMat.opacity = isLight ? 0.6 : 0.4;

    // Metal chassis color: deep slate in light mode for crisp contrast, dark in dark mode
    handles.metalMatDark.color.set(isLight ? "#1e293b" : "#18181b");
    handles.metalMatDark.roughness = isLight ? 0.28 : 0.25;

    // Metal silver: gleaming chrome white in light mode
    handles.metalMatSilver.color.set(isLight ? "#f8fafc" : "#a1a1aa");

    // Accents: vivid colors in light mode
    handles.leftAccentMat.color.set(isLight ? "#ea580c" : "#d97706");
    handles.leftAccentMat.emissive.set(isLight ? "#c2410c" : "#b45309");

    handles.rightAccentMat.color.set(isLight ? "#059669" : "#059669");
    handles.rightAccentMat.emissive.set(isLight ? "#047857" : "#047857");
  }, [stageTheme]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;
    const isLightInitial = stageTheme === "light";
    const initialBg = isLightInitial ? "#f1f5f9" : "#08090d";

    // --- Three.js Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialBg);
    scene.fog = new THREE.FogExp2(initialBg, isLightInitial ? 0.011 : 0.018);

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const cameraTargets = {
      pos: new THREE.Vector3(0, 14, 26),
      look: new THREE.Vector3(0, 1, 0),
    };

    camera.position.copy(cameraTargets.pos);
    camera.lookAt(cameraTargets.look);

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(
      isLightInitial ? "#ffffff" : "#27272a",
      isLightInitial ? 2.4 : 1.8
    );
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(
      isLightInitial ? "#ffffff" : "#f8fafc",
      isLightInitial ? 2.8 : 2.2
    );
    keyLight.position.set(12, 22, 15);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    scene.add(keyLight);

    // Cyan rim light (Right hand atmosphere)
    const cyanRim = new THREE.PointLight("#0284c7", 3.0, 32);
    cyanRim.position.set(16, 8, -5);
    scene.add(cyanRim);

    // Amber rim light (Left hand atmosphere)
    const amberRim = new THREE.PointLight("#ea580c", 3.0, 32);
    amberRim.position.set(-16, 8, -5);
    scene.add(amberRim);

    // Center arena spotlight
    const centerSpot = new THREE.SpotLight("#ffffff", 1.8, 38, Math.PI / 4, 0.4);
    centerSpot.position.set(0, 20, 0);
    centerSpot.target.position.set(0, 0, 0);
    scene.add(centerSpot);
    scene.add(centerSpot.target);

    // --- Dual Floor Grids for Instant Theme Toggling ---
    // Light laboratory floor grid (clean slate-300 lines on slate-200)
    const lightGrid = new THREE.GridHelper(40, 40, "#94a3b8", "#cbd5e1");
    lightGrid.position.y = -6;
    lightGrid.visible = isLightInitial;
    scene.add(lightGrid);

    // Dark grid
    const darkGrid = new THREE.GridHelper(40, 40, "#3f3f46", "#18181b");
    darkGrid.position.y = -6;
    darkGrid.visible = !isLightInitial;
    scene.add(darkGrid);

    // Concentric Arena Target Rings (for collision & interaction feedback)
    const ringGeo = new THREE.RingGeometry(3.5, 3.7, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isLightInitial ? "#94a3b8" : "#3f3f46",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isLightInitial ? 0.6 : 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -5.95;
    scene.add(ring);

    // Dynamic Collision Shockwave Ring (when fist bumping)
    const shockwaveGeo = new THREE.RingGeometry(0.2, 0.6, 32);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: "#0284c7",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    shockwaveMesh.rotation.x = -Math.PI / 2;
    shockwaveMesh.visible = false;
    scene.add(shockwaveMesh);

    // Spark Particles for Impact
    const particleCount = 45;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(particleCount * 3);
    const sparkVelocities: THREE.Vector3[] = [];
    for (let i = 0; i < particleCount; i++) {
      sparkPositions[i * 3] = 0;
      sparkPositions[i * 3 + 1] = 0;
      sparkPositions[i * 3 + 2] = 0;
      sparkVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          Math.random() * 8 + 2,
          (Math.random() - 0.5) * 12
        )
      );
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: "#f59e0b",
      size: 0.38,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkPoints);

    // --- MATERIALS (Calibrated for High Legibility & Contrast in Both Themes) ---
    const metalMatDark = new THREE.MeshStandardMaterial({
      color: isLightInitial ? "#1e293b" : "#18181b",
      metalness: 0.85,
      roughness: isLightInitial ? 0.28 : 0.25,
    });
    const metalMatSilver = new THREE.MeshStandardMaterial({
      color: isLightInitial ? "#f8fafc" : "#a1a1aa",
      metalness: 0.95,
      roughness: 0.18,
    });
    const leftAccentMat = new THREE.MeshStandardMaterial({
      color: isLightInitial ? "#ea580c" : "#d97706",
      metalness: 0.65,
      roughness: 0.28,
      emissive: isLightInitial ? "#c2410c" : "#b45309",
      emissiveIntensity: 0.25,
    });
    const rightAccentMat = new THREE.MeshStandardMaterial({
      color: isLightInitial ? "#059669" : "#059669",
      metalness: 0.65,
      roughness: 0.28,
      emissive: isLightInitial ? "#047857" : "#047857",
      emissiveIntensity: 0.25,
    });
    const rubberTipMat = new THREE.MeshStandardMaterial({
      color: "#020617",
      roughness: 0.92,
      metalness: 0.08,
    });
    const jointPinMat = new THREE.MeshStandardMaterial({
      color: "#f1f5f9",
      metalness: 0.96,
      roughness: 0.12,
    });

    // Store handles for dynamic theme updates
    sceneThemeHandlesRef.current = {
      scene,
      ambientLight,
      keyLight,
      lightGrid,
      darkGrid,
      ringMat,
      metalMatDark,
      metalMatSilver,
      leftAccentMat,
      rightAccentMat,
    };

    // --- ROBOTIC HAND BUILDER ---
    const createRoboticHand = (side: "left" | "right") => {
      const isLeft = side === "left";
      const accentMat = isLeft ? leftAccentMat : rightAccentMat;
      const rootGroup = new THREE.Group();

      // 1. Forearm Mount & Wrist Bracket
      const forearmGeo = new THREE.BoxGeometry(3.6, 2.2, 5.0);
      const forearm = new THREE.Mesh(forearmGeo, metalMatDark);
      forearm.position.set(0, 0, -4.5);
      forearm.castShadow = true;
      rootGroup.add(forearm);

      // Servo Actuator Block on forearm
      const servoBlockGeo = new THREE.BoxGeometry(2.6, 1.4, 3.2);
      const servoBlock = new THREE.Mesh(servoBlockGeo, accentMat);
      servoBlock.position.set(0, 1.4, -4.2);
      rootGroup.add(servoBlock);

      // Status LED indicator on wrist
      const ledGeo = new THREE.SphereGeometry(0.25, 16, 16);
      const ledMat = new THREE.MeshBasicMaterial({
        color: isLeft ? "#ea580c" : "#10b981",
      });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(0, 1.8, -3.2);
      rootGroup.add(led);

      // 2. Wrist Joint (Rotates with wrist servo)
      const wristJoint = new THREE.Group();
      wristJoint.position.set(0, 0, -1.8);
      rootGroup.add(wristJoint);

      const wristPivotGeo = new THREE.CylinderGeometry(1.2, 1.2, 3.4, 24);
      const wristPivot = new THREE.Mesh(wristPivotGeo, jointPinMat);
      wristPivot.rotation.z = Math.PI / 2;
      wristJoint.add(wristPivot);

      // 3. Palm Chassis (CNC Aluminum Base)
      const palmGroup = new THREE.Group();
      palmGroup.position.set(0, 0, 1.8);
      wristJoint.add(palmGroup);

      const palmBaseGeo = new THREE.BoxGeometry(5.2, 1.2, 4.4);
      const palmBase = new THREE.Mesh(palmBaseGeo, metalMatDark);
      palmBase.castShadow = true;
      palmGroup.add(palmBase);

      // Internal PCA9685 circuit board plate
      const pcbGeo = new THREE.BoxGeometry(4.2, 0.15, 3.4);
      const pcbMat = new THREE.MeshStandardMaterial({
        color: "#064e3b",
        roughness: 0.4,
      });
      const pcb = new THREE.Mesh(pcbGeo, pcbMat);
      pcb.position.set(0, 0.65, 0);
      palmGroup.add(pcb);

      // Brass / Chrome Standoff Bolts
      const boltGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.4, 12);
      [-1.8, 1.8].forEach((bx) => {
        [-1.4, 1.4].forEach((bz) => {
          const bolt = new THREE.Mesh(boltGeo, jointPinMat);
          bolt.position.set(bx, 0.8, bz);
          palmGroup.add(bolt);
        });
      });

      // 4. Five Articulated Mechanical Fingers
      interface FingerJoints {
        mcp: THREE.Group;
        pip: THREE.Group;
        dip: THREE.Group;
        tip: THREE.Mesh;
      }

      const fingerNodes: Record<string, FingerJoints> = {};

      const fingerSpecs = [
        { name: "thumb", x: isLeft ? 2.8 : -2.8, z: -0.6, baseAngleY: isLeft ? 0.75 : -0.75, len1: 1.6, len2: 1.3, len3: 1.1 },
        { name: "index", x: isLeft ? 1.8 : -1.8, z: 2.3, baseAngleY: isLeft ? 0.12 : -0.12, len1: 1.8, len2: 1.4, len3: 1.1 },
        { name: "middle", x: 0.0, z: 2.5, baseAngleY: 0.0, len1: 2.1, len2: 1.6, len3: 1.2 },
        { name: "ring", x: isLeft ? -1.8 : 1.8, z: 2.3, baseAngleY: isLeft ? -0.12 : 0.12, len1: 1.9, len2: 1.4, len3: 1.1 },
        { name: "pinky", x: isLeft ? -2.7 : 2.7, z: 1.6, baseAngleY: isLeft ? -0.26 : 0.26, len1: 1.5, len2: 1.1, len3: 0.9 },
      ];

      fingerSpecs.forEach((spec) => {
        // MCP Joint Group (Knuckle)
        const mcp = new THREE.Group();
        mcp.position.set(spec.x, 0, spec.z);
        mcp.rotation.y = spec.baseAngleY;
        palmGroup.add(mcp);

        // Knuckle Bearing
        const knuckleGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.9, 16);
        const knuckle = new THREE.Mesh(knuckleGeo, jointPinMat);
        knuckle.rotation.z = Math.PI / 2;
        mcp.add(knuckle);

        // Phalanx 1 (Proximal)
        const p1Geo = new THREE.BoxGeometry(0.78, 0.7, spec.len1);
        const p1Mesh = new THREE.Mesh(p1Geo, metalMatSilver);
        p1Mesh.position.set(0, 0, spec.len1 / 2);
        p1Mesh.castShadow = true;
        mcp.add(p1Mesh);

        // PIP Joint Group (Middle)
        const pip = new THREE.Group();
        pip.position.set(0, 0, spec.len1);
        mcp.add(pip);

        const pipPivotGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.8, 16);
        const pipPivot = new THREE.Mesh(pipPivotGeo, jointPinMat);
        pipPivot.rotation.z = Math.PI / 2;
        pip.add(pipPivot);

        // Phalanx 2 (Intermediate)
        const p2Geo = new THREE.BoxGeometry(0.68, 0.6, spec.len2);
        const p2Mesh = new THREE.Mesh(p2Geo, metalMatDark);
        p2Mesh.position.set(0, 0, spec.len2 / 2);
        p2Mesh.castShadow = true;
        pip.add(p2Mesh);

        // DIP Joint Group (Distal)
        const dip = new THREE.Group();
        dip.position.set(0, 0, spec.len2);
        pip.add(dip);

        // Phalanx 3 (Distal fingertip)
        const p3Geo = new THREE.BoxGeometry(0.58, 0.52, spec.len3);
        const p3Mesh = new THREE.Mesh(p3Geo, accentMat);
        p3Mesh.position.set(0, 0, spec.len3 / 2);
        p3Mesh.castShadow = true;
        dip.add(p3Mesh);

        // Rubber Contact Tip
        const tipGeo = new THREE.SphereGeometry(0.34, 16, 16);
        const tip = new THREE.Mesh(tipGeo, rubberTipMat);
        tip.position.set(0, 0, spec.len3);
        dip.add(tip);

        fingerNodes[spec.name] = { mcp, pip, dip, tip };
      });

      return {
        rootGroup,
        wristJoint,
        palmGroup,
        fingerNodes,
      };
    };

    const leftHand = createRoboticHand("left");
    const rightHand = createRoboticHand("right");

    leftHand.rootGroup.position.set(-6.5, 0, 0);
    rightHand.rootGroup.position.set(6.5, 0, 0);

    leftHand.rootGroup.rotation.y = Math.PI / 6;
    rightHand.rootGroup.rotation.y = -Math.PI / 6;

    scene.add(leftHand.rootGroup);
    scene.add(rightHand.rootGroup);

    // --- Mouse Orbit Interaction ---
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let spherical = { radius: 28, theta: 0, phi: Math.PI / 3 };

    const updateCameraSpherical = () => {
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi));
      spherical.radius = Math.max(8, Math.min(45, spherical.radius));
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0, 0);
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMousePos.x;
      const dy = e.clientY - prevMousePos.y;
      prevMousePos = { x: e.clientX, y: e.clientY };

      spherical.theta -= dx * 0.008;
      spherical.phi -= dy * 0.008;
      updateCameraSpherical();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius += e.deltaY * 0.02;
      updateCameraSpherical();
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    // --- ANIMATION & KINEMATICS UPDATE LOOP ---
    let animId: number;
    let shockwaveScale = 1.0;
    let sparksActive = false;
    let sparksLife = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const { leftServos, rightServos, leftKinematics, rightKinematics, leftDetected, rightDetected } =
        latestDataRef.current;

      // 1. Update Left Finger Joint Angles
      if (leftHand) {
        const s = leftServos;
        const wristAngle = (s.wrist - 0.5) * 1.6;
        leftHand.wristJoint.rotation.x = wristAngle;

        const thumbNorm = s.thumb;
        leftHand.fingerNodes.thumb.mcp.rotation.x = thumbNorm * 0.9;
        leftHand.fingerNodes.thumb.mcp.rotation.y = 0.75 - thumbNorm * 0.5;
        leftHand.fingerNodes.thumb.pip.rotation.x = thumbNorm * 1.2;

        const fingers: (keyof ServoState)[] = ["index", "middle", "ring", "pinky"];
        fingers.forEach((fKey) => {
          const norm = s[fKey];
          const node = leftHand.fingerNodes[fKey];
          if (node) {
            node.mcp.rotation.x = norm * 1.35;
            node.pip.rotation.x = norm * 1.55;
            node.dip.rotation.x = norm * 1.15;
          }
        });
      }

      // 2. Update Right Finger Joint Angles
      if (rightHand) {
        const s = rightServos;
        const wristAngle = (s.wrist - 0.5) * 1.6;
        rightHand.wristJoint.rotation.x = wristAngle;

        const thumbNorm = s.thumb;
        rightHand.fingerNodes.thumb.mcp.rotation.x = thumbNorm * 0.9;
        rightHand.fingerNodes.thumb.mcp.rotation.y = -0.75 + thumbNorm * 0.5;
        rightHand.fingerNodes.thumb.pip.rotation.x = thumbNorm * 1.2;

        const fingers: (keyof ServoState)[] = ["index", "middle", "ring", "pinky"];
        fingers.forEach((fKey) => {
          const norm = s[fKey];
          const node = rightHand.fingerNodes[fKey];
          if (node) {
            node.mcp.rotation.x = norm * 1.35;
            node.pip.rotation.x = norm * 1.55;
            node.dip.rotation.x = norm * 1.15;
          }
        });
      }

      // 3. Real-Time 3D Spatial Positioning from MediaPipe Center Coordinates
      let targetLeftX = -6.5;
      let targetLeftY = 0;
      let targetLeftZ = 0;

      if (leftDetected && leftKinematics?.center3D) {
        targetLeftX = -12 + leftKinematics.center3D.x * 14;
        targetLeftY = 5 - leftKinematics.center3D.y * 10;
        targetLeftZ = -(leftKinematics.center3D.z || 0) * 16;
      }

      let targetRightX = 6.5;
      let targetRightY = 0;
      let targetRightZ = 0;

      if (rightDetected && rightKinematics?.center3D) {
        targetRightX = 12 - (1 - rightKinematics.center3D.x) * 14;
        targetRightY = 5 - rightKinematics.center3D.y * 10;
        targetRightZ = -(rightKinematics.center3D.z || 0) * 16;
      }

      // 4. Fist Bump / Collision Physics Handling
      const rawDistance = Math.hypot(
        targetRightX - targetLeftX,
        targetRightY - targetLeftY,
        targetRightZ - targetLeftZ
      );

      const isLeftFist =
        leftServos.thumb > 0.55 &&
        leftServos.index > 0.65 &&
        leftServos.middle > 0.65 &&
        leftServos.ring > 0.65;
      const isRightFist =
        rightServos.thumb > 0.55 &&
        rightServos.index > 0.65 &&
        rightServos.middle > 0.65 &&
        rightServos.ring > 0.65;

      const isLeftOpen = leftServos.index < 0.35 && leftServos.middle < 0.35;
      const isRightOpen = rightServos.index < 0.35 && rightServos.middle < 0.35;

      const minHandDistance = 3.6;

      let currentContactType: InteractionState["type"] = "none";
      let contactCenter: [number, number, number] | null = null;

      if (rawDistance < minHandDistance + 2.5) {
        if (isLeftFist && isRightFist) {
          currentContactType = "fist_bump";
        } else if (isLeftOpen && isRightOpen) {
          currentContactType = "palm_contact";
        } else {
          currentContactType = "finger_touch";
        }

        contactCenter = [
          (targetLeftX + targetRightX) / 2,
          (targetLeftY + targetRightY) / 2,
          (targetLeftZ + targetRightZ) / 2,
        ];

        // Apply physical collision constraint so hands don't clip through each other
        if (rawDistance < minHandDistance) {
          const overlap = (minHandDistance - rawDistance) / 2;
          const dirX = (targetRightX - targetLeftX) / (rawDistance || 1);
          targetLeftX -= dirX * overlap;
          targetRightX += dirX * overlap;

          // Trigger visual impact spark & shockwave
          if (!sparksActive) {
            sparksActive = true;
            sparksLife = 1.0;
            shockwaveScale = 0.5;
            shockwaveMat.opacity = 0.9;
            shockwaveMesh.position.set(contactCenter[0], contactCenter[1] - 1.5, contactCenter[2]);
            shockwaveMesh.visible = true;

            const posAttr = sparkGeo.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < particleCount; i++) {
              posAttr.setXYZ(i, contactCenter[0], contactCenter[1], contactCenter[2]);
            }
            posAttr.needsUpdate = true;
            sparkMat.opacity = 1.0;
          }
        }
      } else if (rawDistance < 10.0) {
        currentContactType = "approaching";
      }

      leftHand.rootGroup.position.lerp(new THREE.Vector3(targetLeftX, targetLeftY, targetLeftZ), 0.18);
      rightHand.rootGroup.position.lerp(new THREE.Vector3(targetRightX, targetRightY, targetRightZ), 0.18);

      const contactAngleOffset = Math.max(0, 1 - rawDistance / 14);
      leftHand.rootGroup.rotation.y = Math.PI / 4 + contactAngleOffset * 0.35;
      rightHand.rootGroup.rotation.y = -Math.PI / 4 - contactAngleOffset * 0.35;

      // Animate shockwave
      if (shockwaveMesh.visible) {
        shockwaveScale += 0.18;
        shockwaveMesh.scale.set(shockwaveScale, shockwaveScale, 1);
        shockwaveMat.opacity *= 0.88;
        if (shockwaveMat.opacity < 0.04) {
          shockwaveMesh.visible = false;
        }
      }

      // Animate sparks
      if (sparksActive) {
        sparksLife -= 0.045;
        const posAttr = sparkGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          const v = sparkVelocities[i];
          const px = posAttr.getX(i) + v.x * 0.02;
          const py = posAttr.getY(i) + v.y * 0.02;
          const pz = posAttr.getZ(i) + v.z * 0.02;
          posAttr.setXYZ(i, px, py, pz);
          v.y -= 0.25;
        }
        posAttr.needsUpdate = true;
        sparkMat.opacity = Math.max(0, sparksLife);
        if (sparksLife <= 0) {
          sparksActive = false;
        }
      }

      const distCm = Math.max(0, Math.round(rawDistance * 2.8 * 10) / 10);
      setInteraction((prev) => {
        if (prev.type !== currentContactType || Math.abs(prev.distanceCm - distCm) > 0.4) {
          return {
            type: currentContactType,
            distanceCm: distCm,
            contactPoint: contactCenter,
          };
        }
        return prev;
      });

      if (autoRotate && !isDragging) {
        spherical.theta += 0.003;
        updateCameraSpherical();
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const isLight = stageTheme === "light";

  const interactionBadge = useMemo(() => {
    switch (interaction.type) {
      case "fist_bump":
        return {
          label: "🤜💥🤛 ¡CHOQUE DE PUÑOS REPLICADO!",
          bg: isLight
            ? "bg-amber-500/20 text-amber-900 border-amber-500/40 animate-pulse font-bold"
            : "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse",
          sub: "Colisión de puños físicos bimanual en 3D",
        };
      case "palm_contact":
        return {
          label: "🙏 ¡PALMAS JUNTAS / APLAUSO!",
          bg: isLight
            ? "bg-emerald-500/20 text-emerald-900 border-emerald-500/40 font-bold"
            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          sub: "Contacto plano de palmas abiertas",
        };
      case "finger_touch":
        return {
          label: "👉👈 ¡CONTACTO DE YEMAS!",
          bg: isLight
            ? "bg-cyan-500/20 text-cyan-900 border-cyan-500/40 font-bold"
            : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
          sub: "Interacción de precisión bimanual",
        };
      case "approaching":
        return {
          label: "⚡ APROXIMACIÓN BIMANUAL",
          bg: isLight
            ? "bg-blue-500/15 text-blue-900 border-blue-500/30"
            : "bg-blue-500/10 text-blue-300 border-blue-500/30",
          sub: "Manos a menos de 15 cm",
        };
      default:
        return {
          label: "ESPACIO 3D LIBRE",
          bg: isLight
            ? "bg-slate-200/90 text-slate-700 border-slate-300"
            : "bg-zinc-800/80 text-zinc-400 border-zinc-700/50",
          sub: "Ambas manos replicando en tiempo real",
        };
    }
  }, [interaction.type, isLight]);

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden shadow-xl flex flex-col transition-colors duration-200 ${
        isLight
          ? "border border-slate-300 bg-slate-100/80"
          : "border border-zinc-800 bg-zinc-950"
      }`}
    >
      {/* 3D Stage Top Navigation & Telemetry Bar */}
      <div
        className={`px-4 py-2.5 backdrop-blur flex flex-wrap items-center justify-between gap-3 z-10 transition-colors duration-200 ${
          isLight
            ? "bg-slate-200/90 border-b border-slate-300 text-slate-900"
            : "bg-zinc-950/90 border-b border-zinc-800/80 text-zinc-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isLight ? "bg-cyan-600 animate-pulse" : "bg-cyan-400 animate-pulse"
            }`}
          />
          <h2
            className={`text-xs font-bold tracking-wider uppercase font-mono flex items-center gap-1.5 ${
              isLight ? "text-slate-900" : "text-zinc-200"
            }`}
          >
            <Move3d className={`w-4 h-4 ${isLight ? "text-cyan-600" : "text-cyan-400"}`} />
            Escenario 3D Bimanual (Three.js)
          </h2>
        </div>

        {/* Dynamic Collision / Gesture Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all duration-200 ${interactionBadge.bg}`}
          >
            {interactionBadge.label}
          </div>

          <div
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
              isLight
                ? "bg-white border border-slate-300 text-slate-800"
                : "bg-zinc-900 border border-zinc-800 text-zinc-300"
            }`}
          >
            <span className={isLight ? "text-slate-500" : "text-zinc-500"}>Distancia:</span>
            <span className={`font-bold ${isLight ? "text-cyan-700" : "text-cyan-400"}`}>
              {interaction.distanceCm} cm
            </span>
          </div>
        </div>

        {/* Camera Views, Theme Toggle & Controls */}
        <div className="flex items-center gap-1.5">
          {/* Theme Toggle Button (Light/Dark) */}
          <button
            onClick={() => {
              const next = stageTheme === "light" ? "dark" : "light";
              setStageTheme(next);
              if (onToggleTheme) onToggleTheme();
            }}
            className={`px-2.5 py-1 text-[11px] font-mono rounded border flex items-center gap-1.5 transition-all shadow-sm ${
              isLight
                ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50 font-semibold"
                : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
            }`}
            title="Alternar fondo claro de laboratorio / fondo oscuro"
          >
            {isLight ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-slate-900 font-medium">Fondo Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-zinc-300">Fondo Oscuro</span>
              </>
            )}
          </button>

          <button
            onClick={() => setAutoRotate((r) => !r)}
            className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
              autoRotate
                ? isLight
                  ? "bg-cyan-600 text-white border-cyan-600"
                  : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : isLight
                ? "bg-white text-slate-600 border-slate-300 hover:text-slate-900"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
            }`}
            title="Rotación automática de cámara"
          >
            ÓRBITA
          </button>

          <div
            className={`text-[10px] font-mono hidden md:block ${
              isLight ? "text-slate-500" : "text-zinc-500"
            }`}
          >
            Arrastra para rotar • Rueda para zoom
          </div>
        </div>
      </div>

      {/* WebGL Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-[360px] sm:h-[420px] md:h-[460px] cursor-grab active:cursor-grabbing relative"
      />

      {/* Bottom Floating Info Overlays */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between pointer-events-none gap-2 z-10">
        {/* Left hand servo state pill */}
        <div
          className={`pointer-events-auto backdrop-blur-md px-3 py-1.5 rounded-lg border text-[11px] font-mono flex items-center gap-2 shadow-sm ${
            isLight
              ? "bg-white/95 border-amber-400/60 text-slate-800"
              : "bg-zinc-950/85 border-amber-500/30 text-zinc-200"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className={isLight ? "text-slate-700 font-semibold" : "text-zinc-300 font-medium"}>
            Mano Izquierda:
          </span>
          <span className={`font-bold ${isLight ? "text-amber-600" : "text-amber-400"}`}>
            {leftDetected ? `${Math.round(leftServos.index * 180)}° flex` : "En espera"}
          </span>
          {leftServos.index > 0.65 && leftServos.middle > 0.65 && (
            <span
              className={`text-[9px] px-1 font-bold rounded ${
                isLight ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-amber-500/20 text-amber-300"
              }`}
            >
              PUÑO
            </span>
          )}
        </div>

        {/* 3D Interaction status message */}
        <div
          className={`text-[11px] font-mono backdrop-blur px-3 py-1 rounded-full border hidden sm:block ${
            isLight
              ? "text-slate-700 bg-white/90 border-slate-300 shadow-sm"
              : "text-zinc-400 bg-zinc-950/80 border-zinc-800"
          }`}
        >
          {interactionBadge.sub}
        </div>

        {/* Right hand servo state pill */}
        <div
          className={`pointer-events-auto backdrop-blur-md px-3 py-1.5 rounded-lg border text-[11px] font-mono flex items-center gap-2 shadow-sm ${
            isLight
              ? "bg-white/95 border-emerald-400/60 text-slate-800"
              : "bg-zinc-950/85 border-emerald-500/30 text-zinc-200"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className={isLight ? "text-slate-700 font-semibold" : "text-zinc-300 font-medium"}>
            Mano Derecha:
          </span>
          <span className={`font-bold ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
            {rightDetected ? `${Math.round(rightServos.index * 180)}° flex` : "En espera"}
          </span>
          {rightServos.index > 0.65 && rightServos.middle > 0.65 && (
            <span
              className={`text-[9px] px-1 font-bold rounded ${
                isLight
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-emerald-500/20 text-emerald-300"
              }`}
            >
              PUÑO
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
