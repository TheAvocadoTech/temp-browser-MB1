// src/components/Map3DCanvas.js
import React, { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture, Html, useProgress, Line } from "@react-three/drei";
import * as THREE from "three";
import { LocateFixed, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import defaultReaders from "../config/rfidReaders.json";
import transform from "../config/mapTransform.json";
import { useSmoothLocation } from "../hooks/useSmoothLocation";

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

function LiveLocationDropMarker({ coords }) {
  const rootGroupRef = useRef();
  const pinGroupRef = useRef();
  const pulseRef = useRef();

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (coords && rootGroupRef.current) {
      const [targetWx, targetWy, targetWz] = pctToWorld(coords.x, coords.y, 0.05);
      const lerpSpeed = Math.min(1.0, delta * 14);
      rootGroupRef.current.position.x += (targetWx - rootGroupRef.current.position.x) * lerpSpeed;
      rootGroupRef.current.position.y += (targetWy - rootGroupRef.current.position.y) * lerpSpeed;
      rootGroupRef.current.position.z += (targetWz - rootGroupRef.current.position.z) * lerpSpeed;
    }

    if (pinGroupRef.current) {
      // Smooth hovering up and down
      pinGroupRef.current.position.y = 1.0 + Math.sin(t * 3.5) * 0.12;
      // Gentle subtle rotation
      pinGroupRef.current.rotation.y = Math.sin(t * 1.5) * 0.25;
    }
    if (pulseRef.current) {
      // Expanding floor ripple
      const progress = (t * 1.2) % 1;
      const scale = 1 + progress * 1.6;
      const opacity = Math.max(0, 0.5 * (1 - progress));
      pulseRef.current.scale.set(scale, scale, scale);
      if (pulseRef.current.material) {
        pulseRef.current.material.opacity = opacity;
      }
    }
  });

  if (!coords) return null;
  const [initWx, initWy, initWz] = pctToWorld(coords.x, coords.y, 0.05);

  return (
    <group ref={rootGroupRef} position={[initWx, initWy, initWz]}>
      {/* ── Ground Contact Ring & Pulsing Ripple ── */}
      <group position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Soft shadow disc under pin tip */}
        <mesh>
          <circleGeometry args={[0.32, 32]} />
          <meshBasicMaterial color="#000000" opacity={0.35} transparent depthWrite={false} />
        </mesh>
        {/* Floor landing dot */}
        <mesh>
          <circleGeometry args={[0.12, 24]} />
          <meshBasicMaterial color="#22c55e" depthWrite={false} />
        </mesh>
        {/* Expanding pulse ripple */}
        <mesh ref={pulseRef}>
          <ringGeometry args={[0.25, 0.42, 32]} />
          <meshBasicMaterial color="#22c55e" opacity={0.5} transparent depthWrite={false} />
        </mesh>
      </group>

      {/* ── Hovering 3D Drop Location Pin (Green) ── */}
      <group ref={pinGroupRef} position={[0, 1.0, 0]}>
        {/* Pin Top (Sphere) */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.36, 32, 32]} />
          <meshStandardMaterial
            color="#22c55e"
            roughness={0.2}
            metalness={0.15}
            emissive="#15803d"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Pin Bottom Cone (Pointing down towards floor) */}
        <mesh position={[0, 0.18, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.36, 0.68, 32]} />
          <meshStandardMaterial
            color="#22c55e"
            roughness={0.2}
            metalness={0.15}
            emissive="#15803d"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Inner White Core Disc / Dot */}
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
}

