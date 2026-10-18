import { useState, useRef, useEffect, useMemo } from "react";

// Distance helper between two percentage points
function dist(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Cubic ease-in-out for fluid acceleration and deceleration
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Calculate angle in degrees from p1 to p2 in SVG space (1000×700)
export function angleDegrees(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = ((p2.x - p1.x) / 100) * 1000;
  const dy = ((p2.y - p1.y) / 100) * 700;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Hook to smoothly animate the live RFID tag location strictly along the defined
 * reader sequence and hallway paths.
 *
 * If intermediate readers are missed, the locator visits every intermediate reader
 * and waypoint in exact sequential order, never cutting across walls or shortcuts.
 */
export function useSmoothLocation({ currentReader, allReaders = [], baseDuration = 350 }) {
  // Sort readers strictly by sequence order so navigation sequence is always preserved
  const sortedReaders = useMemo(() => {
    if (!allReaders || !allReaders.length) return [];
    return [...allReaders].sort(
      (a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0)
    );
  }, [allReaders]);

  const targetCoords = currentReader?.coords || { x: 50, y: 50 };
  const targetSeq = currentReader?.sequence ?? 1;

  // Helper to reliably find a reader index in sortedReaders
  const getReaderIndex = (target) => {
    if (!target || !sortedReaders.length) return -1;

    // 1. Match by exact ID
    if (target.id !== undefined && target.id !== null) {
      const byId = sortedReaders.findIndex(
        (r) => String(r.id) === String(target.id)
      );
      if (byId !== -1) return byId;
    }

    // 2. Match by coordinates proximity (within 1.2% map units)
    if (target.coords && typeof target.coords.x === "number" && typeof target.coords.y === "number") {
      const byDist = sortedReaders.findIndex(
        (r) => r.coords && dist(r.coords, target.coords) < 1.2
      );
      if (byDist !== -1) return byDist;
    }

    // DO NOT fallback to matching sequence or closest index, because each route
    // re-numbers its waypoints independently! Matching sequence or closest index
    // caused live readers to jump to completely unrelated waypoints on different routes.
    return -1;
  };

  // State
  const [currentPos, setCurrentPos] = useState(targetCoords);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [activeWaypointIdx, setActiveWaypointIdx] = useState(0);

  // Animation & Position Refs
  const posRef = useRef(targetCoords);
  const currentWaypointIdxRef = useRef(0);
  const targetWaypointIdxRef = useRef(0);
  const isMovingRef = useRef(false);
  const animFrameRef = useRef(null);
  const isFirstRender = useRef(true);

  // Initialize on first mount
  useEffect(() => {
    if (isFirstRender.current) {
      const initialCoords = currentReader?.coords || sortedReaders[0]?.coords || targetCoords;
      const initIdx = getReaderIndex(currentReader);

      posRef.current = initialCoords;
      currentWaypointIdxRef.current = initIdx !== -1 ? initIdx : 0;
      targetWaypointIdxRef.current = initIdx;
      setActiveWaypointIdx(initIdx !== -1 ? initIdx : 0);
      setCurrentPos(initialCoords);
      isFirstRender.current = false;

      // Face next reader on load if available
      if (initIdx !== -1 && initIdx + 1 < sortedReaders.length) {
        setCurrentAngle(angleDegrees(initialCoords, sortedReaders[initIdx + 1].coords));
      }
    }
  }, [sortedReaders, currentReader]);

  // Main animation effect triggered when currentReader changes
  useEffect(() => {
    if (!currentReader) return;

    const realTargetCoords = currentReader.coords || targetCoords;
    const targetIdx = getReaderIndex(currentReader);

    // Initial load handling if not yet initialized
    if (isFirstRender.current) {
      posRef.current = realTargetCoords;
      currentWaypointIdxRef.current = targetIdx !== -1 ? targetIdx : 0;
      targetWaypointIdxRef.current = targetIdx;
      setActiveWaypointIdx(targetIdx !== -1 ? targetIdx : 0);
      setCurrentPos(realTargetCoords);
      isFirstRender.current = false;
      return;
    }

    // Check if position already matches
    const startPos = { ...posRef.current };
    if (dist(startPos, realTargetCoords) < 0.05) {
      targetWaypointIdxRef.current = targetIdx;
      return;
    }

    // If target has not changed and animation is already running towards it, don't interrupt
    if (
      targetIdx !== -1 &&
      targetIdx === targetWaypointIdxRef.current &&
      isMovingRef.current
    ) {
      return;
    }

    targetWaypointIdxRef.current = targetIdx;

    let cleanNodes = [];
    let cleanIndices = [];

    if (targetIdx !== -1 && sortedReaders.length > 0) {
      // Reader is on the active route: follow sequential route path
      const maxIdx = sortedReaders.length - 1;
      const fromIdx = Math.min(Math.max(0, currentWaypointIdxRef.current), maxIdx);
      currentWaypointIdxRef.current = fromIdx;

      const pathNodes = [startPos];
      const nodeIndices = [fromIdx];

      if (fromIdx < targetIdx) {
        for (let i = fromIdx; i <= targetIdx; i++) {
          const pt = sortedReaders[i]?.coords;
          if (pt && dist(pathNodes[pathNodes.length - 1], pt) > 0.1) {
            pathNodes.push(pt);
            nodeIndices.push(i);
          }
        }
      } else if (fromIdx > targetIdx) {
        for (let i = fromIdx; i >= targetIdx; i--) {
          const pt = sortedReaders[i]?.coords;
          if (pt && dist(pathNodes[pathNodes.length - 1], pt) > 0.1) {
            pathNodes.push(pt);
            nodeIndices.push(i);
          }
        }
      } else {
        pathNodes.push(realTargetCoords);
        nodeIndices.push(targetIdx);
      }

      for (let i = 0; i < pathNodes.length; i++) {
        if (i === 0 || dist(cleanNodes[cleanNodes.length - 1], pathNodes[i]) > 0.05) {
          cleanNodes.push(pathNodes[i]);
          cleanIndices.push(nodeIndices[i]);
        }
      }
    } else {
      // Reader is off-route or targetIdx is -1: move smoothly directly to realTargetCoords
      cleanNodes = [startPos, realTargetCoords];
      cleanIndices = [currentWaypointIdxRef.current, currentWaypointIdxRef.current];
    }

    if (cleanNodes.length < 2) {
      posRef.current = realTargetCoords;
      setCurrentPos(realTargetCoords);
      if (targetIdx !== -1) {
        currentWaypointIdxRef.current = targetIdx;
        setActiveWaypointIdx(targetIdx);
      }
      setIsMoving(false);
      isMovingRef.current = false;
      return;
    }

    // Calculate segment distances and cumulative path distance
    const segmentDists = [];
    const cumDists = [0];
    let totalPathDist = 0;

    for (let i = 0; i < cleanNodes.length - 1; i++) {
      const segDist = dist(cleanNodes[i], cleanNodes[i + 1]);
      segmentDists.push(segDist);
      totalPathDist += segDist;
      cumDists.push(totalPathDist);
    }

    if (totalPathDist < 0.05) {
      posRef.current = realTargetCoords;
      setCurrentPos(realTargetCoords);
      if (targetIdx !== -1) {
        currentWaypointIdxRef.current = targetIdx;
        setActiveWaypointIdx(targetIdx);
      }
      setIsMoving(false);
      isMovingRef.current = false;
      return;
    }

    const hopCount = targetIdx !== -1 ? Math.max(1, Math.abs(targetIdx - currentWaypointIdxRef.current)) : 1;
    const moveDuration = Math.min(Math.max(hopCount * baseDuration, 350), 3000);

    const startTime = performance.now();
    setIsMoving(true);
    isMovingRef.current = true;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const animate = (now) => {
      const elapsed = now - startTime;
      const rawProgress = Math.min(1, elapsed / moveDuration);
      const easedProgress = easeInOutCubic(rawProgress);
      const currentDist = easedProgress * totalPathDist;

      let segIdx = 0;
      for (let i = 0; i < segmentDists.length; i++) {
        if (currentDist >= cumDists[i] && currentDist <= cumDists[i + 1]) {
          segIdx = i;
          break;
        }
      }

      const segStartDist = cumDists[segIdx];
      const segLen = segmentDists[segIdx] || 0.0001;
      const segFraction = Math.min(1, Math.max(0, (currentDist - segStartDist) / segLen));

      const pA = cleanNodes[segIdx];
      const pB = cleanNodes[segIdx + 1];

      const currentX = pA.x + segFraction * (pB.x - pA.x);
      const currentY = pA.y + segFraction * (pB.y - pA.y);
      const currentAngleDeg = angleDegrees(pA, pB);

      const newPos = { x: currentX, y: currentY };
      posRef.current = newPos;
      setCurrentPos(newPos);
      setCurrentAngle(currentAngleDeg);

      const currentHopIdx = cleanIndices[segIdx];
      if (currentHopIdx !== undefined && currentHopIdx !== currentWaypointIdxRef.current) {
        currentWaypointIdxRef.current = currentHopIdx;
        setActiveWaypointIdx(currentHopIdx);
      }

      if (rawProgress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        posRef.current = realTargetCoords;
        setCurrentPos(realTargetCoords);
        if (targetIdx !== -1) {
          currentWaypointIdxRef.current = targetIdx;
          setActiveWaypointIdx(targetIdx);
          if (targetIdx + 1 < sortedReaders.length) {
            setCurrentAngle(angleDegrees(realTargetCoords, sortedReaders[targetIdx + 1].coords));
          }
        }
        setIsMoving(false);
        isMovingRef.current = false;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [currentReader?.id, currentReader?.coords?.x, currentReader?.coords?.y, sortedReaders, baseDuration]);

  // Compute dynamic passed and remaining paths strictly along the reader corridor route
  const { passedPoints, remainingPoints } = useMemo(() => {
    if (!sortedReaders.length) return { passedPoints: [], remainingPoints: [] };

    const curIdx = Math.min(Math.max(0, activeWaypointIdx), sortedReaders.length - 1);

    // 1. All readers passed in sequence order up to curIdx, plus current pin position
    const passed = [];
    for (let i = 0; i <= curIdx; i++) {
      if (sortedReaders[i]?.coords) {
        passed.push(sortedReaders[i].coords);
      }
    }
    if (currentPos) {
      passed.push(currentPos);
    }

    // 2. All remaining upcoming readers in sequence order starting from current pin position
    const remaining = [];
    if (currentPos) {
      remaining.push(currentPos);
    }
    for (let i = curIdx + 1; i < sortedReaders.length; i++) {
      if (sortedReaders[i]?.coords) {
        remaining.push(sortedReaders[i].coords);
      }
    }

    return { passedPoints: passed, remainingPoints: remaining };
  }, [sortedReaders, activeWaypointIdx, currentPos]);

  const activeSeq = sortedReaders[activeWaypointIdx]?.sequence ?? targetSeq;

  return {
    currentPos,
    currentAngle,
    isMoving,
    passedPoints,
    remainingPoints,
    activeWaypointIdx,
    activeSeq,
  };
}
