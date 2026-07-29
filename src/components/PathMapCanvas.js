import React, { useState, useRef, useEffect } from "react";
import defaultReaders from "../config/rfidReaders.json";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

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

  // Fallback to defaultReaders if liveData is loading or empty
  const allReaders = (liveData?.allReaders && liveData.allReaders.length > 0) ? liveData.allReaders : defaultReaders;
  const currentReader = liveData?.currentReader || defaultReaders[0];
  const currentSeq = currentReader.sequence || 1;

  // Remaining path readers starting from current sequence
  const remainingReaders = allReaders.filter((r) => r.sequence >= currentSeq);

  // SVG viewBox coordinates (1000 x 700 matching map_floorplan.png aspect ratio)
  const pointsString = remainingReaders
    .map((r) => `${(r.coords.x / 100) * 1000},${(r.coords.y / 100) * 700}`)
    .join(" ");

  const startPoint = remainingReaders[0]?.coords || defaultReaders[0].coords;
  const nextPoint = remainingReaders[1]?.coords;

  let arrowAngle = 0;
  if (startPoint && nextPoint) {
    const dx = ((nextPoint.x - startPoint.x) / 100) * 1000;
    const dy = ((nextPoint.y - startPoint.y) / 100) * 700;
    arrowAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  }

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.4, 5.0));
  const handleZoomOut = () => {
    setZoom((z) => {
      const nextZ = Math.max(z - 0.4, 1.0);
      if (nextZ === 1.0) setPan({ x: 0, y: 0 });
      return nextZ;
    });
  };

  const handleResetZoom = () => {
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
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "contain",
            }}
          >
            {/* PDF Floorplan Background Image */}
            <image href={`${process.env.PUBLIC_URL}/map_floorplan.png`} x="0" y="0" width="1000" height="700" preserveAspectRatio="xMidYMid meet" />

            {/* Thin Gray Background Line for Total Path */}
            <polyline
              points={allReaders.map((r) => `${(r.coords.x / 100) * 1000},${(r.coords.y / 100) * 700}`).join(" ")}
              fill="none"
              stroke="rgba(156, 163, 175, 0.4)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dynamic Glowing Cyan Active Path (Shortened) */}
            {remainingReaders.length > 1 && (
              <>
                {/* Subtle Outer Glow */}
                <polyline
                  points={pointsString}
                  fill="none"
                  stroke="rgba(14, 165, 233, 0.35)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Core Thin Vibrant Cyan Line */}
                <polyline
                  points={pointsString}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Render All Reader Node Markers on Map */}
            {allReaders.map((r) => {
              if (r.isWaypoint) return null;
              const cx = (r.coords.x / 100) * 1000;
              const cy = (r.coords.y / 100) * 700;
              const isPassed = r.sequence < currentSeq;
              const isCurrent = r.sequence === currentSeq;

              return (
                <g key={r.id}>
                  {/* Passed Node (Grayed Out) */}
                  {isPassed && (
                    <circle cx={cx} cy={cy} r="3.5" fill="#9ca3af" opacity="0.6" />
                  )}

                  {/* Future Node Marker */}
                  {!isPassed && !isCurrent && (
                    <circle cx={cx} cy={cy} r="4" fill="#0ea5e9" opacity="0.9" />
                  )}

                  {/* Current Active Location Marker (Target Ring) */}
                  {isCurrent && (
                    <g>
                      {/* Outer Pulsating Neon Green Ring */}
                      <circle cx={cx} cy={cy} r="14" fill="rgba(132, 204, 22, 0.35)" />
                      <circle cx={cx} cy={cy} r="8" fill="none" stroke="#84cc16" strokeWidth="2.5" />
                      {/* Core Yellow/Green Center Dot */}
                      <circle cx={cx} cy={cy} r="3.5" fill="#84cc16" />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Directional Arrow at Current Location (Rotated towards upcoming path) */}
            {remainingReaders.length > 1 && (
              <g transform={`translate(${(startPoint.x / 100) * 1000}, ${(startPoint.y / 100) * 700}) rotate(${arrowAngle})`}>
                <polygon points="-8,6 0,-14 8,6 0,2" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            )}
          </svg>
        </div>

        {/* Floating Zoom & Pan Controls (Top Right Overlay) */}
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
          <button
            onClick={handleZoomIn}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              color: "#1f2937",
            }}
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleZoomOut}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              color: "#1f2937",
            }}
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={handleResetZoom}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #d1d5db",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              color: "#1f2937",
            }}
            title="Reset Zoom"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Dynamic Status Header Overlay Card */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            backgroundColor: "rgba(255, 255, 255, 0.94)",
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
          <div>
            <span style={{ fontSize: "10px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase", display: "block" }}>
              Current Active Location
            </span>
            <span style={{ fontSize: "14px", fontWeight: "800", color: "#1f2937" }}>
              #{currentSeq} - {currentReader.location}
            </span>
          </div>

          <div>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#0ea5e9", backgroundColor: "#e0f2fe", padding: "4px 10px", borderRadius: "12px" }}>
              Step {currentSeq} / {allReaders.length || 15}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
