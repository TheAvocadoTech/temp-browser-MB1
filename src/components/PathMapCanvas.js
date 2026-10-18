import React, { useState, useRef, useEffect, useMemo } from "react";
import defaultReaders from "../config/rfidReaders.json";
import { ZoomIn, ZoomOut, RotateCcw, Crosshair } from "lucide-react";
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
  // ── Unified Zoom & Pan Gestures (Button, Wheel Scroll, and Pinch-to-Zoom on all devices) ──
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);

  const containerRef = useRef(null);
  const svgRef = useRef(null);

  // Mutable refs to prevent stale closures in native wheel and touch listeners
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Multi-touch pinch tracking for Mobile and Tablet
  const touchStateRef = useRef({
    mode: null, // "pan" | "pinch"
    initialDistance: 0,
    initialZoom: 1,
    initialPan: { x: 0, y: 0 },
    midpoint: { x: 0, y: 0 },
    lastTouch: { x: 0, y: 0 },
  });

  // Clamp pan so map content stays comfortably within view
  const clampPan = (newPan, currentZoom, containerWidth = 1000, containerHeight = 700) => {
    if (currentZoom <= 1.01) return { x: 0, y: 0 };
    const maxX = (containerWidth * (currentZoom - 1)) / 1.7;
    const maxY = (containerHeight * (currentZoom - 1)) / 1.7;
    return {
      x: Math.min(maxX, Math.max(-maxX, newPan.x)),
      y: Math.min(maxY, Math.max(-maxY, newPan.y)),
    };
  };

  const updateZoomPan = (newZoom, newPan) => {
    const clampedZoom = Math.min(Math.max(newZoom, 1.0), 6.0);
    const container = containerRef.current;
    const rect = container ? container.getBoundingClientRect() : { width: 1000, height: 700 };
    const clampedPan = clampedZoom <= 1.01 ? { x: 0, y: 0 } : clampPan(newPan, clampedZoom, rect.width, rect.height);

    zoomRef.current = clampedZoom;
    panRef.current = clampedPan;
    setZoom(clampedZoom);
    setPan(clampedPan);
  };

  // 1. Button Zoom Controls
  const handleZoomIn = () => {
    updateZoomPan(zoomRef.current + 0.4, panRef.current);
  };

  const handleZoomOut = () => {
    updateZoomPan(zoomRef.current - 0.4, panRef.current);
  };

  const handleReset = () => {
    updateZoomPan(1.0, { x: 0, y: 0 });
  };

  // 2. Wheel Scroll Zoom (Desktop / Laptop / Trackpad)
  const handleWheel = (e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;

    // Handles trackpad pinch gestures (ctrlKey) and traditional scroll wheels
    const delta = e.ctrlKey ? -e.deltaY * 0.02 : -e.deltaY * 0.0025;
    const factor = Math.exp(delta);
    const nextZoom = Math.min(Math.max(1.0, currentZoom * factor), 6.0);

    if (Math.abs(nextZoom - 1.0) < 0.02) {
      updateZoomPan(1.0, { x: 0, y: 0 });
      return;
    }

    // Zoom centered towards mouse/pointer position
    const scaleRatio = nextZoom / currentZoom;
    const newPanX = mouseX - (mouseX - currentPan.x) * scaleRatio;
    const newPanY = mouseY - (mouseY - currentPan.y) * scaleRatio;

    updateZoomPan(nextZoom, { x: newPanX, y: newPanY });
  };

  // 3. Touch Gestures: Pinch Zoom and Single-Finger Pan (Mobile and Tablet)
  const getTouchDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  const getTouchMidpoint = (t1, t2, rect) => ({
    x: (t1.clientX + t2.clientX) / 2 - rect.left - rect.width / 2,
    y: (t1.clientY + t2.clientY) / 2 - rect.top - rect.height / 2,
  });

  // Track double tap on touchscreens
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  // Helper for marker clicks that ignores clicks that originated from a pan/drag gesture
  const handleMarkerClick = (marker, e) => {
    e.stopPropagation();
    if (hasDraggedRef.current) {
      return;
    }
    setSelectedMarker(marker);
  };

  const handleTouchStart = (e) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const mid = getTouchMidpoint(e.touches[0], e.touches[1], rect);
      touchStateRef.current = {
        mode: "pinch",
        initialDistance: dist,
        initialZoom: zoomRef.current,
        initialPan: { ...panRef.current },
        midpoint: mid,
        lastTouch: { x: 0, y: 0 },
      };
      setIsDragging(true);
      isDraggingRef.current = true;
      hasDraggedRef.current = true;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      const prevTap = lastTapRef.current;
      const timeDiff = now - prevTap.time;
      const distDiff = Math.hypot(touch.clientX - prevTap.x, touch.clientY - prevTap.y);

      // Double-tap to zoom in / reset view on touchscreen
      if (timeDiff < 320 && distDiff < 35) {
        e.preventDefault();
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        if (zoomRef.current > 1.2) {
          updateZoomPan(1.0, { x: 0, y: 0 });
        } else {
          const mouseX = touch.clientX - rect.left - rect.width / 2;
          const mouseY = touch.clientY - rect.top - rect.height / 2;
          const targetZoom = 2.5;
          const newPanX = mouseX - (mouseX - panRef.current.x) * (targetZoom / zoomRef.current);
          const newPanY = mouseY - (mouseY - panRef.current.y) * (targetZoom / zoomRef.current);
          updateZoomPan(targetZoom, { x: newPanX, y: newPanY });
        }
        return;
      }
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };

      if (zoomRef.current > 1.02) {
        touchStateRef.current = {
          mode: "pan",
          initialDistance: 0,
          initialZoom: zoomRef.current,
          initialPan: { ...panRef.current },
          midpoint: { x: 0, y: 0 },
          lastTouch: { x: touch.clientX, y: touch.clientY },
        };
        setIsDragging(true);
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
      }
    }
  };

  const handleTouchMove = (e) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ts = touchStateRef.current;

    if (e.touches.length === 2 && ts.mode === "pinch") {
      e.preventDefault();
      hasDraggedRef.current = true;
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const currentMid = getTouchMidpoint(e.touches[0], e.touches[1], rect);

      if (ts.initialDistance > 5) {
        const scale = dist / ts.initialDistance;
        const nextZoom = Math.min(Math.max(1.0, ts.initialZoom * scale), 6.0);

        if (nextZoom <= 1.02) {
          updateZoomPan(1.0, { x: 0, y: 0 });
        } else {
          // Supports simultaneous zooming and panning with two fingers
          const scaleRatio = nextZoom / ts.initialZoom;
          const pinchPanX = ts.midpoint.x - (ts.midpoint.x - ts.initialPan.x) * scaleRatio;
          const pinchPanY = ts.midpoint.y - (ts.midpoint.y - ts.initialPan.y) * scaleRatio;
          const translationX = currentMid.x - ts.midpoint.x;
          const translationY = currentMid.y - ts.midpoint.y;
          updateZoomPan(nextZoom, { x: pinchPanX + translationX, y: pinchPanY + translationY });
        }
      }
    } else if (e.touches.length === 1 && ts.mode === "pan" && zoomRef.current > 1.02) {
      e.preventDefault();
      const dx = e.touches[0].clientX - ts.lastTouch.x;
      const dy = e.touches[0].clientY - ts.lastTouch.y;

      if (Math.hypot(dx, dy) > 2) {
        hasDraggedRef.current = true;
      }

      ts.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      const newPan = {
        x: panRef.current.x + dx,
        y: panRef.current.y + dy,
      };
      updateZoomPan(zoomRef.current, newPan);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
      touchStateRef.current.mode = null;
      setIsDragging(false);
      isDraggingRef.current = false;
      // Keep hasDraggedRef true for 80ms to prevent phantom tap on markers after drag
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 80);
    } else if (e.touches.length === 1) {
      touchStateRef.current.mode = "pan";
      touchStateRef.current.lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  // 4. Mouse Drag / Panning (Computer)
  const handleMouseDown = (e) => {
    if (zoomRef.current > 1 && e.button === 0) {
      setIsDragging(true);
      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      dragStartRef.current = {
        x: e.clientX - panRef.current.x,
        y: e.clientY - panRef.current.y,
      };
    }
  };

  const handleMouseMove = (e) => {
    if (isDraggingRef.current && zoomRef.current > 1) {
      hasDraggedRef.current = true;
      const newPan = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      };
      updateZoomPan(zoomRef.current, newPan);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
  };

  // Register native non-passive listeners for wheel and touch pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: false });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: false });

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
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



  const activeReader =
    allReaders.find((r) => r.id === currentReader.id) || currentReader;

  // Continuous smooth location interpolation along corridor checkpoints
  const {
    currentPos,
    currentAngle,
    passedPoints: smoothPassed,
    remainingPoints: smoothRemaining,
    activeSeq,
  } = useSmoothLocation({
    currentReader: activeReader,
    allReaders,
    baseDuration: 380,
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
  // Dynamic floorplan image determination:
  // - Key Cabinet (Colo 1) / Colo 1 -> /map_colo1.png
  // - Key Cabinet (Colo 2) / Colo 2 -> /map_colo2.png
  // - Key Cabinet (Colo 3) / Colo 3 -> /map_colo3.png
  // - Washroom, NOC, Loading area (and other non-cabinet locations) -> /map_nodata.png
  const floorplanImage = useMemo(() => {
    const destName = destination?.name || "";
    const destId = destination?.id || "";

    // Key cabinet is NOT Colo 1, 2, or 3
    if (/key\s*cabin[ei]t/i.test(destName) || /key\s*cabin[ei]t/i.test(destId)) {
      return `${process.env.PUBLIC_URL}/map_nodata.png`;
    }

    const isColo3 = (str) => /colo\s*[-_]?\s*(3|three)/i.test(str || "");
    const isColo2 = (str) => /colo\s*[-_]?\s*(2|two)/i.test(str || "");
    const isColo1 = (str) => /colo\s*[-_]?\s*(1|one)/i.test(str || "");

    if (isColo3(destName) || isColo3(destId)) {
      return `${process.env.PUBLIC_URL}/map_colo3.png`;
    }
    if (isColo2(destName) || isColo2(destId)) {
      return `${process.env.PUBLIC_URL}/map_colo2.png`;
    }
    if (isColo1(destName) || isColo1(destId)) {
      return `${process.env.PUBLIC_URL}/map_colo1.png`;
    }

    return `${process.env.PUBLIC_URL}/map_nodata.png`;
  }, [destination]);

  // Destination
  const destinationReader = destination || allReaders[allReaders.length - 1];

  const handleSvgClick = (e) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
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

      {/* Interactive Map Graphic SVG Overlay Container with touch and wheel support */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
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
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
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

            {/* ── 2. Completed Path (Passed segments) — Translucent Red (20-30%) ── */}
            {smoothPassed.length > 1 && (
              <>
                {/* Glow for completed path */}
                <polyline
                  points={passedPoints}
                  fill="none"
                  stroke="rgba(239, 68, 68, 0.12)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Core Translucent Red Line (25% opacity) */}
                <polyline
                  points={passedPoints}
                  fill="none"
                  stroke="rgba(239, 68, 68, 0.25)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
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


            {/* ── 5. Fixed Reader Checkpoint Stations ── */}
            {allReaders.map((r) => {
              const cx = px(r.coords.x);
              const cy = py(r.coords.y);
              const isPassed = r.sequence < animatedSeq;
              const isCurrent = r.sequence === animatedSeq;
              const isDestination =
                r.sequence === destinationReader?.sequence ||
                r.id === destinationReader?.id;
              const isSelected =
                selectedMarker?.id === r.id ||
                (selectedMarker?.coords?.x === r.coords.x &&
                  selectedMarker?.coords?.y === r.coords.y);

              if (r.isWaypoint) {
                return (
                  <g
                    key={`wp-${r.id || `${r.coords.x}-${r.coords.y}`}`}
                    onClick={(e) => handleMarkerClick(r, e)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{r.location || r.name || "Waypoint"}</title>
                    <circle cx={cx} cy={cy} r="12" fill="transparent" />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 4 : 2.5}
                      fill={isSelected ? "#0284c7" : "#38bdf8"}
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                  </g>
                );
              }

              // Colors based on status
              const nodeBg = isCurrent
                ? "#22c55e"
                : isPassed
                  ? "#94a3b8"
                  : "#0284c7";

              return (
                <g
                  key={r.id || `${r.coords.x}-${r.coords.y}`}
                  onClick={(e) => handleMarkerClick(r, e)}
                  style={{ cursor: "pointer" }}
                >
                  <title>{r.location || r.name || "Reader Location"}</title>
                  {/* Invisible hit target for easy tapping */}
                  <circle cx={cx} cy={cy} r="14" fill="transparent" />

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

                  {/* Selection indicator ring */}
                  {isSelected && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="10"
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2"
                    />
                  )}

                  {/* Node Dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isCurrent ? 4.5 : isDestination ? 4.5 : 3}
                    fill={
                      isDestination && !isPassed
                        ? "#ef4444"
                        : isSelected
                          ? "#0284c7"
                          : nodeBg
                    }
                    stroke="#ffffff"
                    strokeWidth={
                      isCurrent || isDestination || isSelected ? 1.8 : 1
                    }
                    filter="url(#node-shadow)"
                  />
                </g>
              );
            })}

            {/* ── 5.1 Highlighted Destination Pin & Tag Badge ── */}
            {destinationReader?.coords && (
              <g
                transform={`translate(${px(destinationReader.coords.x)},${py(destinationReader.coords.y)})`}
                onClick={(e) => handleMarkerClick(destinationReader, e)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  r="14"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.2"
                  strokeDasharray="3 3"
                >
                  <animate
                    attributeName="r"
                    values="10;17;10"
                    dur="2.2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.9;0.2;0.9"
                    dur="2.2s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  r="5.5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="2"
                  filter="url(#node-shadow)"
                />
                {/* Destination name label tag */}
                <g transform="translate(0, -15)">
                  <rect
                    x="-48"
                    y="-14"
                    width="96"
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
                    🎯{" "}
                    {destinationReader.name ||
                      destinationReader.location ||
                      "Destination"}
                  </text>
                </g>
              </g>
            )}

            {/* ── 5.5 Interactive Clicked Location Callout Bubble ── */}
            {selectedMarker?.coords && (
              <g
                transform={`translate(${px(selectedMarker.coords.x)},${py(selectedMarker.coords.y)})`}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMarker(null);
                }}
              >
                {/* Glowing ring */}
                <circle r="12" fill="none" stroke="#0284c7" strokeWidth="2.5">
                  <animate
                    attributeName="r"
                    values="8;14;8"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0.3;1"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Speech Bubble Tag */}
                <g transform="translate(0, -20)">
                  <rect
                    x="-75"
                    y="-22"
                    width="150"
                    height="22"
                    rx="8"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                    filter="url(#node-shadow)"
                  />
                  <polygon
                    points="-5,0 5,0 0,5"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="0.8"
                  />
                  <text
                    x="0"
                    y="-7"
                    fill="#ffffff"
                    fontSize="9.5"
                    fontWeight="800"
                    textAnchor="middle"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    📍 {selectedMarker.location || selectedMarker.name || "Location"}
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


          {[
            { icon: <ZoomIn size={18} />, action: handleZoomIn, title: "Zoom In (+)" },
            { icon: <ZoomOut size={18} />, action: handleZoomOut, title: "Zoom Out (-)" },
            { icon: <RotateCcw size={16} />, action: handleReset, title: "Reset View (Fit Full Map)" },
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
                {destination?.name || destinationReader?.name || destinationReader?.location || "Destination"}
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

        {/* ── Selected Location Card (bottom) ── */}
        {selectedMarker && (
          <div
            style={{
              position: "absolute",
              bottom: "54px",
              left: "12px",
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
              zIndex: 30,
              fontSize: "12px",
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
                backgroundColor: "rgba(239, 68, 68, 0.3)",
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
              To {destination?.name || destinationReader?.name || "Destination"}
            </span>
          </div>
        </div>


      </div>
    </div>
  );
}
