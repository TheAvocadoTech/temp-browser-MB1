import React, { useState, useRef, useEffect, useMemo } from "react";
import defaultReaders from "../config/rfidReaders.json";
import { ZoomIn, ZoomOut, RotateCcw, Navigation, Crosshair } from "lucide-react";
import { useSmoothLocation } from "../hooks/useSmoothLocation";

// ── Geometry helpers ─────────────────────────────────────────────────────────
// Returns the angle in degrees from point a → b in SVG space (1000×700)
function angleBetween(a, b) {
  const dx = ((b.x - a.x) / 100) * 1000;
  const dy = ((b.y - a.y) / 100) * 700;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Returns true if the path at index i makes a meaningful turn (> 25°)
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

// Open chevron path pointing RIGHT (0°) — rotated via SVG transform
const CHEVRON_PATH = "M -10,-6 L 0,6 L 10,-6";

export default function PathMapCanvas({
  liveData,
  destination,
  selectedKeyCabinetColo = "colo1",
  activeRoute,
  allMergedReaders,
  onOpenDestinationModal,
  onOpenReaderManager,
  isPickMode,
  setIsPickMode,
  onPickCoords,
}) {
  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  // Non-passive wheel event listener to fix Chrome/React preventDefault error
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelListener = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      setZoom((z) => {
        const nextZ = Math.min(Math.max(z + delta, 1.0), 5.0);
        if (nextZ === 1.0) setPan({ x: 0, y: 0 });
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

  // Merge route with local coords or use activeRoute tailored for destination
  const allReaders = useMemo(() => {
    if (activeRoute && activeRoute.length > 0) {
      return activeRoute;
    }
    return apiReaders.map((r) => {
      const local = defaultReaders.find((d) => d.id === r.id);
      return local ? { ...r, coords: local.coords, location: local.location } : r;
    });
  }, [activeRoute, apiReaders]);

  // All facility readers (base readers + any custom added locations)
  const allFacilityReaders = useMemo(() => {
    const source = allMergedReaders && allMergedReaders.length > 0 ? allMergedReaders : defaultReaders;
    return source.filter((r) => r && r.coords && typeof r.coords.x === "number" && typeof r.coords.y === "number");
  }, [allMergedReaders]);

  // Off-route facility readers not part of activeRoute
  const offRouteReaders = useMemo(() => {
    const routeIds = new Set(allReaders.map((r) => r.id));
    return allFacilityReaders.filter((r) => !routeIds.has(r.id) && !r.isWaypoint);
  }, [allFacilityReaders, allReaders]);

  const activeReader =
    allReaders.find((r) => r.id === currentReader.id || (currentReader.sequence && r.sequence === currentReader.sequence)) ||
    currentReader;

  // Continuous smooth location interpolation
  const {
    currentPos,
    currentAngle,
    passedPoints: smoothPassed,
    remainingPoints: smoothRemaining,
    activeSeq,
  } = useSmoothLocation({
    currentReader: activeReader,
    allReaders,
    baseDuration: 400,
  });

  const animatedSeq = activeSeq ?? currentSeq;

  // SVG coordinate helpers (viewBox 1000 × 700)
  const px = (x) => (x / 100) * 1000;
  const py = (y) => (y / 100) * 700;

  const allPoints = allReaders.map((r) => `${px(r.coords.x)},${py(r.coords.y)}`).join(" ");
  const passedPoints = smoothPassed.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");
  const remainingPoints = smoothRemaining.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");

  const totalStops = allReaders.filter((r) => !r.isWaypoint).length;
  const currentStopIndex = allReaders.filter((r) => !r.isWaypoint && r.sequence <= currentSeq).length;

  // Dynamic floor plan selection:
  // - Key Cabinet (Colo 1) -> /map_colo1.png
  // - Key Cabinet (Colo 2) -> /map_colo2.png
  // - Key Cabinet (Colo 3) -> /map_colo3.png
  // - Washroom, NOC, Loading area (and other non-cabinet locations) -> /map_nodata.png
  const floorplanImage = useMemo(() => {
    const isCabinet =
      destination?.category === "Cabinet" ||
      destination?.id?.startsWith("dest-key-cabinet") ||
      destination?.name?.toLowerCase().includes("key cabinet") ||
      destination?.name?.toLowerCase().includes("cabinet");

    if (isCabinet) {
      const colo = destination?.cabinetColo || selectedKeyCabinetColo || "colo1";
      if (colo === "colo2") {
        return `${process.env.PUBLIC_URL}/map_colo2.png`;
      }
      if (colo === "colo3") {
        return `${process.env.PUBLIC_URL}/map_colo3.png`;
      }
      return `${process.env.PUBLIC_URL}/map_colo1.png`;
    }

    // Default for Washroom, NOC, Loading area:
    return `${process.env.PUBLIC_URL}/map_nodata.png`;
  }, [destination, selectedKeyCabinetColo]);

  // Destination
  const destinationReader = destination || allReaders[allReaders.length - 1];

  // ── Controls ─────────────────────────────────────────────────────────────
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

  const handleMouseDown = (e) => {
    if (zoom > 1 && e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const handleSvgClick = (e) => {
    if (isPickMode && onPickCoords && svgRef.current) {
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const cursorPt = pt.matrixTransform(svg.getScreenCTM().inverse());
      const pctX = Number(Math.min(100, Math.max(0, (cursorPt.x / 1000) * 100)).toFixed(1));
      const pctY = Number(Math.min(100, Math.max(0, (cursorPt.y / 700) * 100)).toFixed(1));
      onPickCoords({ x: pctX, y: pctY });
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
      {/* ── Active Pick Mode Banner Overlay ── */}
      {isPickMode && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#0ea5e9",
            color: "#ffffff",
            padding: "8px 18px",
            borderRadius: "30px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 60,
            boxShadow: "0 8px 24px rgba(14, 165, 233, 0.4)",
            fontSize: "12px",
            fontWeight: "700",
            animation: "pulse 1.8s infinite",
          }}
        >
          <Crosshair size={16} />
          <span>Click on floorplan to pick coordinates</span>
          <button
            onClick={() => setIsPickMode && setIsPickMode(false)}
            style={{
              background: "rgba(255,255,255,0.25)",
              border: "none",
              color: "#ffffff",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Interactive Map Graphic SVG Overlay Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          flex: 1,
          position: "relative",
          width: "100%",
          height: "100%",
          minHeight: 0,
          cursor: isPickMode ? "crosshair" : zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
        }}
      >
        {/* Zoom & Pan Wrapper Element */}
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            ref={svgRef}
            onClick={handleSvgClick}
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
            {/* Defs: Drop shadows, gradients, and filters */}
            <defs>
              <filter id="path-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="node-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.25" />
              </filter>
            </defs>

            {/* Dynamic Floorplan background: Colo 1, Colo 2, Colo 3, or No Data map */}
            <image
              href={floorplanImage}
              x="0"
              y="0"
              width="1000"
              height="700"
              preserveAspectRatio="xMidYMid meet"
            />

            {/* ── 1. Background guide track line (subtle underlying channel) ── */}
            <polyline
              points={allPoints}
              fill="none"
              stroke="rgba(148, 163, 184, 0.15)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* ── 2. Completed Path (Passed segments) — Solid Line of Same Colour and Opacity ── */}
            {smoothPassed.length > 1 && (
              <>
                {/* Glow for completed path */}
                <polyline
                  points={passedPoints}
                  fill="none"
                  stroke="rgba(14, 165, 233, 0.25)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Core Solid Line of same colour (#0284c7) and opacity */}
                <polyline
                  points={passedPoints}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="1"
                />
              </>
            )}

            {/* ── 3. Active Remaining Path — Vivid Cyan Dotted Thin Crisp Line ── */}
            {smoothRemaining.length > 1 && (
              <>
                {/* Subtle Glow */}
                <polyline
                  points={remainingPoints}
                  fill="none"
                  stroke="rgba(14, 165, 233, 0.25)"
                  strokeWidth="8"
                  strokeDasharray="1 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Core Active Dotted Line (Thin & Sharp) */}
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

            {/* ── 4. Turn chevrons at direction-change nodes ── */}
            {allReaders.map((r, i) => {
              if (!isTurnPoint(allReaders, i)) return null;
              // Skip already-passed turns
              if (r.sequence < animatedSeq) return null;

              const cx = px(r.coords.x);
              const cy = py(r.coords.y);
              const next = allReaders[i + 1]?.coords;
              if (!next) return null;

              const outAngle = angleBetween(r.coords, next) - 90;
              const outRad = (outAngle + 90) * (Math.PI / 180);
              const offsetX = Math.cos(outRad) * 16;
              const offsetY = Math.sin(outRad) * 16;

              return (
                <g
                  key={`turn-${r.id || i}`}
                  transform={`translate(${cx + offsetX},${cy + offsetY}) rotate(${outAngle})`}
                >
                  {/* White halo */}
                  <path
                    d={CHEVRON_PATH}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Cyan chevron */}
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

            {/* ── 4.9 Off-Route Facility Reader Locations ── */}
            {offRouteReaders.map((r) => {
              const cx = px(r.coords.x);
              const cy = py(r.coords.y);

              return (
                <g key={`facility-${r.id || `${r.coords.x}-${r.coords.y}`}`} pointerEvents="none">
                  <title>{r.location || r.name || "Reader Location"}</title>
                  {/* Subtle outer dashed halo */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="7"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                    opacity="0.65"
                  />
                  {/* Base station dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={3.2}
                    fill="#94a3b8"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    filter="url(#node-shadow)"
                  />
                </g>
              );
            })}

            {/* ── 5. Fixed Reader Checkpoint Stations ── */}
            {allReaders.map((r) => {
              if (r.isWaypoint) return null;
              const cx = px(r.coords.x);
              const cy = py(r.coords.y);
              const isPassed = r.sequence < animatedSeq;
              const isCurrent = r.sequence === animatedSeq;
              const isDestination =
                r.sequence === destinationReader?.sequence || r.id === destinationReader?.id;

              // Colors based on status
              const nodeBg = isCurrent ? "#22c55e" : isPassed ? "#94a3b8" : "#0284c7";

              return (
                <g key={r.id || `${r.coords.x}-${r.coords.y}`} pointerEvents="none">
                  <title>{r.location || r.name || "Reader Location"}</title>

                  {/* Destination Marker Ring */}
                  {isDestination && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="11"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2.5"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Node Dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isCurrent ? 4.5 : isDestination ? 4.5 : 3}
                    fill={isDestination && !isPassed ? "#ef4444" : nodeBg}
                    stroke="#ffffff"
                    strokeWidth={isCurrent || isDestination ? 1.8 : 1}
                    filter="url(#node-shadow)"
                  />
                </g>
              );
            })}

            {/* ── 5.1 Highlighted Destination Pin & Tag Badge ── */}
            {destinationReader?.coords && (
              <g
                transform={`translate(${px(destinationReader.coords.x)},${py(destinationReader.coords.y)})`}
                pointerEvents="none"
              >
                <circle r="14" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeDasharray="3 3">
                  <animate attributeName="r" values="10;17;10" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2.2s" repeatCount="indefinite" />
                </circle>
                <circle r="5.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" filter="url(#node-shadow)" />
                {/* Destination name label tag */}
                <g transform="translate(0, -15)">
                  <rect
                    x="-42"
                    y="-14"
                    width="84"
                    height="16"
                    rx="8"
                    fill="#0f172a"
                    opacity="0.9"
                  />
                  <text
                    x="0"
                    y="-3"
                    fill="#ffffff"
                    fontSize="8.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    🎯 {destinationReader.name || destinationReader.location || "Destination"}
                  </text>
                </g>
              </g>
            )}

            {/* ── 6. Live Smoothly Moving Location Radar Pulse & Marker ── */}
            {currentPos && (
              <g pointerEvents="none">
                <circle cx={px(currentPos.x)} cy={py(currentPos.y)} r="22" fill="rgba(34, 197, 94, 0.2)">
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
                <circle cx={px(currentPos.x)} cy={py(currentPos.y)} r="14" fill="rgba(34, 197, 94, 0.35)" />
                <circle cx={px(currentPos.x)} cy={py(currentPos.y)} r="9" fill="none" stroke="#22c55e" strokeWidth="2.5" />
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

            {/* ── 7. Smooth Direction Arrow Indicator ── */}
            {currentPos && (
              <g transform={`translate(${px(currentPos.x)},${py(currentPos.y)}) rotate(${currentAngle + 90})`} pointerEvents="none">
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

        {/* ── Zoom & Action Controls (top-right) ── */}
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
          {onOpenDestinationModal && (
            <button
              onClick={onOpenDestinationModal}
              title="Change Destination (Key cabinet, Washroom, NOC, Loading area)"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#0284c7",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.35)",
                color: "#ffffff",
                transition: "all 0.15s ease",
              }}
            >
              <Navigation size={18} />
            </button>
          )}

          {[
            { icon: <ZoomIn size={18} />, action: handleZoomIn, title: "Zoom In" },
            { icon: <ZoomOut size={18} />, action: handleZoomOut, title: "Zoom Out" },
            { icon: <RotateCcw size={16} />, action: handleReset, title: "Reset View (Fit Full Map)" },
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

        {/* ── Status Card (top-left) ── */}
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
            zIndex: 20,
          }}
        >
          {/* Current Location Section */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.3)",
                flexShrink: 0,
              }}
            />
            <div>
              <span
                style={{
                  fontSize: "8.5px",
                  fontWeight: "700",
                  color: "#6b7280",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                }}
              >
                Current
              </span>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a" }}>
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
                boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.25)",
                flexShrink: 0,
              }}
            />
            <div>
              <span
                style={{
                  fontSize: "8.5px",
                  fontWeight: "700",
                  color: "#ef4444",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                }}
              >
                Destination
              </span>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a" }}>
                {destination?.category === "Cabinet"
                  ? `Key cabinet (${destination.cabinetColo === "colo2" ? "Colo 2" : destination.cabinetColo === "colo3" ? "Colo 3" : "Colo 1"})`
                  : destination?.name || destinationReader.name || destinationReader.location}
              </span>
            </div>
          </div>

          {/* Stops progress badge */}
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#0284c7",
              backgroundColor: "#e0f2fe",
              padding: "3px 8px",
              borderRadius: "10px",
            }}
          >
            {currentStopIndex} / {totalStops}
          </span>
        </div>

        {/* ── Path Legend (bottom-left) ── */}
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
            <span>
              To{" "}
              {destination?.category === "Cabinet"
                ? `Key cabinet (${destination.cabinetColo === "colo2" ? "Colo 2" : destination.cabinetColo === "colo3" ? "Colo 3" : "Colo 1"})`
                : destination?.name || destinationReader.name || "Destination"}
            </span>
          </div>
        </div>


      </div>
    </div>
  );
}
