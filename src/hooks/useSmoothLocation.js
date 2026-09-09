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
 * without sudden jumps between readers.
 */
export function useSmoothLocation({ currentReader, allReaders = [], baseDuration = 1200 }) {
  const targetCoords = currentReader?.coords || { x: 50, y: 50 };
  const targetSeq = currentReader?.sequence ?? 1;

  // Smoothed position & angle state
  const [currentPos, setCurrentPos] = useState(targetCoords);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  const posRef = useRef(targetCoords);
  const prevTargetIdRef = useRef(currentReader?.id ?? null);
  const animFrameRef = useRef(null);
  const isFirstRender = useRef(true);

  // Initialize on first mount
  useEffect(() => {
    if (isFirstRender.current && currentReader?.coords) {
      posRef.current = currentReader.coords;
      setCurrentPos(currentReader.coords);
      prevTargetIdRef.current = currentReader.id;
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

    // Check if target reader actually changed or if we need to animate
    const prevId = prevTargetIdRef.current;
    prevTargetIdRef.current = currentReader.id;

    const startPos = { ...posRef.current };
    const targetPos = currentReader.coords;

    const directDistance = dist(startPos, targetPos);
    if (directDistance < 0.05) {
      posRef.current = targetPos;
      setCurrentPos(targetPos);
      return;
    }

    // Find reader indices along the defined sequence
    let prevIdx = allReaders.findIndex((r) => r.id === prevId);
    let targetIdx = allReaders.findIndex((r) => r.id === currentReader.id);

    if (prevIdx === -1) {
      // Find the closest reader to startPos
      let closestDist = Infinity;
      allReaders.forEach((r, idx) => {
        const d = dist(startPos, r.coords);
        if (d < closestDist) {
          closestDist = d;
          prevIdx = idx;
        }
      });
    }

    if (targetIdx === -1) {
      targetIdx = prevIdx;
    }

    // Build the sub-path including all intermediate waypoints and corridor turns
    const pathNodes = [startPos];
    if (prevIdx !== -1 && targetIdx !== -1 && prevIdx !== targetIdx) {
      if (prevIdx < targetIdx) {
        // Forward progression along the route
        for (let i = prevIdx + 1; i <= targetIdx; i++) {
          pathNodes.push(allReaders[i].coords);
        }
      } else {
        // Backward progression
        for (let i = prevIdx - 1; i >= targetIdx; i--) {
          pathNodes.push(allReaders[i].coords);
        }
      }
    } else {
      pathNodes.push(targetPos);
    }

    // Filter out redundant identical nodes
    const cleanNodes = [];
    for (let i = 0; i < pathNodes.length; i++) {
      if (i === 0 || dist(cleanNodes[cleanNodes.length - 1], pathNodes[i]) > 0.05) {
        cleanNodes.push(pathNodes[i]);
      }
    }

    if (cleanNodes.length < 2) {
      posRef.current = targetPos;
      setCurrentPos(targetPos);
      return;
    }

    // Calculate cumulative segment distances
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
      posRef.current = targetPos;
      setCurrentPos(targetPos);
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

      // Find active segment
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

      const pA = cleanNodes[segIdx];
      const pB = cleanNodes[segIdx + 1];

      const currentX = pA.x + segFraction * (pB.x - pA.x);
      const currentY = pA.y + segFraction * (pB.y - pA.y);
      const currentAngleDeg = angleDegrees(pA, pB);

      const newPos = { x: currentX, y: currentY };
      posRef.current = newPos;
      setCurrentPos(newPos);
      setCurrentAngle(currentAngleDeg);

      if (rawProgress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        posRef.current = targetPos;
        setCurrentPos(targetPos);
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

    // Passed readers before targetSeq
    const passed = allReaders
      .filter((r) => r.sequence < targetSeq)
      .map((r) => r.coords);
    passed.push(currentPos);

    // Remaining readers after targetSeq
    const remaining = [currentPos];
    allReaders
      .filter((r) => r.sequence > targetSeq)
      .forEach((r) => remaining.push(r.coords));

    return { passedPoints: passed, remainingPoints: remaining };
  }, [allReaders, targetSeq, currentPos]);

  return {
    currentPos,
    currentAngle,
    isMoving,
    passedPoints,
    remainingPoints,
  };
}
