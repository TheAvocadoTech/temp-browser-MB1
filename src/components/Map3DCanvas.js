// src/components/Map3DCanvas.js
import React, { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture, Html, useProgress, Line } from "@react-three/drei";
import * as THREE from "three";
import { LocateFixed } from "lucide-react";
import defaultReaders from "../config/rfidReaders.json";
import transform from "../config/mapTransform.json";

// World-unit dimensions corresponding to 100% floorplan width and depth
const FLOOR_WIDTH = 40;
const FLOOR_DEPTH = 28;

// Keeps your correct reader-to-reader distance scaling
const SCALE_X = 1.0;
const SCALE_Z = 1.0;

// Re-anchored origins to translate the start point directly onto the marked red spot
const BASE_SCALE = 0.55;
const BASE_ORIGIN_X = -6.3; // Decreased from -8.8 to slide path LEFT into the room
const BASE_ORIGIN_Z = -3.7;  // Increased from -4.3 to slide path DOWN into the hallway

// Average percentage center of your map path coordinates
const CENTER_X_PCT = 50; 
const CENTER_Y_PCT = 50; 

// Automatically re-anchor origin without altering relative spacing
const ORIGIN_X = BASE_ORIGIN_X - (CENTER_X_PCT / 100) * FLOOR_WIDTH * (SCALE_X - BASE_SCALE);
const ORIGIN_Z = BASE_ORIGIN_Z - (CENTER_Y_PCT / 100) * FLOOR_DEPTH * (SCALE_Z - BASE_SCALE);

/**
 * Maps percentage coords accurately onto the 3D floor plan
 */
export const pctToWorld = (xPct, yPct, height = 0.15) => {
  const worldX = (xPct / 100) * (FLOOR_WIDTH * SCALE_X) + ORIGIN_X;
  const worldZ = (yPct / 100) * (FLOOR_DEPTH * SCALE_Z) + ORIGIN_Z;

  return [worldX, height, worldZ];
};

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center style={{ pointerEvents: "none" }}>
      <div
        style={{
          background: "rgba(255,255,255,0.95)",
          color: "#1f2937",
          padding: "16px 24px",
          borderRadius: "12px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
          backdropFilter: "blur(8px)",
          border: "1px solid #e5e7eb",
          minWidth: "220px",
        }}
      >
        <div style={{ fontWeight: "700", marginBottom: "8px", fontSize: "14px", letterSpacing: "0.5px" }}>
          LOADING 3D FACILITY MODEL
        </div>
        <div
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: "#e5e7eb",
            borderRadius: "4px",
            overflow: "hidden",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: `${progress.toFixed(0)}%`,
              height: "100%",
              backgroundColor: "#0ea5e9",
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <div style={{ fontSize: "12px", color: "#6b7280" }}>
          {progress > 0 ? `${progress.toFixed(0)}% Loaded` : "Initializing..."}
        </div>
      </div>
    </Html>
  );
}

