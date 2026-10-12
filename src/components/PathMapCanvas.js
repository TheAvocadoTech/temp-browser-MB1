import React, { useState, useRef, useEffect, useMemo } from "react";
import defaultReaders from "../config/rfidReaders.json";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useSmoothLocation } from "../hooks/useSmoothLocation";

// ── Geometry helpers ─────────────────────────────────────────────────────────
function angleBetween(a, b) {
  const dx = ((b.x - a.x) / 100) * 1000;
  const dy = ((b.y - a.y) / 100) * 700;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function isTurnPoint(readers, i, threshold = 25) {
  if (i < 1 || i >= readers.length - 1) return false;
  const prev = readers[i - 1].coords;
  const curr = readers[i].coords;
  const next = readers[i + 1].coords;
  const inAngle = angleBetween(prev, curr);
  const outAngle = angleBetween(curr, next);
  let diff = Math.abs(outAngle - inAngle);
  if (diff > 180) diff = 360 - diff;
  return diff > threshold;
}

const CHEVRON_PATH = "M -10,-6 L 0,6 L 10,-6";

// ── Map source dimensions (must match MAP_CONFIGS in mistAssetTracker.js) ──
const MAP_PIXEL_W = 6400;
const MAP_PIXEL_H = 5120;

export default function PathMapCanvas({
  liveData,
  // "route" (default) → snap dot to reader chain via useSmoothLocation
  // "wifi"            → use liveData.position_px from the Mist tracker
  // "auto"            → prefer wifi if available, fall back to route
  positionSource = "auto",
}) {
  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const zoomRef = useRef(1);

  // Keep zoomRef in sync (needed inside the non-passive wheel listener)
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // ── Non-passive wheel listener (cursor-anchored zoom) ────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelListener = (e) => {
      // Let the page scroll when we're already at min zoom and user scrolls down
      if (zoomRef.current <= 1 && e.deltaY > 0) return;

      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      setZoom((z) => {
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        const nextZ = Math.min(Math.max(z + delta, 1.0), 5.0);

        if (nextZ === 1.0) {
          setPan({ x: 0, y: 0 });
          return nextZ;
        }

        // Anchor zoom on the cursor position
        const scaleChange = nextZ / z;
        setPan((p) => ({
          x: mx - scaleChange * (mx - p.x),
          y: my - scaleChange * (my - p.y),
        }));
        return nextZ;
      });
    };

    container.addEventListener("wheel", handleWheelListener, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheelListener);
    };
  }, []);

  // ── Data ─────────────────────────────────────────────────────────────────
  const apiReaders = liveData?.allReaders?.length ? liveData.allReaders : defaultReaders;
  const currentReader = liveData?.currentReader || defaultReaders[0];
  const currentSeq = currentReader.sequence || 1;

  // Merge local coords onto live data so edits to rfidReaders.json take effect
  const allReaders = useMemo(() => {
    return apiReaders.map((r) => {
      const local = defaultReaders.find((d) => d.id === r.id);
      return local ? { ...r, coords: local.coords, location: local.location } : r;
    });
  }, [apiReaders]);

  const activeReader =
    allReaders.find(
      (r) =>
        r.id === currentReader.id ||
        (currentReader.sequence && r.sequence === currentReader.sequence)
    ) || currentReader;

  // Route-based interpolation (fallback / default)
  const {
    currentPos: routePos,
    currentAngle: routeAngle,
    passedPoints: smoothPassed,
    remainingPoints: smoothRemaining,
    activeSeq,
  } = useSmoothLocation({
    currentReader: activeReader,
    allReaders,
    baseDuration: 400,
  });

  const animatedSeq = activeSeq ?? currentSeq;

  // ── SVG coordinate helpers (viewBox 1000 × 700) ─────────────────────────
  const px = (x) => (x / 100) * 1000;
  const py = (y) => (y / 100) * 700;

  // ── WiFi position from Mist tracker (optional) ─────────────────────────
  // liveData.position_px is expected in map pixel space (0..6400 × 0..5120).
  // Convert to the 0..100 grid used by this canvas, so px()/py() work.
  const wifiPos = useMemo(() => {
    const p = liveData?.position_px;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return {
      x: (p.x / MAP_PIXEL_W) * 100,
      y: (p.y / MAP_PIXEL_H) * 100,
    };
  }, [liveData?.position_px]);

  // Resolve which position drives the dot
  const useWifi =
    (positionSource === "wifi" && wifiPos) ||
    (positionSource === "auto" && wifiPos);

  const currentPos = useWifi ? wifiPos : routePos;
  const currentAngle = useWifi ? 0 : routeAngle; // WiFi has no bearing yet

  const allPoints = allReaders
    .map((r) => `${px(r.coords.x)},${py(r.coords.y)}`)
    .join(" ");
  const passedPoints = smoothPassed.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");
  const remainingPoints = smoothRemaining
    .map((p) => `${px(p.x)},${py(p.y)}`)
    .join(" ");

  const totalStops = allReaders.filter((r) => !r.isWaypoint).length;
  // Use animatedSeq so the badge matches the dot during transitions
  const currentStopIndex = allReaders.filter(
    (r) => !r.isWaypoint && r.sequence <= animatedSeq
  ).length;

  const destinationReader = allReaders[allReaders.length - 1];

  // ── Controls ────────────────────────────────────────────────────────────
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.4, 5.0));
  const handleZoomOut = () =>
    setZoom((z) => {
      const n = Math.max(z - 0.4, 1.0);
      if (n === 1.0) setPan({ x: 0, y: 0 });
      return n;
    });
  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // ── Pointer events (mouse + touch + pen) ────────────────────────────────
  const handlePointerDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      if (e.currentTarget.setPointerCapture) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }
    }
  };
  const handlePointerMove = (e) => {
    if (isDragging && zoom > 1) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };
  const handlePointerUp = (e) => {
    setIsDragging(false);
    if (e?.currentTarget?.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#ffffff",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          flex: 1,
          position: "relative",
          width: "100%",
          height: "100%",
          minHeight: 0,
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          touchAction: zoom > 1 ? "none" : "auto",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            viewBox="0 0 1000 700"
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "contain",
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            <defs>
              <filter id="path-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="node-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="2.5"
                  floodColor="#0f172a"
                  floodOpacity="0.25"
                />
              </filter>
            </defs>

            {/* Floorplan background */}
            <image
              href={`${process.env.PUBLIC_URL}/map_floorplan.png`}
              x="0"
              y="0"
              width="1000"
              height="700"
              preserveAspectRatio="xMidYMid meet"
            />

            {/* 1. Background guide track */}
            <polyline
              points={allPoints}
              fill="none"
              stroke="rgba(148, 163, 184, 0.15)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 2. Completed path */}
            {smoothPassed.length > 1 && (
              <polyline
                points={passedPoints}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="3.5"
                strokeDasharray="1 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
              />
            )}

            {/* 3. Remaining path */}
            {smoothRemaining.length > 1 && (
              <>
                <polyline
                  points={remainingPoints}
                  fill="none"
                  stroke="rgba(14, 165, 233, 0.25)"
                  strokeWidth="8"
                  strokeDasharray="1 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={remainingPoints}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="3.5"
                  strokeDasharray="1 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* 4. Turn chevrons */}
            {allReaders.map((r, i) => {
              if (!isTurnPoint(allReaders, i)) return null;
              if (r.sequence < animatedSeq) return null;

              const cx = px(r.coords.x);
              const cy = py(r.coords.y);
              const next = allReaders[i + 1].coords;

              const outAngle = angleBetween(r.coords, next) - 90;
              const outRad = (outAngle + 90) * (Math.PI / 180);
              const offsetX = Math.cos(outRad) * 16;
              const offsetY = Math.sin(outRad) * 16;

              return (
                <g
                  key={`turn-${r.id}`}
                  transform={`translate(${cx + offsetX},${cy + offsetY}) rotate(${outAngle})`}
                >
                  <path
                    d={CHEVRON_PATH}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={CHEVRON_PATH}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* 5. Reader checkpoints */}
            {allReaders.map((r) => {
              if (r.isWaypoint) return null;
              const cx = px(r.coords.x);
              const cy = py(r.coords.y);
              const isPassed = r.sequence < animatedSeq;
              const isCurrent = r.sequence === animatedSeq;
              const isDestination = r.sequence === destinationReader?.sequence;

              const nodeBg = isCurrent
                ? "#22c55e"
                : isPassed
                ? "#94a3b8"
                : "#0284c7";

              return (
                <g key={r.id}>
                  {isDestination && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="10"
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isCurrent ? 4.5 : isDestination ? 4 : 3}
                    fill={isDestination && !isPassed ? "#dc2626" : nodeBg}
                    stroke="#ffffff"
                    strokeWidth={isCurrent ? 1.5 : 1}
                    filter="url(#node-shadow)"
                  />
                </g>
              );
            })}

            {/* 6. Live position dot */}
            {currentPos && (
              <g>
                <circle
                  cx={px(currentPos.x)}
                  cy={py(currentPos.y)}
                  r="22"
                  fill="rgba(34, 197, 94, 0.2)"
                >
                  <animate
                    attributeName="r"
                    values="16;28;16"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.35;0.05;0.35"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  cx={px(currentPos.x)}
                  cy={py(currentPos.y)}
                  r="14"
                  fill="rgba(34, 197, 94, 0.35)"
                />
                <circle
                  cx={px(currentPos.x)}
                  cy={py(currentPos.y)}
                  r="9"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                />
                <circle
                  cx={px(currentPos.x)}
                  cy={py(currentPos.y)}
                  r="5"
                  fill="#22c55e"
                  stroke="#ffffff"
                  strokeWidth="2"
                  filter="url(#node-shadow)"
                />
              </g>
            )}

            {/* 7. Direction arrow (only shown in route mode) */}
            {currentPos && !useWifi && (
              <g
                transform={`translate(${px(currentPos.x)},${py(
                  currentPos.y
                )}) rotate(${currentAngle + 90})`}
              >
                <polygon
                  points="-9,7 0,-16 9,7 0,2"
                  fill="#0284c7"
                  stroke="#ffffff"
                  strokeWidth="2"
                  filter="url(#node-shadow)"
                />
              </g>
            )}
          </svg>
        </div>

        {/* Zoom Controls */}
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
            { icon: <ZoomIn size={18} />, action: handleZoomIn, title: "Zoom In" },
            { icon: <ZoomOut size={18} />, action: handleZoomOut, title: "Zoom Out" },
            {
              icon: <RotateCcw size={16} />,
              action: handleReset,
              title: "Reset View (Fit Full Map)",
            },
          ].map(({ icon, action, title }) => (
            <button
              key={title}
              onClick={action}
              title={title}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "rgba(255,255,255,0.96)",
                border: "1px solid #d1d5db",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                color: "#1f2937",
                transition: "all 0.15s ease",
              }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Status Card */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            backgroundColor: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(8px)",
            borderRadius: "14px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            border: "1px solid #e5e7eb",
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.3)",
              flexShrink: 0,
            }}
          />
          <div>
            <span
              style={{
                fontSize: "9px",
                fontWeight: "700",
                color: "#6b7280",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                display: "block",
              }}
            >
              Current Location
            </span>
            <span
              style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a" }}
            >
              {currentReader.location}
            </span>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#0284c7",
              backgroundColor: "#e0f2fe",
              padding: "3px 9px",
              borderRadius: "12px",
            }}
          >
            {currentStopIndex} / {totalStops}
          </span>
        </div>

        {/* Path Legend */}
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            backgroundColor: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(6px)",
            borderRadius: "10px",
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "11px",
            fontWeight: "600",
            color: "#475569",
            border: "1px solid #e2e8f0",
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "14px",
                height: "4px",
                backgroundColor: "#94a3b8",
                borderRadius: "2px",
                display: "inline-block",
              }}
            />
            <span>Completed</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "14px",
                height: "4px",
                backgroundColor: "#0284c7",
                borderRadius: "2px",
                display: "inline-block",
              }}
            />
            <span>Remaining Path</span>
          </div>
        </div>
      </div>
    </div>
  );
}
