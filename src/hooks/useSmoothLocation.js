import { useState, useRef, useEffect, useMemo } from "react";

// Distance helper between two percentage points
function dist(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// 

// Calculate angle in degrees from p1 to p2 in SVG space (1000×700)
export function angleDegrees(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = ((p2.x - p1.x) / 100) * 1000;
  const dy = ((p2.y - p1.y) / 100) * 700;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Shortest-path angle interpolation to prevent sudden 360-degree snap spins
function lerpAngle(fromDeg, toDeg, t) {
  let diff = (toDeg - fromDeg) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return fromDeg + diff * t;
}

/**
 * Hook to smoothly animate the live RFID tag location strictly along the defined
 * reader sequence and hallway paths.
 *
 * If intermediate readers are missed, the locator visits every intermediate reader
 * and waypoint in exact sequential order, never cutting across walls or shortcuts.
 */
export function useSmoothLocation({ currentReader, allReaders = [], baseDuration = 1000 }) {
  // Sort readers strictly by sequence order so navigation sequence is always preserved
  c
    return [...allReaders].sort(
      (a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0)
    );
  }, [allReaders]);

  // Keep a stable serialized fingerprint of readers to avoid re-triggering animations on object recreation
  const readersKey = useMemo(() => {
    return sortedReaders
      .map((r) => `${r.id || ""}:${r.coords?.x?.toFixed(1) || 0}:${r.coords?.y?.toFixed(1) || 0}`)
      .join("|");
  }, [sortedReaders]);

  const targetCoords = currentReader?.coords || { x: 50, y: 50 };
  const targetSeq = currentReader?.sequence ?? 1;

  // Helper to reliably find a reader index in sortedReaders
  const getReaderIndex = (target) => {
    if (!target || !sortedReaders.length) return 0;

    // 1. Match by exact ID
    if (target.id !== undefined && target.id !== null) {
      const byId = sortedReaders.findIndex(
        (r) => String(r.id) === String(target.id)
      );
      if (byId !== -1) return byId;
    }

    // 2. Match by location/name
    if (target.location || target.name) {
      const targetName = (target.location || target.name).trim().toLowerCase();
      const byName = sortedReaders.findIndex((r) => {
        const rName = (r.location || r.name || "").trim().toLowerCase();
        return rName && (rName === targetName || rName.includes(targetName) || targetName.includes(rName));
      });
      if (byName !== -1) return byName;
    }

    // 3. Match by coordinates proximity (within 2.0% map units)
    if (target.coords && typeof target.coords.x === "number" && typeof target.coords.y === "number") {
      const byDist = sortedReaders.findIndex(
        (r) => r.coords && dist(r.coords, target.coords) < 2.0
      );
      if (byDist !== -1) return byDist;
    }

    // 4. Match closest point along the route
    if (target.coords) {
      let closestIdx = 0;
      let minD = Infinity;
      sortedReaders.forEach((r, idx) => {
        if (r.coords) {
          const d = dist(r.coords, target.coords);
          if (d < minD) {
            minD = d;
            closestIdx = idx;
          }
        }
      });
      return closestIdx;
    }

    return 0;
  };

  // State
  const [currentPos, setCurrentPos] = useState(targetCoords);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [activeWaypointIdx, setActiveWaypointIdx] = useState(0);

  // Animation & Position Refs
  const posRef = useRef(targetCoords);
  const currentAngleRef = useRef(0);
  const currentWaypointIdxRef = useRef(0);
  const targetWaypointIdxRef = useRef(0);
  const isMovingRef = useRef(false);
  const animFrameRef = useRef(null);
  const isFirstRender = useRef(true);
  const lastTargetKeyRef = useRef(null);
  const sortedReadersRef = useRef(sortedReaders);
  sortedReadersRef.current = sortedReaders;

  // Initialize on first mount
  useEffect(() => {
    if (isFirstRender.current && sortedReaders.length > 0) {
      const initIdx = getReaderIndex(currentReader || sortedReaders[0]);
      const initialCoords = sortedReaders[initIdx]?.coords || targetCoords;

      posRef.current = initialCoords;
      currentWaypointIdxRef.current = initIdx;
      targetWaypointIdxRef.current = initIdx;
      setActiveWaypointIdx(initIdx);
      setCurrentPos(initialCoords);
      isFirstRender.current = false;

      // Face next reader on load
      if (initIdx + 1 < sortedReaders.length) {
        const initAngle = angleDegrees(initialCoords, sortedReaders[initIdx + 1].coords);
        currentAngleRef.current = initAngle;
        setCurrentAngle(initAngle);
      }
    }ersKey]);

  // Main animation effect triggered strictly when the active reader target changes
  useEffect(() => {
    i
    const targetIdx = getReaderIndex(currentReader);
    const finalDestinationCoords = sortedReaders[targetIdx]?.coords || currentReader.coords || targetCoords;
    const targetKey = `${targetIdx}_$
    // If target has not changed and animation is already running towards it, DO NOT interrupt!
    // Prevents 300ms server polling from cancelling the active animation
    if (targetKey === lastTargetKeyRef.current && isMovingRef.current) {
      return;
    }

    const startPos = { ...posRef.current };
    const maxIdx = sortedReaders.length - 1;
    comrentWaypointIdxRef.current = fromIdx;

    // If already at target position and index, no animation required
    if (targetIdx === fromIdx && dist(startPos, finalDestinationCoords) < 0.05) {
      lastTargetKeyRef.current = targetKey;
      targetWaypointIdxRef.current = targetIdx;
      return;
    }

    lastTargetKeyRef.current = targetKey;
    targetWaypointIdxRef.current = targetIdx;

    // ── Build the path STRICTLY along every reader in sequence order ──────────
    // Never skip intermediate waypoints, and never backtrack to a reader already passed!
    const pathNodes = [startPos];
    const nodeIndices = [fromIdx];

    if (fromIdx < targetIdx) {
      // Forward progression
      const currentReaderPt = sortedReaders[fromIdx]?.coords;
      const nextReaderPt = sortedReaders[fromIdx + 1]?.coords;
      // If markeready departedowards ao nextReaderPt && dist(startPos, currentReaderPt) > 0.4 && dist(startPos, nextReaderPt) < dist(currentReaderPt, nextReaderPt))
        ? fromIdx + 1
        : fromIdx;

e?r f ist(patde[pathNodesth - 1], pt) > 0.1) {
          pathNodes.push(pt);
          nodeIndices.push(i);
        }
      }
    } else if (fromIdx > targetIdx) {
      // Backward progression
      const currentReaderPt = sortedReaders[fromIdx]?.coords;
      const prevReaderPt = sortedReaders[fromIdx - 1]?.coords;
      const startI = (currentReaderPt && prevReaderPt && dist(startPos, currentReaderPt) > 0.4 && dist(startPos, prevReaderPt) < dist(currentReaderPt, prevReaderPt))
        ? fromIdx - 1
        : fromIdx;

      for (let i = startI; i >= targetIdx; i--) {
        const pt = sortedReaders[i]?.coords;
        if (pt && dist(pathNodes[pathNodes.length - 1], pt) > 0.1) {
          pathNodes.push(pt);
          nodeIndices.push(i)
     e {
      pathNodes.push(finalDestinationCoords);
      nodeIndices.push(targetIdx);
    }

    // Clean up duplicate or near-identical adjacent nodes
    const cleanNodes = [];
    const cleanIndices = [];
    for (let i = 0; i < pathNodes.length; i++) {
      if (i === 0 || dist(cleanNodes[cleanNodes.length - 1], pathNodes[i]) > 0.05) {
        cleanNodes.push(pathNodes[i]);
        cleanIndices.push(nodeIndices[i]);
      }
    }

    if (cleanNodes.length < 2) {
      posRef.current = finalDestinationCoords;
      setCurrentPos(finalDestinationCoords);
      currentWaypointIdxRef.current = targetIdx;
      setActiveWaypointIdx(targetIdx);
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
      posRef.current = finalDestinationCoords;
      setCurrentPos(finalDestinationCoords);
      currentWaypointIdxRef.current = targetIdx;
      setActiveWaypointIdx(targetIdx);
      setIsMoving(false);
      isMovingRef.current = false;
      return;
    }

    // Scale duration naturally with walking distance and hop count
    const hopCount = Math.max(1, Math.abs(targetIdx - fromIdx));
    const effectiveBase = Math.max(baseDuration || 1000, 850);
    const moveDuration = Math.min(Math.max(hopCount * effectiveBase, 900), 4500);

    const startTime = performance.now();
    setIsMoving(true);
    isMovingRef.current = true;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
estartTime;
      const rawProgress = Math.min(1, elapsed / moveDuration);
      consa currentDist = easedProgress * totalPathDist;

      // Find active segment
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
on
      const pB = cleanNodes[segIdx + 1];

      const currentX = pA.x + segFraction * (pB.x - pA.x);
      const currentY = pA.y + segFraction * (pB.y - pA.y);
      const targetAngleDeg = angleDegrees(pA, pB);

      // Smoothly interpolate angle around turns
      const smoothedAngle = lerpAngle(currentAngleRef.current, targetAngleDeg, 0.16);
      currentAngleRef.current = smoothedAngle;

      const newPos = { x: currentX, y: currentY };
      posRef.current = newPos;
      setCurrentPos(newPos);
      setCurrentAngle(smoothedAngle);

      // Track the node index reached as the pin passes each reader checkpoint
      const currentHopIdx = cleanIndices[segIdx];
      if (currentHopIdx !== undefined && currentHopIdx !== currentWaypointIdxRef.current) {
        currentWaypointIdxRef.current = currentHopIdx;
        setActiveWaypointIdx(currentHopIdx);
      }
ogress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
        posRef.current = finalDestinationCoords;
        setCurrentPos(finalDestinationCoords);
        currentWaypointIdxRef.current = targetIdx;
        setActiveWaypointIdx(targetIdx);
        setIsMoving(false);
        isMovingRef.cu
        // Angle to face next reader upon arrival
        if (targetIdx + 1 < sortedReaders.length) {
          const nextAngle = angleDegrees(finalDestinationCoords, sortedReaders[targetIdx + 1].coords);
          currentAngleRef.current = nextAngle;
          setCurrentAngle(nextAngle);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      // Only clean up on unmount or when target changes
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [
    currentReader?.id,
    currentReader?.location,
    curreneader?.coords?.y,
    readersKey,
    baseDuration,
  ]);

  // Compute dynamic passed and remaining paths strictly along the reader corridor route
  const { passedPoints, remainingPoints } = useMemo(() => {
    if (!sortedReaders.length) return { passedPoints: [], remainingPoints: [] };

    const curIdx = Math.min(Math.max(0, activeWaypointIdx), sortedReaders.length - 1);

    // 1. All readers passed in sequence order up to curIdx, plus current pin position
    const passed = [];
    for (let i = 0; i <= curIdx; i++) {
      if (sortedReaders[i]?.coords) {
     
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
