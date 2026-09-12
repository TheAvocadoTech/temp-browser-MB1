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

// Calculate angle in degrees from p1 to p2 in SVG space
export function angleDegrees(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = ((p2.x - p1.x) / 100) * 1000;
  const dy = ((p2.y - p1.y) / 100) * 700;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Hook to smoothly animate the live RFID tag location along hallway paths and waypoints
 * without sudden jumps between readers or cutting through walls.
 */
export function useSmoothLocation({ currentReader, allReaders = [], baseDuration = 1200 }) {
  const targetCoords = currentReader?.coords || { x: 50, y: 50 };
  const targetSeq = currentReader?.sequence ?? 1;

  // Smoothed position & angle state
  const [currentPos, setCurrentPos] = useState(targetCoords);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  // Active corridor checkpoint index in allReaders that tag has completed/is at
  const [globalIdx, setGlobalIdx] = useState(0);

  const posRef = useRef(targetCoords);
  const globalIndexRef = useRef(0);
  const prevTargetIdRef = useRef(null);
  const animFrameRef = useRef(null);
  const isFirstRender = useRef(true);

  // Initialize on first mount
  useEffect(() => {
    if (isFirstRender.current && currentReader?.coords && allReaders.length > 0) {
      posRef.current = currentReader.coords;
      setCurrentPos(currentReader.coords);
      prevTargetIdRef.current = currentReader.id;

      const initIdx = allReaders.findIndex((r) => r.id === currentReader.id);
      const safeIdx = initIdx !== -1 ? initIdx : 0;
      globalIndexRef.current = safeIdx;
      setGlobalIdx(safeIdx);
      isFirstRender.current = false;

      // Face next reader on load
      const nextReader = allReaders.find((r) => r.sequence > targetSeq);
      if (nextReader) {
        setCurrentAngle(angleDegrees(currentReader.coords, nextReader.coords));
      }
    }
  }, [currentReader, allReaders, targetSeq]);

  useEffect(() => {
    if (!currentReader || !allReaders.length) return;

    // Check target reader index
    const targetIdx = allReaders.findIndex((r) => r.id === currentReader.id);
    if (targetIdx === -1) return;

    const startPos = { ...posRef.current };
    const targetPos = currentReader.coords;

    // Determine current start index along allReaders
    let startIdx = globalIndexRef.current;
    if (startIdx < 0 || startIdx >= allReaders.length) {
      let closestDist = Infinity;
      allReaders.forEach((r, idx) => {
        const d = dist(startPos, r.coords);
        if (d < closestDist) {
          closestDist = d;
          startIdx = idx;
        }
      });
    }

    const directDistance = dist(startPos, targetPos);
    if (directDistance < 0.05 && startIdx === targetIdx) {
      posRef.current = targetPos;
      globalIndexRef.current = targetIdx;
      setCurrentPos(targetPos);
      setGlobalIdx(targetIdx);
      setIsMoving(false);
      return;
    }

    // If target hasn't changed from previous target and we are already moving towards it,
    // we don't restart the animation unless forced
    if (prevTargetIdRef.current === currentReader.id && isMoving) {
      return;
    }
    prevTargetIdRef.current = currentReader.id;

    // Build the sub-path including all intermediate waypoints and corridor turns
    const subPath = [{ coords: startPos, globalIdx: startIdx }];
    if (startIdx < targetIdx) {
      // Forward progression along the route
      for (let i = startIdx + 1; i <= targetIdx; i++) {
        subPath.push({ coords: allReaders[i].coords, globalIdx: i });
      }
    } else if (startIdx > targetIdx) {
      // Backward progression
      for (let i = startIdx - 1; i >= targetIdx; i--) {
        subPath.push({ coords: allReaders[i].coords, globalIdx: i });
      }
    } else {
      subPath.push({ coords: targetPos, globalIdx: targetIdx });
    }

    // Filter out redundant identical nodes while preserving correct globalIdx
    const cleanSubPath = [];
    for (let i = 0; i < subPath.length; i++) {
      if (i === 0 || dist(cleanSubPath[cleanSubPath.length - 1].coords, subPath[i].coords) > 0.05) {
        cleanSubPath.push(subPath[i]);
      } else {
        cleanSubPath[cleanSubPath.length - 1].globalIdx = subPath[i].globalIdx;
      }
    }

    if (cleanSubPath.length < 2) {
      posRef.current = targetPos;
      globalIndexRef.current = targetIdx;
      setCurrentPos(targetPos);
      setGlobalIdx(targetIdx);
      setIsMoving(false);
      return;
    }

    // Calculate cumulative segment distances
    const segmentDists = [];
    const cumDists = [0];
    let totalPathDist = 0;

    for (let i = 0; i < cleanSubPath.length - 1; i++) {
      const segDist = dist(cleanSubPath[i].coords, cleanSubPath[i + 1].coords);
      segmentDists.push(segDist);
      totalPathDist += segDist;
      cumDists.push(totalPathDist);
    }

    if (totalPathDist < 0.05) {
      posRef.current = targetPos;
      globalIndexRef.current = targetIdx;
      setCurrentPos(targetPos);
      setGlobalIdx(targetIdx);
      setIsMoving(false);
      return;
    }

    // Dynamic duration based on distance so longer moves stay smooth
    const moveDuration = Math.min(Math.max(baseDuration * (totalPathDist / 8), 700), 2200);
    const startTime = performance.now();
    setIsMoving(true);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const animate = (now) => {
      const elapsed = now - startTime;
      const rawProgress = Math.min(1, elapsed / moveDuration);
      const easedProgress = easeInOutCubic(rawProgress);

      const targetDist = easedProgress * totalPathDist;

      // Find active segment in cleanSubPath
      let segIdx = 0;
      for (let i = 0; i < segmentDists.length; i++) {
        if (targetDist >= cumDists[i] && targetDist <= cumDists[i + 1]) {
          segIdx = i;
          break;
        }
      }

      const segStartDist = cumDists[segIdx];
      const segLen = segmentDists[segIdx] || 0.0001;
      const segFraction = Math.min(1, Math.max(0, (targetDist - segStartDist) / segLen));

      const pA = cleanSubPath[segIdx].coords;
      const pB = cleanSubPath[segIdx + 1].coords;

      const currentX = pA.x + segFraction * (pB.x - pA.x);
      const currentY = pA.y + segFraction * (pB.y - pA.y);
      const currentAngleDeg = angleDegrees(pA, pB);

      const newPos = { x: currentX, y: currentY };
      posRef.current = newPos;
      setCurrentPos(newPos);
      setCurrentAngle(currentAngleDeg);

      // Track active node index in allReaders
      const activeIdx = cleanSubPath[segIdx].globalIdx;
      globalIndexRef.current = activeIdx;
      setGlobalIdx(activeIdx);

      if (rawProgress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        posRef.current = targetPos;
        globalIndexRef.current = targetIdx;
        setCurrentPos(targetPos);
        setGlobalIdx(targetIdx);
        setIsMoving(false);

        // Update angle to face next reader after arriving
        const nextReader = allReaders.find((r) => r.sequence > targetSeq);
        if (nextReader) {
          setCurrentAngle(angleDegrees(targetPos, nextReader.coords));
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [currentReader?.id, targetSeq, allReaders, baseDuration]);

  // Compute dynamic passed and remaining paths based on smooth live coordinates
  const { passedPoints, remainingPoints } = useMemo(() => {
    if (!allReaders.length) return { passedPoints: [], remainingPoints: [] };

    const gIdx = Math.max(0, Math.min(globalIdx, allReaders.length - 1));

    // Passed path: all completed corridor waypoints from origin (0) up to gIdx, terminating at currentPos
    const passed = [];
    for (let i = 0; i <= gIdx; i++) {
      passed.push(allReaders[i].coords);
    }
    if (passed.length === 0 || dist(passed[passed.length - 1], currentPos) > 0.05) {
      passed.push(currentPos);
    }

    // Remaining path: starting at currentPos, followed by all upcoming corridor waypoints to the destination
    const remaining = [currentPos];
    for (let i = gIdx + 1; i < allReaders.length; i++) {
      remaining.push(allReaders[i].coords);
    }

    // Filter adjacent duplicate points for clean rendering
    const cleanPassed = [];
    for (let i = 0; i < passed.length; i++) {
      if (i === 0 || dist(cleanPassed[cleanPassed.length - 1], passed[i]) > 0.05) {
        cleanPassed.push(passed[i]);
      }
    }

    const cleanRemaining = [];
    for (let i = 0; i < remaining.length; i++) {
      if (i === 0 || dist(cleanRemaining[cleanRemaining.length - 1], remaining[i]) > 0.05) {
        cleanRemaining.push(remaining[i]);
      }
    }

    return { passedPoints: cleanPassed, remainingPoints: cleanRemaining };
  }, [allReaders, globalIdx, currentPos]);

  return {
    currentPos,
    currentAngle,
    isMoving,
    passedPoints,
    remainingPoints,
  };
}