function FlatPathLayer({
  liveData,
  destination,
  activeRoute,
  selectedMarker,
  setSelectedMarker,
}) {
  const apiReaders    = (liveData?.allReaders?.length) ? liveData.allReaders : defaultReaders;
  const currentReader = liveData?.currentReader || defaultReaders[0];
  const currentSeq    = currentReader.sequence || 1;

  // Use activeRoute tailored for the destination or merge local coords
  const allReaders = useMemo(() => {
    if (activeRoute && activeRoute.length > 0) {
      return activeRoute;
    }
    return apiReaders.map((r) => {
      const local = defaultReaders.find((d) => d.id === r.id);
      return local ? { ...r, coords: local.coords, location: local.location } : r;
    });
  }, [activeRoute, apiReaders]);

  const activeReader =
    allReaders.find((r) => r.id === currentReader.id) || currentReader;

  // Continuous smooth location interpolation strictly tracking real live coordinates
  const {
    currentPos,
    currentAngle,
    passedPoints: smoothPassed,
    remainingPoints: smoothRemaining,
    activeSeq,
  } = useSmoothLocation({
    currentReader,
    allReaders,
    baseDuration: 400,
  });

  const animatedSeq = activeSeq ?? currentSeq;

  // 3D Point arrays for R3F Line
  const allPoints3D = useMemo(() => {
    return allReaders.map((r) => pctToWorld(r.coords.x, r.coords.y, 0.12));
  }, [allReaders]);

  const passedPoints3D = useMemo(() => {
    return smoothPassed.map((p) => pctToWorld(p.x, p.y, 0.14));
  }, [smoothPassed]);

  const remainingPoints3D = useMemo(() => {
    return smoothRemaining.map((p) => pctToWorld(p.x, p.y, 0.15));
  }, [smoothRemaining]);

  const destinationReader = destination || allReaders[allReaders.length - 1];

  return (
    <group>
      {/* ── 1. Full faint path underlay on 3D floor ── */}
      {allPoints3D.length > 1 && (
        <Line
          points={allPoints3D}
          color="#cbd5e1"
          opacity={0.3}
          transparent
          lineWidth={2}
        />
      )}

      {/* ── 2. Completed Path (Passed segments) — Translucent Red (20-30%) ── */}
      {passedPoints3D.length > 1 && (
        <>
          <Line
            points={passedPoints3D}
            color="#ef4444"
            opacity={0.12}
            transparent
            lineWidth={8}
          />
          <Line
            points={passedPoints3D}
            color="#ef4444"
            opacity={0.25}
            transparent
            lineWidth={4.5}
          />
        </>
      )}

      {/* ── 3. Active Remaining Path — Glowing Cyan Dashed Line ── */}
      {remainingPoints3D.length > 1 && (
        <>
          {/* Outer glow line */}
          <Line
            points={remainingPoints3D}
            color="#0ea5e9"
            opacity={0.35}
            transparent
            lineWidth={8}
          />
          {/* Core Line */}
          <Line
            points={remainingPoints3D}
            color="#0284c7"
            lineWidth={4.5}
            dashed
            dashScale={2}
            dashSize={0.6}
            gapSize={0.4}
          />
        </>
      )}

      {/* ── 3.1 Destination 3D Target Marker (Red Ring & Flag) ── */}
      {(() => {
        const dest = destinationReader;
        if (!dest?.coords) return null;
        const [dx, dy, dz] = pctToWorld(dest.coords.x, dest.coords.y, 0.16);
        return (
          <group
            position={[dx, dy, dz]}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMarker && setSelectedMarker(dest);
            }}
          >
            {/* Clickable invisible hit sphere */}
            <mesh>
              <sphereGeometry args={[0.7, 16, 16]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.48, 32]} />
              <meshBasicMaterial
                color="#ef4444"
                opacity={0.65}
                transparent
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.9, 16]} />
              <meshStandardMaterial color="#ef4444" roughness={0.3} />
            </mesh>
            <mesh position={[0.18, 0.75, 0]}>
              <boxGeometry args={[0.36, 0.22, 0.02]} />
              <meshStandardMaterial color="#ef4444" roughness={0.3} />
            </mesh>
          </group>
        );
      })()}

      {/* ── 3.5 Checkpoint Reader Station Nodes on 3D floor ── */}
      {allReaders.map((r) => {
        if (r.isWaypoint) return null;
        const [wx, wy, wz] = pctToWorld(r.coords.x, r.coords.y, 0.16);
        const isCurrent = r.sequence === animatedSeq;
        const isDestination =
          r.sequence === destinationReader?.sequence ||
          r.id === destinationReader?.id;
        const isPassed = r.sequence < animatedSeq;
        const isSelected =
          selectedMarker?.id === r.id ||
          (selectedMarker?.coords?.x === r.coords.x &&
            selectedMarker?.coords?.y === r.coords.y);
        const color = isCurrent
          ? "#22c55e"
          : isDestination
            ? "#ef4444"
            : isSelected
              ? "#38bdf8"
              : isPassed
                ? "#94a3b8"
                : "#0284c7";

        return (
          <group
            key={`node-3d-${r.id || `${r.coords.x}-${r.coords.y}`}`}
            position={[wx, wy, wz]}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMarker && setSelectedMarker(r);
            }}
          >
            {/* Clickable hit mesh */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.55, 16]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {isSelected && (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.26, 0.36, 24]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
            )}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[isSelected ? 0.26 : 0.22, 24]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
      })}

      {/* ── 3.6 Selected Location 3D Name Callout Bubble ── */}
      {selectedMarker?.coords &&
        (() => {
          const [wx, wy, wz] = pctToWorld(
            selectedMarker.coords.x,
            selectedMarker.coords.y,
            0.2,
          );
          return (
            <Html
              position={[wx, wy + 0.95, wz]}
              center
              distanceFactor={14}
              zIndexRange={[100, 0]}
            >
              <div
                style={{
                  backgroundColor: "rgba(15, 23, 42, 0.94)",
                  backdropFilter: "blur(10px)",
                  color: "#ffffff",
                  borderRadius: "10px",
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                  border: "1px solid rgba(56, 189, 248, 0.5)",
                  whiteSpace: "nowrap",
                  pointerEvents: "auto",
                  cursor: "pointer",
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "11px",
                  fontWeight: "800",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMarker && setSelectedMarker(null);
                }}
              >
                <span style={{ color: "#38bdf8" }}>
                  📍 {selectedMarker.location || selectedMarker.name || "Location"}
                </span>
                <span style={{ fontSize: "10px", opacity: 0.8 }}>✕</span>
              </div>
            </Html>
          );
        })()}

      {/* ── 4. Live Smoothly Moving 3D Drop Pin Marker ── */}
      <group>
        <LiveLocationDropMarker
          coords={currentPos}
          readerName={activeReader.location}
        />
      </group>

      {/* ── 5. Turn Chevrons flat on 3D floor at direction-change points ── */}
      {allReaders.map((r, i) => {
        if (!isTurnPoint(allReaders, i)) return null;
        if (r.sequence < animatedSeq) return null; // skip passed

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

      {/* ── 6. Leading direction arrow flat on floor at smooth position ── */}
      {smoothRemaining.length > 1 && (() => {
        const [cx, cy, cz] = pctToWorld(currentPos.x, currentPos.y, 0.2);
        const angle = -((currentAngle - 90) * Math.PI) / 180;

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
 * Keeps full facility map visible in overview with smooth recenter and interactive orbit
 */
function NavigationCameraController({ isManualCamera, setIsManualCamera, recenterTrigger, controlsExternalRef }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const targetVec = useRef(new THREE.Vector3(0, 0, 0));
  const camVec = useRef(new THREE.Vector3(0, 36, 26));

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

    targetVec.current.set(0, 0, 0);
    camVec.current.set(0, 36, 26);

    const lerpFactor = Math.min(1.0, delta * 3.5);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetVec.current, lerpFactor);
      camera.position.lerp(camVec.current, lerpFactor);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={(instance) => {
        controlsRef.current = instance;
        if (controlsExternalRef) {
          controlsExternalRef.current = instance;
        }
      }}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2 - 0.02}
      minDistance={5}
      maxDistance={90}
    />
  );
}

export default function Map3DCanvas({
  liveData,
  liveTransform,
  showFloorplan = false,
  floorplanOpacity = 0.5,
  destination,
  activeRoute,
  allMergedReaders,
  onOpenDestinationModal,
  onOpenReaderManager,
  onSelectDestination,
}) {
  const allReaders = (activeRoute && activeRoute.length > 0)
    ? activeRoute
    : (liveData?.allReaders?.length ? liveData.allReaders : defaultReaders);
  const currentReader = liveData?.currentReader || defaultReaders[0];
  const currentSeq    = currentReader.sequence || 1;
  const totalStops    = allReaders.filter((r) => !r.isWaypoint).length;
  const progressPct   = totalStops > 1 ? Math.round(((currentSeq - 1) / (totalStops - 1)) * 100) : 0;
  const destinationReader = destination || allReaders[allReaders.length - 1];

  // Selected marker state for click inspection
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Manual camera state & Recenter trigger
  const [isManualCamera, setIsManualCamera] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const controlsRef = useRef(null);

  const handleRecenter = () => {
    setIsManualCamera(false);
    setRecenterTrigger(Date.now());
  };

  const handleZoomIn = () => {
    setIsManualCamera(true);
    if (controlsRef.current) {
      controlsRef.current.dollyIn(1.3);
      controlsRef.current.update();
    }
  };

  const handleZoomOut = () => {
    setIsManualCamera(true);
    if (controlsRef.current) {
      controlsRef.current.dollyOut(1.3);
      controlsRef.current.update();
    }
  };

  const handleReset = () => {
    handleRecenter();
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#f8fafc", touchAction: "none" }}>
      <Canvas camera={{ position: [0, 36, 26], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[15, 30, 15]} intensity={1.2} castShadow />
        <directionalLight position={[-15, 20, -15]} intensity={0.5} />
        <Suspense fallback={<Loader />}>
          <FloorplanReference visible={showFloorplan} opacity={floorplanOpacity} />
          <FacilityModel liveTransform={liveTransform} />
          <FlatPathLayer
            liveData={liveData}
            destination={destination}
            activeRoute={activeRoute}
            selectedMarker={selectedMarker}
            setSelectedMarker={setSelectedMarker}
          />
          <NavigationCameraController
            isManualCamera={isManualCamera}
            setIsManualCamera={setIsManualCamera}
            recenterTrigger={recenterTrigger}
            controlsExternalRef={controlsRef}
          />
        </Suspense>
      </Canvas>

      {/* ── Zoom Controls Overlay (Top Right) ── */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          zIndex: 25,
        }}
      >
        {[
          { icon: <ZoomIn size={18} />, action: handleZoomIn, title: "Zoom In (+)" },
          { icon: <ZoomOut size={18} />, action: handleZoomOut, title: "Zoom Out (-)" },
          { icon: <RotateCcw size={16} />, action: handleReset, title: "Reset View" },
        ].map(({ icon, action, title }) => (
          <button
            key={title}
            onClick={(e) => {
              e.stopPropagation();
              action();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            title={title}
            aria-label={title}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "rgba(255,255,255,0.96)",
              border: "1px solid #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              color: "#1f2937",
              transition: "all 0.15s ease",
              touchAction: "manipulation",
            }}
          >
            {icon}
          </button>
        ))}
      </div>


      {/* ── Status overlay card (top-left) ── */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          backgroundColor: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(8px)",
          borderRadius: "14px",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          border: "1px solid #e5e7eb",
          fontFamily: "Inter, system-ui, sans-serif",
          zIndex: 20,
        }}
      >
        {/* Current Location */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              boxShadow: "0 0 0 3px rgba(34,197,94,0.3)",
              flexShrink: 0,
            }}
          />
          <div>
            <span style={{ fontSize: "8.5px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>
              Current
            </span>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "#1f2937" }}>
              {currentReader.location}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "1px", height: "24px", backgroundColor: "#e2e8f0" }} />

        {/* Destination Section */}
        <div
          onClick={onOpenDestinationModal}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: onOpenDestinationModal ? "pointer" : "default",
          }}
          title="Click to change destination"
        >
          <div
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "50%",
              backgroundColor: "#ef4444",
              boxShadow: "0 0 0 3px rgba(239,68,68,0.25)",
              flexShrink: 0,
            }}
          />
          <div>
            <span style={{ fontSize: "8.5px", fontWeight: "700", color: "#ef4444", letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>
              Destination
            </span>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "#1f2937" }}>
              {destinationReader?.name || destinationReader?.location}
            </span>
          </div>
        </div>

        <span style={{ fontSize: "11px", fontWeight: "700", color: "#0ea5e9", backgroundColor: "#e0f2fe", padding: "3px 8px", borderRadius: "10px" }}>
          {progressPct}%
        </span>
      </div>

      {/* ── Selected Location Card (bottom) ── */}
      {selectedMarker && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "16px",
            backgroundColor: "rgba(15, 23, 42, 0.94)",
            backdropFilter: "blur(10px)",
            color: "#ffffff",
            borderRadius: "14px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            zIndex: 35,
            fontSize: "12px",
            fontFamily: "Inter, system-ui, sans-serif",
            animation: "slideUp 0.2s ease-out",
          }}
        >
          <div
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "50%",
              backgroundColor: "#38bdf8",
              boxShadow: "0 0 8px #38bdf8",
              flexShrink: 0,
            }}
          />
          <div>
            <span
              style={{
                fontWeight: "800",
                color: "#f8fafc",
                fontSize: "13px",
                display: "block",
              }}
            >
              {selectedMarker.location || selectedMarker.name}
            </span>
            {selectedMarker.coords && (
              <span
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  display: "block",
                  marginTop: "2px",
                }}
              >
                Coordinates: X: {selectedMarker.coords.x}% · Y:{" "}
                {selectedMarker.coords.y}%
                {selectedMarker.sequence
                  ? ` · Stop #${selectedMarker.sequence}`
                  : ""}
              </span>
            )}
          </div>
          <button
            onClick={() => setSelectedMarker(null)}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#ffffff",
              borderRadius: "6px",
              width: "22px",
              height: "22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "11px",
              marginLeft: "4px",
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Floating Recenter Button (Appears when user manually interacts with camera) ── */}
      {isManualCamera && (
        <button
          onClick={handleRecenter}
          style={{
            position: "absolute",
            bottom: "74px",
            right: "16px",
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