function FloorplanReference({ visible = true, opacity = 0.5 }) {
  const texture = useTexture(`${process.env.PUBLIC_URL}/map_floorplan.png`);
  if (!visible) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function FacilityModel({ liveTransform }) {
  const { scene } = useGLTF(`${process.env.PUBLIC_URL}/facility.glb`);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const t = liveTransform || transform;
  return (
    <primitive
      object={clonedScene}
      position={[t.position.x, t.position.y, t.position.z]}
      rotation={[0, t.rotationY, 0]}
      scale={t.scale}
    />
  );
}

// Geometry helper: Angle between two 2D coords
function angleBetween(a, b) {
  const dx = ((b.x - a.x) / 100) * FLOOR_WIDTH;
  const dz = ((b.y - a.y) / 100) * FLOOR_DEPTH;
  return Math.atan2(dx, dz);
}

// Returns true if the path at index i makes a meaningful turn (> 25°)
function isTurnPoint(readers, i, threshold = 25) {
  if (i < 1 || i >= readers.length - 1) return false;
  const prev = readers[i - 1].coords;
  const curr = readers[i].coords;
  const next = readers[i + 1].coords;

  const dx1 = ((curr.x - prev.x) / 100) * FLOOR_WIDTH;
  const dz1 = ((curr.y - prev.y) / 100) * FLOOR_DEPTH;
  const inAngle = Math.atan2(dx1, dz1);

  const dx2 = ((next.x - curr.x) / 100) * FLOOR_WIDTH;
  const dz2 = ((next.y - curr.y) / 100) * FLOOR_DEPTH;
  const outAngle = Math.atan2(dx2, dz2);

  let diff = Math.abs((outAngle - inAngle) * (180 / Math.PI));
  if (diff > 180) diff = 360 - diff;
  return diff > threshold;
}

function FlatPathLayer({ liveData }) {
  const apiReaders    = (liveData?.allReaders?.length) ? liveData.allReaders : defaultReaders;
  const currentReader = liveData?.currentReader || defaultReaders[0];
  const currentSeq    = currentReader.sequence || 1;

  // Merge local coords onto live data so edits to rfidReaders.json take effect immediately
  const allReaders = useMemo(() => {
    return apiReaders.map((r) => {
      const local = defaultReaders.find((d) => d.id === r.id);
      return local ? { ...r, coords: local.coords, location: local.location } : r;
    });
  }, [apiReaders]);

  const remainingReaders = useMemo(() => {
    return allReaders.filter((r) => r.sequence >= currentSeq);
  }, [allReaders, currentSeq]);

  // 3D Point arrays for R3F Line
  const allPoints3D = useMemo(() => {
    return allReaders.map((r) => pctToWorld(r.coords.x, r.coords.y, 0.12));
  }, [allReaders]);

  const remainingPoints3D = useMemo(() => {
    return remainingReaders.map((r) => pctToWorld(r.coords.x, r.coords.y, 0.14));
  }, [remainingReaders]);

  return (
    <group>
      {/* ── 1. Full ghost path line (dim gray) flat on 3D floor ── */}
      {allPoints3D.length > 1 && (
        <Line
          points={allPoints3D}
          color="#9ca3af"
          opacity={0.4}
          transparent
          lineWidth={2.5}
        />
      )}

      {/* ── 2. Active remaining path line (glowing cyan) ── */}
      {remainingPoints3D.length > 1 && (
        <>
          {/* Outer glow line */}
          <Line
            points={remainingPoints3D}
            color="#0ea5e9"
            opacity={0.3}
            transparent
            lineWidth={7}
          />
          {/* Core Line */}
          <Line
            points={remainingPoints3D}
            color="#0ea5e9"
            lineWidth={2.5}
          />
        </>
      )}

      {/* ── 3. Current Active Reader Pulsing Ring ── */}
      {allReaders.map((r) => {
        if (r.isWaypoint) return null;
        const [wx, wy, wz] = pctToWorld(r.coords.x, r.coords.y, 0.16);
        const isCurrent = r.sequence === currentSeq;

        if (!isCurrent) return null;

        return (
          <group key={r.id} position={[wx, wy, wz]} rotation={[-Math.PI / 2, 0, 0]}>
            {/* Pulsing ring flat on floor for current active location */}
            <mesh>
              <circleGeometry args={[0.8, 32]} />
              <meshBasicMaterial color="#84cc16" opacity={0.22} transparent />
            </mesh>
            <mesh>
              <ringGeometry args={[0.4, 0.48, 32]} />
              <meshBasicMaterial color="#84cc16" />
            </mesh>
          </group>
        );
      })}

      {/* ── 4. Turn Chevrons flat on 3D floor at direction-change points ── */}
      {allReaders.map((r, i) => {
        if (!isTurnPoint(allReaders, i)) return null;
        if (r.sequence < currentSeq) return null; // skip passed

        const [wx, wy, wz] = pctToWorld(r.coords.x, r.coords.y, 0.18);
        const next = allReaders[i + 1].coords;
        const angle = angleBetween(r.coords, next);

        const chevHaloPoints = [
          [-0.25, 0, -0.2],
          [0,     0,  0.25],
          [0.25,  0, -0.2],
        ];
        const chevCorePoints = [
          [-0.22, 0, -0.18],
          [0,     0,  0.23],
          [0.22,  0, -0.18],
        ];

        const offX = Math.sin(angle) * 0.6;
        const offZ = Math.cos(angle) * 0.6;

        return (
          <group key={`turn-${r.id}`} position={[wx + offX, wy, wz + offZ]} rotation={[0, angle, 0]}>
            <Line points={chevHaloPoints} color="rgba(255,255,255,0.9)" lineWidth={4.5} />
            <Line points={chevCorePoints} color="#0ea5e9" lineWidth={2.8} />
          </group>
        );
      })}

      {/* ── 5. Leading direction arrow flat on floor at current position ── */}
      {remainingReaders.length > 1 && (() => {
        const curr = remainingReaders[0].coords;
        const next = remainingReaders[1].coords;
        const [cx, cy, cz] = pctToWorld(curr.x, curr.y, 0.2);
        const angle = angleBetween(curr, next);

        const arrowPoints = [
          [-0.2, 0, -0.25],
          [0,    0,  0.35],
          [0.2,  0, -0.25],
          [0,    0, -0.1],
          [-0.2, 0, -0.25],
        ];

        return (
          <group position={[cx, cy, cz]} rotation={[0, angle, 0]}>
            <Line points={arrowPoints} color="#0ea5e9" lineWidth={3} />
          </group>
        );
      })()}
    </group>
  );
}

/**
 * Navigation Camera Controller Component
 * Handles path-oriented 3D camera auto-follow and user manual interaction state
 */
function NavigationCameraController({ currentCoords, nextCoords, isManualCamera, setIsManualCamera, recenterTrigger }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const targetVec = useRef(new THREE.Vector3());
  const camVec = useRef(new THREE.Vector3());

  // Listen to OrbitControls start event (fired when user drags/pans/rotates/zooms manually)
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleStart = () => {
      setIsManualCamera(true);
    };

    controls.addEventListener("start", handleStart);
    return () => {
      controls.removeEventListener("start", handleStart);
    };
  }, [setIsManualCamera]);

  // When recenterTrigger changes, force isManualCamera to false for smooth re-centering
  useEffect(() => {
    if (recenterTrigger) {
      setIsManualCamera(false);
    }
  }, [recenterTrigger, setIsManualCamera]);

  useFrame((state, delta) => {
    if (isManualCamera) return;

    // Current live location 3D point
    const [cx, cy, cz] = pctToWorld(currentCoords.x, currentCoords.y, 0.3);

    // Compute heading towards next waypoint (or fallback default orientation)
    let heading = 0;
    if (nextCoords) {
      const dx = ((nextCoords.x - currentCoords.x) / 100) * FLOOR_WIDTH;
      const dz = ((nextCoords.y - currentCoords.y) / 100) * FLOOR_DEPTH;
      if (Math.hypot(dx, dz) > 0.1) {
        heading = Math.atan2(dx, dz);
      }
    }

    // Increased zoom navigation perspective: camera distance = 8.5, height = 7.5, pitched towards target
    const camDist = 8.5;
    const camHeight = 7.5;
    const desiredCamX = cx - Math.sin(heading) * camDist;
    const desiredCamY = cy + camHeight;
    const desiredCamZ = cz - Math.cos(heading) * camDist;

    targetVec.current.set(cx, cy, cz);
    camVec.current.set(desiredCamX, desiredCamY, desiredCamZ);

    const lerpFactor = Math.min(1.0, delta * 4.5);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetVec.current, lerpFactor);
      camera.position.lerp(camVec.current, lerpFactor);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2 - 0.02}
      minDistance={2}
      maxDistance={75}
    />
  );
}

