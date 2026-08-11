import React, { useState, useRef, useEffect } from "react";
import defaultReaders from "../config/rfidReaders.json";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

// ── Geometry helpers ─────────────────────────────────────────────────────────
// Returns the angle in degrees from point a → b in SVG space (1000×700)
function angleBetween(a, b) {
  const dx = ((b.x - a.x) / 100) * 1000;
  const dy = ((b.y - a.y) / 100) * 700;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Returns true if the path at index i makes a meaningful turn (default > 25°)
function isTurnPoint(readers, i, threshold = 25) {
  if (i < 1 || i >= readers.length - 1) return false;
  const prev = readers[i - 1].coords;
  const curr = readers[i].coords;
  const next = readers[i + 1].coords;
  const inAngle  = angleBetween(prev, curr);
  const outAngle = angleBetween(curr, next);
  let diff = Math.abs(outAngle - inAngle);
  if (diff > 180) diff = 360 - diff;
  return diff > threshold;
}

// Open chevron path pointing RIGHT (0°) — rotated via SVG transform
// Looks like a road "turn" sign: two lines meeting at a tip, no fill
const CHEVRON_PATH = "M -8,-5 L 0,5 L 8,-5";

export default function PathMapCanvas({ liveData }) {
  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

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
  // Use live API readers if available, otherwise fall back to local JSON
  const apiReaders    = (liveData?.allReaders?.length) ? liveData.allReaders : defaultReaders;
  const currentReader = liveData?.currentReader || defaultReaders[0];
  const currentSeq    = currentReader.sequence || 1;

  // Merge local coords onto live data so edits to rfidReaders.json take effect
  const allReaders = apiReaders.map((r) => {
    const local = defaultReaders.find((d) => d.id === r.id);
    return local ? { ...r, coords: local.coords, location: local.location } : r;
  });

  const remainingReaders = allReaders.filter((r) => r.sequence >= currentSeq);

  // SVG coordinate helpers (viewBox 1000 × 700)
  const px = (x) => (x / 100) * 1000;
  const py = (y) => (y / 100) * 700;

  const allPoints       = allReaders.map((r)       => `${px(r.coords.x)},${py(r.coords.y)}`).join(" ");
  const remainingPoints = remainingReaders.map((r) => `${px(r.coords.x)},${py(r.coords.y)}`).join(" ");

  // Leading arrow direction (current → next)
  const currPt = remainingReaders[0]?.coords;
  const nextPt = remainingReaders[1]?.coords;
  const leadArrowAngle = currPt && nextPt ? angleBetween(currPt, nextPt) + 90 : 0;

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleZoomIn  = () => setZoom((z) => Math.min(z + 0.4, 5.0));
  const handleZoomOut = () => setZoom((z) => { const n = Math.max(z - 0.4, 1.0); if (n === 1.0) setPan({ x: 0, y: 0 }); return n; });
  const handleReset   = () => { setZoom(1.0); setPan({ x: 0, y: 0 }); };

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
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
          minHeight: 0,
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          overflow: "hidden",
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
          }}
        >
          <svg
            viewBox="0 0 1000 700"
            style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
          >
            {/* Floorplan background */}
            <image href={`${process.env.PUBLIC_URL}/map_floorplan.png`} x="0" y="0" width="1000" height="700" preserveAspectRatio="xMidYMid meet" />

            {/* ── Full ghost path (dim gray) ── */}
            <polyline
              points={allPoints}
              fill="none"
              stroke="rgba(156,163,175,0.4)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* ── Active remaining path (glowing cyan) ── */}
            {remainingReaders.length > 1 && (
              <>
                {/* Outer glow */}
                <polyline
                  points={remainingPoints}
                  fill="none"
                  stroke="rgba(14,165,233,0.32)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Core line */}
                <polyline
                  points={remainingPoints}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* ── Reader markers & location labels (NO bubbles) ── */}
            {allReaders.map((r) => {
              if (r.isWaypoint) return null;
              const cx = px(r.coords.x);
              const cy = py(r.coords.y);
              const isPassed  = r.sequence < currentSeq;
              const isCurrent = r.sequence === currentSeq;

              const dotColor   = isCurrent ? "#16a34a" : isPassed ? "#9ca3af" : "#0ea5e9";
              const dotOpacity = isPassed ? 0.5 : 1;
              const dotR       = isCurrent ? 3.5 : 2;

              const labelColor  = isCurrent ? "#15803d" : isPassed ? "#9ca3af" : "#0369a1";
              const labelWeight = isCurrent ? "700"      : "500";
              const labelSize   = isCurrent ? "11"       : "9.5";
              const labelY      = cy - (isCurrent ? 20 : 11);

              return (
                <g key={r.id}>
                  {/* Current location: pulsing rings */}
                  {isCurrent && (
                    <>
                      <circle cx={cx} cy={cy} r="14" fill="rgba(132,204,22,0.22)" />
                      <circle cx={cx} cy={cy} r="8"  fill="none" stroke="#84cc16" strokeWidth="2" />
                    </>
                  )}

                  {/* Tiny dot tick on the path (replaces large bubble) */}
                  <circle cx={cx} cy={cy} r={dotR} fill={dotColor} opacity={dotOpacity} />

                  {/* Location name label — no number, no bubble */}
                  <text
                    x={cx}
                    y={labelY}
                    textAnchor="middle"
                    fontSize={labelSize}
                    fontWeight={labelWeight}
                    fill={labelColor}
                    fontFamily="Inter, system-ui, sans-serif"
                    style={{ pointerEvents: "none" }}
                    paintOrder="stroke"
                    stroke="rgba(255,255,255,0.88)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  >
                    {r.location}
                  </text>
                </g>
              );
            })}

            {/* ── Turn chevrons at direction-change nodes ── */}
            {allReaders.map((r, i) => {
              if (!isTurnPoint(allReaders, i)) return null;
              // Skip already-passed nodes
              if (r.sequence < currentSeq) return null;

              const cx = px(r.coords.x);
              const cy = py(r.coords.y);

              const prev = allReaders[i - 1].coords;
              const next = allReaders[i + 1].coords;

              // Angle: chevron tip points in the outgoing direction
              // angleBetween returns 0° = right; chevron path is drawn pointing down (90°)
              // so subtract 90 to align tip with outgoing direction
              const outAngle = angleBetween(r.coords, next) - 90;

              // Offset: place the chevron slightly ahead of the node along the outgoing direction
              const outRad = (outAngle + 90) * (Math.PI / 180);
              const offsetX = Math.cos(outRad) * 14;
              const offsetY = Math.sin(outRad) * 14;

              return (
                <g
                  key={`turn-${r.id}`}
                  transform={`translate(${cx + offsetX},${cy + offsetY}) rotate(${outAngle})`}
                >
                  {/* Thin white halo for contrast against dark floorplan areas */}
                  <path
                    d={CHEVRON_PATH}
                    fill="none"
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Cyan chevron — matches the active path colour, clearly a direction cue */}
                  <path
                    d={CHEVRON_PATH}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* ── Leading direction arrow at current position ── */}
            {currPt && nextPt && (
              <g transform={`translate(${px(currPt.x)},${py(currPt.y)}) rotate(${leadArrowAngle})`}>
                <polygon points="-8,6 0,-14 8,6 0,2" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            )}
          </svg>
        </div>

        {/* ── Zoom Controls (top-right) ── */}
        <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", flexDirection: "column", gap: "6px", zIndex: 25 }}>
          {[
            { icon: <ZoomIn size={18} />,    action: handleZoomIn,  title: "Zoom In"    },
            { icon: <ZoomOut size={18} />,   action: handleZoomOut, title: "Zoom Out"   },
            { icon: <RotateCcw size={16} />, action: handleReset,   title: "Reset Zoom" },
          ].map(({ icon, action, title }) => (
            <button
              key={title}
              onClick={action}
              title={title}
              style={{
                width: "36px", height: "36px", borderRadius: "10px",
                backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid #d1d5db",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.1)", color: "#1f2937",
              }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* ── Status card (top-left) — location name only, no sequence number prefix ── */}
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
            zIndex: 20,
          }}
        >
          {/* Green pulse dot indicator */}
          <div
            style={{
              width: "10px", height: "10px", borderRadius: "50%",
              backgroundColor: "#84cc16",
              boxShadow: "0 0 0 3px rgba(132,204,22,0.3)",
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
            {currentSeq} / {allReaders.filter(r => !r.isWaypoint).length}
          </span>
        </div>
      </div>
    </div>
  );
}