export default function Map3DCanvas({ liveData, liveTransform, showFloorplan = false, floorplanOpacity = 0.5 }) {
  const allReaders    = liveData?.allReaders?.length ? liveData.allReaders : defaultReaders;
  const currentReader = liveData?.currentReader || defaultReaders[0];
  const currentSeq    = currentReader.sequence || 1;
  const totalStops    = allReaders.filter((r) => !r.isWaypoint).length;
  const progressPct   = totalStops > 1 ? Math.round(((currentSeq - 1) / (totalStops - 1)) * 100) : 0;

  const remainingReaders = useMemo(() => {
    return allReaders.filter((r) => r.sequence >= currentSeq);
  }, [allReaders, currentSeq]);

  const currentCoords = currentReader.coords;
  const nextCoords    = remainingReaders.length > 1 ? remainingReaders[1].coords : null;

  // Manual camera state & Recenter trigger
  const [isManualCamera, setIsManualCamera] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const handleRecenter = () => {
    setIsManualCamera(false);
    setRecenterTrigger(Date.now());
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#f8fafc" }}>
      <Canvas camera={{ position: [0, 25, 25], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[15, 30, 15]} intensity={1.2} castShadow />
        <directionalLight position={[-15, 20, -15]} intensity={0.5} />
        <Suspense fallback={<Loader />}>
          <FloorplanReference visible={showFloorplan} opacity={floorplanOpacity} />
          <FacilityModel liveTransform={liveTransform} />
          <FlatPathLayer liveData={liveData} />
          <NavigationCameraController
            currentCoords={currentCoords}
            nextCoords={nextCoords}
            isManualCamera={isManualCamera}
            setIsManualCamera={setIsManualCamera}
            recenterTrigger={recenterTrigger}
          />
        </Suspense>
      </Canvas>

      {/* ── Status overlay card (top-left) ── */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          backgroundColor: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(8px)",
          borderRadius: "14px",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          border: "1px solid #e5e7eb",
          fontFamily: "Inter, system-ui, sans-serif",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: "#ef4444",
            boxShadow: "0 0 0 3px rgba(239,68,68,0.25)",
            flexShrink: 0,
          }}
        />
        <div>
          <span style={{ fontSize: "9px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>
            Current Location
          </span>
          <span style={{ fontSize: "13px", fontWeight: "800", color: "#1f2937" }}>
            {currentReader.location}
          </span>
        </div>
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#0ea5e9", backgroundColor: "#e0f2fe", padding: "3px 9px", borderRadius: "12px" }}>
          {progressPct}%
        </span>
      </div>

      {/* ── Floating Recenter Button (Appears when user manually interacts with camera) ── */}
      {isManualCamera && (
        <button
          onClick={handleRecenter}
          style={{
            position: "absolute",
            bottom: "24px",
            right: "20px",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(15, 23, 42, 0.88)",
            backdropFilter: "blur(10px)",
            color: "#ffffff",
            border: "1px solid rgba(14, 165, 233, 0.5)",
            borderRadius: "30px",
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(14, 165, 233, 0.35)",
            fontFamily: "Inter, system-ui, sans-serif",
            transition: "all 0.2s ease-in-out",
          }}
        >
          <LocateFixed size={18} color="#0ea5e9" />
          <span>Recenter</span>
        </button>
      )}
    </div>
  );
}