// src/hooks/useReaderLocations.js
import { useState, useEffect, useMemo, useCallback } from "react";
import baseReaders from "../config/rfidReaders.json";
import {
  DEFAULT_DESTINATIONS,
  getKeyCabinetOption,
} from "../config/defaultDestinations";

const STORAGE_CUSTOM_READERS_KEY = "avocado_custom_readers_v1";
const STORAGE_DELETED_DESTINATIONS_KEY = "avocado_deleted_destinations_v1";
const STORAGE_ACTIVE_DEST_KEY = "avocado_active_destination_v1";
const STORAGE_CABINET_COLO_KEY = "avocado_cabinet_colo_v1";

export function useReaderLocations() {
  // Selected Key Cabinet Colo: "colo1", "colo2", or "colo3"
  const [selectedKeyCabinetColo, setSelectedKeyCabinetColo] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CABINET_COLO_KEY);
      if (saved && (saved === "colo1" || saved === "colo2" || saved === "colo3")) {
        return saved;
      }
    } catch (e) {}
    return "colo1";
  });

  // Load custom reader locations from localStorage
  const [customLocations, setCustomLocations] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CUSTOM_READERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn("Failed to load custom locations from localStorage", e);
      return [];
    }
  });

  // Track deleted locations from localStorage
  const [deletedLocationIds, setDeletedLocationIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DELETED_DESTINATIONS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn("Failed to load deleted locations from localStorage", e);
      return [];
    }
  });

  // Active destination (defaults to Key cabinet or previously saved)
  const [activeDestinationId, setActiveDestinationId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVE_DEST_KEY);
      if (
        saved &&
        (saved === "dest-key-cabinet" ||
          saved === "dest-key-cabinet-colo1" ||
          saved === "dest-key-cabinet-colo2" ||
          saved === "dest-key-cabinet-colo3" ||
          saved === "dest-washroom" ||
          saved === "dest-noc" ||
          saved === "dest-loading-area")
      ) {
        return saved;
      }
    } catch (e) {}
    return "dest-key-cabinet";
  });

  // Persist cabinet colo selection
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CABINET_COLO_KEY, selectedKeyCabinetColo);
    } catch (e) {
      console.warn("Failed to save cabinet colo to localStorage", e);
    }
  }, [selectedKeyCabinetColo]);

  // Save custom locations whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_CUSTOM_READERS_KEY,
        JSON.stringify(customLocations),
      );
    } catch (e) {
      console.warn("Failed to save custom locations to localStorage", e);
    }
  }, [customLocations]);

  // Save deleted locations whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_DELETED_DESTINATIONS_KEY,
        JSON.stringify(deletedLocationIds),
      );
    } catch (e) {
      console.warn("Failed to save deleted locations to localStorage", e);
    }
  }, [deletedLocationIds]);

  // Save active destination selection
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACTIVE_DEST_KEY, activeDestinationId);
    } catch (e) {
      console.warn("Failed to save active destination to localStorage", e);
    }
  }, [activeDestinationId]);

  // Select Key Cabinet Colo ("colo1", "colo2", or "colo3")
  const selectKeyCabinetColo = useCallback((colo) => {
    if (colo !== "colo1" && colo !== "colo2" && colo !== "colo3") return;
    setSelectedKeyCabinetColo(colo);
    // Automatically switch active destination to Key Cabinet
    setActiveDestinationId("dest-key-cabinet");
  }, []);

  // Merge default destinations with any custom added destinations, filtering out deleted ones.
  // The Key cabinet destination item reflects the chosen Colo (Colo 1, 2, or 3).
  const destinations = useMemo(() => {
    const activeCabinet = getKeyCabinetOption(selectedKeyCabinetColo);
    const list = [
      {
        ...activeCabinet,
        id: "dest-key-cabinet",
        name: "Key cabinet",
        fullName: activeCabinet.fullName,
        description: activeCabinet.description,
        coords: activeCabinet.coords,
        readerId: activeCabinet.readerId,
        sequence: activeCabinet.sequence,
        cabinetColo: selectedKeyCabinetColo,
      },
      ...DEFAULT_DESTINATIONS.slice(1),
    ];
    customLocations.forEach((c) => {
      // Avoid duplicate IDs and exclude legacy unneeded destinations
      if (
        !list.some((d) => d.id === c.id) &&
        !c.id?.includes("colo") &&
        !c.name?.toLowerCase().includes("colo")
      ) {
        list.push({
          ...c,
          isDefault: false,
        });
      }
    });
    return list.filter((loc) => !deletedLocationIds.includes(loc.id));
  }, [selectedKeyCabinetColo, customLocations, deletedLocationIds]);

  // Active destination object
  const activeDestination = useMemo(() => {
    return (
      destinations.find((d) => d.id === activeDestinationId) ||
      destinations[0] ||
      DEFAULT_DESTINATIONS[0]
    );
  }, [destinations, activeDestinationId]);

  // Combined readers list: base readers from rfidReaders.json + any custom readers
  const allMergedReaders = useMemo(() => {
    const list = baseReaders.map((r) => ({ ...r, isCustom: false }));

    customLocations.forEach((loc) => {
      // Check if location already maps to an existing reader ID
      const existingIdx = list.findIndex(
        (r) => r.id === loc.id || (loc.readerId && r.id === loc.readerId),
      );

      if (existingIdx !== -1) {
        list[existingIdx] = {
          ...list[existingIdx],
          location: loc.name,
          coords: loc.coords,
          sequence: loc.sequence ?? list[existingIdx].sequence,
        };
      } else {
        list.push({
          id: loc.id,
          sequence: loc.sequence ?? 99,
          location: loc.name,
          coords: loc.coords,
          isCustom: true,
          category: loc.category,
        });
      }
    });

    return list.sort(
      (a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0),
    );
  }, [customLocations]);

  // Add a new hardcoded reader location
  const addReaderLocation = useCallback(
    ({ name, x, y, sequence, category = "Custom" }) => {
      const cleanX = Math.min(100, Math.max(0, parseFloat(x) || 0));
      const cleanY = Math.min(100, Math.max(0, parseFloat(y) || 0));
      const numX = Number(cleanX.toFixed(1));
      const numY = Number(cleanY.toFixed(1));

      const newId = `custom-loc-${Date.now()}`;
      const newLocation = {
        id: newId,
        name: name.trim() || `Reader (${numX}, ${numY})`,
        fullName: name.trim() || `Reader (${numX}, ${numY})`,
        description: `Reader Location at (${numX}%, ${numY}%)`,
        category,
        icon: "map-pin",
        coords: { x: numX, y: numY },
        sequence:
          sequence !== undefined && sequence !== "" ? Number(sequence) : 16,
        isCustom: true,
        createdAt: new Date().toISOString(),
      };

      setCustomLocations((prev) => [...prev, newLocation]);
      return newLocation;
    },
    [],
  );

  // Update an existing reader location
  const updateReaderLocation = useCallback((id, patch) => {
    setCustomLocations((prev) =>
      prev.map((loc) => {
        if (loc.id !== id) return loc;
        const updated = { ...loc, ...patch };
        if (patch.x !== undefined || patch.y !== undefined) {
          const x = patch.x !== undefined ? parseFloat(patch.x) : loc.coords.x;
          const y = patch.y !== undefined ? parseFloat(patch.y) : loc.coords.y;
          updated.coords = { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
        }
        return updated;
      }),
    );
  }, []);

  // Delete a location (custom or predefined unwanted location)
  const deleteReaderLocation = useCallback(
    (id) => {
      setDeletedLocationIds((prev) =>
        prev.includes(id) ? prev : [...prev, id],
      );
      setCustomLocations((prev) => prev.filter((loc) => loc.id !== id));
      if (activeDestinationId === id) {
        const remaining = destinations.filter((loc) => loc.id !== id);
        if (remaining.length > 0) {
          setActiveDestinationId(remaining[0].id);
        } else {
          setActiveDestinationId("");
        }
      }
    },
    [activeDestinationId, destinations],
  );

  // Reset all custom locations and un-delete locations back to factory defaults
  const resetToDefaults = useCallback(() => {
    setCustomLocations([]);
    setDeletedLocationIds([]);
    setActiveDestinationId("dest-key-cabinet");
    setSelectedKeyCabinetColo("colo1");
    try {
      localStorage.removeItem(STORAGE_CUSTOM_READERS_KEY);
      localStorage.removeItem(STORAGE_DELETED_DESTINATIONS_KEY);
      localStorage.removeItem(STORAGE_ACTIVE_DEST_KEY);
      localStorage.removeItem(STORAGE_CABINET_COLO_KEY);
    } catch (e) {}
  }, []);

  // Select destination
  const selectDestination = useCallback((destOrId) => {
    if (typeof destOrId === "string") {
      setActiveDestinationId(destOrId);
    } else if (destOrId && destOrId.id) {
      setActiveDestinationId(destOrId.id);
    }
  }, []);

  /**
   * Builds the precise corridor reader & waypoint path tailored for the chosen destination.
   * - Washroom: directs through corridor turn down into the washroom
   * - Colo-3: directs from reception through Man Trap and Above Colo-3 Door into Colo-3 cabinets
   * - Colo-2: directs along corridor through Above Colo-2 Door into Colo-2 cabinets
   * - NOC: directs along corridor to NOC Room Door
   * - Loading area: directs along corridor to Loading Gate Door
   * - Key cabinet: directs along the full corridor into Colo-1 to Cabinate End Point (Current Cabinet Location)
   */
  const getRouteForDestination = useCallback(
    (dest, baseRoute = allMergedReaders) => {
      const target = dest || activeDestination;
      if (!target) return baseRoute;

      const targetId = target.id || "";

      // ── 1. WASHROOM: Reception to Corridor Turn (same as Colo-1) -> Washroom Path -> Washroom ──
      if (
        targetId === "dest-washroom" ||
        target.name?.toLowerCase().includes("washroom")
      ) {
        return [
          {
            id: 32,
            sequence: 1,
            location: "Reception",
            coords: { x: 19.9, y: 40.9 },
          },
          {
            id: 38,
            sequence: 2,
            location: "Man Trap",
            coords: { x: 20.9, y: 35.0 },
          },
          {
            id: 29,
            sequence: 3,
            location: "Above Colo-3 Door",
            coords: { x: 22.3, y: 30.3 },
          },
          {
            id: 42,
            sequence: 4,
            location: "Bom 12 Main Entry Door",
            coords: { x: 22.7, y: 39.3 },
          },
          {
            id: 9045,
            sequence: 5,
            location: "Corridor Turn",
            coords: { x: 22.7, y: 44.9 },
            isWaypoint: true,
          },
          {
            id: 9048,
            sequence: 6,
            location: "Washroom Path",
            coords: { x: 22.7, y: 47.5 },
            isWaypoint: true,
          },
          {
            id: 9025,
            sequence: 7,
            location: "Washroom",
            coords: target.coords || { x: 19.2, y: 49.5 },
            isDestination: true,
          },
        ];
      }

      // Helper to identify Colo-3 and Colo-2 destinations (case-insensitive, handling "colo -3", "colo 3", "colo-3", etc.)
      const isColo3 = (str) => /colo\s*[-_]?\s*3/i.test(str || "");
      const isColo2 = (str) => /colo\s*[-_]?\s*2/i.test(str || "");

      // ── 2. COLO-3 (Cabinet / Path): Reception -> Man Trap (38) -> Above Colo-3 Door (29) -> Colo-3 North Corridor -> Server Aisle -> Colo-3 Key Cabinet ──
      if (
        target.cabinetColo === "colo3" ||
        targetId === "dest-colo-3" ||
        targetId === "dest-key-cabinet-colo3" ||
        isColo3(targetId) ||
        (isColo3(target.name) && !target.name?.toLowerCase().includes("washroom"))
      ) {
        return [
          {
            id: 32,
            sequence: 1,
            location: "Reception",
            coords: { x: 19.9, y: 40.9 },
          },
          {
            id: 38,
            sequence: 2,
            location: "Man Trap",
            coords: { x: 20.9, y: 35.0 },
          },
          {
            id: 29,
            sequence: 3,
            location: "Above Colo-3 Door",
            coords: { x: 21.5, y: 30.3 },
          },
          {
            id: 9001,
            sequence: 4,
            location: "Colo-3 Entry Corridor",
            coords: { x: 21.0, y: 26.5 },
            isWaypoint: true,
          },
          {
            id: 9002,
            sequence: 5,
            location: "Colo-3 Server Aisle Entry",
            coords: { x: 10.5, y: 26.5 },
            isWaypoint: true,
          },
          {
            id: target.readerId || target.id || 9003,
            sequence: 6,
            location: target.fullName || "Colo-3 Key Cabinet",
            name: target.name || "Key cabinet",
            coords: target.coords || { x: 10.5, y: 35.0 },
            isDestination: true,
          },
        ];
      }

      // ── 3. NOC / LOC: Proper corridor path to NOC Room Door ──
      if (
        targetId === "dest-noc" ||
        targetId === "dest-loc" ||
        target.name?.toLowerCase() === "noc" ||
        target.name?.toLowerCase() === "loc" ||
        target.name?.toLowerCase().includes("noc")
      ) {
        return [
          {
            id: 32,
            sequence: 1,
            location: "Reception",
            coords: { x: 19.9, y: 40.9 },
          },
          {
            id: 38,
            sequence: 2,
            location: "Man Trap",
            coords: { x: 20.9, y: 35.0 },
          },
          {
            id: 29,
            sequence: 3,
            location: "Above Colo-3 Door",
            coords: { x: 22.3, y: 30.3 },
          },
          {
            id: 42,
            sequence: 4,
            location: "Bom 12 Main Entry Door",
            coords: { x: 22.7, y: 39.3 },
          },
          {
            id: 9045,
            sequence: 5,
            location: "Corridor Turn",
            coords: { x: 22.7, y: 44.9 },
            isWaypoint: true,
          },
          {
            id: 33,
            sequence: 6,
            location: "NOC ROOM Door",
            coords: target.coords || { x: 26.8, y: 44.9 },
            isDestination: true,
          },
        ];
      }

      // ── 4. LOADING AREA: Corridor path to Loading Gate Door ──
      if (
        targetId === "dest-loading-area" ||
        target.name?.toLowerCase().includes("loading")
      ) {
        return [
          {
            id: 32,
            sequence: 1,
            location: "Reception",
            coords: { x: 19.9, y: 40.9 },
          },
          {
            id: 38,
            sequence: 2,
            location: "Man Trap",
            coords: { x: 20.9, y: 35.0 },
          },
          {
            id: 29,
            sequence: 3,
            location: "Above Colo-3 Door",
            coords: { x: 22.3, y: 30.3 },
          },
          {
            id: 42,
            sequence: 4,
            location: "Bom 12 Main Entry Door",
            coords: { x: 22.7, y: 39.3 },
          },
          {
            id: 9045,
            sequence: 5,
            location: "Corridor Turn",
            coords: { x: 22.7, y: 44.9 },
            isWaypoint: true,
          },
          {
            id: 33,
            sequence: 6,
            location: "NOC ROOM Door",
            coords: { x: 26.8, y: 44.9 },
          },
          {
            id: 16,
            sequence: 7,
            location: "Front of VSR Door",
            coords: { x: 34.4, y: 45.0 },
          },
          {
            id: 36,
            sequence: 8,
            location: "Front of Carrier A Door",
            coords: { x: 38.7, y: 45.6 },
          },
          {
            id: 31,
            sequence: 9,
            location: "Loding Gate Door",
            coords: target.coords || { x: 47.6, y: 45.4 },
            isDestination: true,
          },
        ];
      }

      // ── 5. COLO-2 (Cabinet / Path): Reception (1) -> Man Trap (2) -> Above Colo-3 Door (3) -> Bom 12 (4) -> Corridor Turn (4.5) -> NOC (5) -> VSR (6) -> Carrier A (7) -> Loading Gate (8) -> Above Colo-2 Door (9) -> colo-2 path 1 (10) -> colo-2 path 2 (11) -> colo 2 (12) ──
      if (
        target.cabinetColo === "colo2" ||
        targetId === "dest-colo-2" ||
        targetId === "dest-key-cabinet-colo2" ||
        isColo2(targetId) ||
        (isColo2(target.name) && !target.name?.toLowerCase().includes("washroom"))
      ) {
        // Look up any custom UI points configured by the user
        const customColo2Path1 = destinations.find(
          (d) =>
            isColo2(d.name) && (/path\s*1/i.test(d.name) || /p1/i.test(d.name)),
        );
        const customColo2Path2 = destinations.find(
          (d) =>
            isColo2(d.name) && (/path\s*2/i.test(d.name) || /p2/i.test(d.name)),
        );
        const customColo2Final =
          destinations.find((d) => isColo2(d.name) && !/path/i.test(d.name)) ||
          (isColo2(target.name) && !/path/i.test(target.name) ? target : null);

        // Path point coordinates (use UI custom location coordinates if added, else sensible layout defaults)
        const p1Coords = customColo2Path1?.coords || { x: 49.5, y: 39.8 };
        const p2Coords = customColo2Path2?.coords || { x: 49.5, y: 36.5 };
        const finalCoords = target.coords ||
          customColo2Final?.coords || { x: 49.5, y: 33.5 };

        const isTargetP1 =
          /path\s*1/i.test(target.name || "") || /p1/i.test(target.name || "");
        const isTargetP2 =
          /path\s*2/i.test(target.name || "") || /p2/i.test(target.name || "");

        const baseHallway = [
          {
            id: 32,
            sequence: 1,
            location: "Reception",
            coords: { x: 19.9, y: 40.9 },
          },
          {
            id: 38,
            sequence: 2,
            location: "Man Trap",
            coords: { x: 20.9, y: 35.0 },
          },
          {
            id: 29,
            sequence: 3,
            location: "Above Colo-3 Door",
            coords: { x: 22.3, y: 30.3 },
          },
          {
            id: 42,
            sequence: 4,
            location: "Bom 12 Main Entry Door",
            coords: { x: 22.7, y: 39.3 },
          },
          {
            id: 9045,
            sequence: 4.5,
            location: "Corridor Turn",
            coords: { x: 22.7, y: 44.9 },
            isWaypoint: true,
          },
          {
            id: 33,
            sequence: 5,
            location: "NOC ROOM Door",
            coords: { x: 26.8, y: 44.9 },
          },
          {
            id: 16,
            sequence: 6,
            location: "Front of VSR Door",
            coords: { x: 34.4, y: 45.0 },
          },
          {
            id: 36,
            sequence: 7,
            location: "Front of Carrier A Door",
            coords: { x: 38.7, y: 45.6 },
          },
          {
            id: 31,
            sequence: 8,
            location: "Loding Gate Door",
            coords: { x: 47.6, y: 45.4 },
          },
          {
            id: 45,
            sequence: 9,
            location: "Above Colo-2 Door",
            coords: { x: 47.6, y: 39.8 },
          },
        ];

        if (isTargetP1) {
          return [
            ...baseHallway,
            {
              id: customColo2Path1?.id || 9046,
              sequence: 10,
              location: customColo2Path1?.name || "colo-2 path 1",
              coords: target.coords || p1Coords,
              isDestination: true,
            },
          ];
        }

        if (isTargetP2) {
          return [
            ...baseHallway,
            {
              id: customColo2Path1?.id || 9046,
              sequence: 10,
              location: customColo2Path1?.name || "colo-2 path 1",
              coords: p1Coords,
              isWaypoint: true,
            },
            {
              id: customColo2Path2?.id || 9047,
              sequence: 11,
              location: customColo2Path2?.name || "colo-2 path 2",
              coords: target.coords || p2Coords,
              isDestination: true,
            },
          ];
        }

        // Final destination: colo 2
        return [
          ...baseHallway,
          {
            id: customColo2Path1?.id || 9046,
            sequence: 10,
            location: customColo2Path1?.name || "colo-2 path 1",
            coords: p1Coords,
            isWaypoint: true,
          },
          {
            id: customColo2Path2?.id || 9047,
            sequence: 11,
            location: customColo2Path2?.name || "colo-2 path 2",
            coords: p2Coords,
            isWaypoint: true,
          },
          {
            id: target.readerId || target.id || 9002,
            sequence: 12,
            location: target.fullName || "Colo 2 Key Cabinet",
            name: target.name || "Key cabinet",
            coords: finalCoords,
            isDestination: true,
          },
        ];
      }

      // ── 6. KEY CABINET (Current Cabinet Location): Full corridor path via Man Trap -> Above Colo-3 Door -> Bom 12 to Cabinate End Point ──
      if (
        target.cabinetColo === "colo1" ||
        targetId === "dest-key-cabinet" ||
        targetId === "dest-key-cabinet-colo1" ||
        target.name?.toLowerCase().includes("key cabinet") ||
        target.category === "Cabinet"
      ) {
        return [
          {
            id: 32,
            sequence: 1,
            location: "Reception",
            coords: { x: 19.9, y: 40.9 },
          },
          {
            id: 38,
            sequence: 2,
            location: "Man Trap",
            coords: { x: 20.9, y: 35.0 },
          },
          {
            id: 29,
            sequence: 3,
            location: "Above Colo-3 Door",
            coords: { x: 22.3, y: 30.3 },
          },
          {
            id: 42,
            sequence: 4,
            location: "Bom 12 Main Entry Door",
            coords: { x: 22.7, y: 39.3 },
          },
          {
            id: 9045,
            sequence: 4.5,
            location: "Corridor Turn",
            coords: { x: 22.7, y: 44.9 },
            isWaypoint: true,
          },
          {
            id: 33,
            sequence: 5,
            location: "NOC ROOM Door",
            coords: { x: 26.8, y: 44.9 },
          },
          {
            id: 16,
            sequence: 6,
            location: "Front of VSR Door",
            coords: { x: 34.4, y: 45.0 },
          },
          {
            id: 36,
            sequence: 7,
            location: "Front of Carrier A Door",
            coords: { x: 38.7, y: 45.6 },
          },
          {
            id: 31,
            sequence: 8,
            location: "Loding Gate Door",
            coords: { x: 47.6, y: 45.4 },
          },
          {
            id: 45,
            sequence: 9,
            location: "Above Colo-2 Door",
            coords: { x: 47.6, y: 39.8 },
          },
          {
            id: 39,
            sequence: 10,
            location: "Colo-1-2 passage 1",
            coords: { x: 52.0, y: 39.8 },
          },
          {
            id: 46,
            sequence: 11,
            location: "Colo-1-2 passage 2",
            coords: { x: 56.8, y: 39.8 },
          },
          {
            id: 30,
            sequence: 12,
            location: "Colo-1 Entry",
            coords: { x: 61.3, y: 40.3 },
          },
          {
            id: 34,
            sequence: 13,
            location: "Facing Toward Row 5-6",
            coords: { x: 61.3, y: 44.4 },
          },
          {
            id: 41,
            sequence: 14,
            location: "First Reader of Row 5,6",
            coords: { x: 66.6, y: 44.4 },
          },
          {
            id: 43,
            sequence: 15,
            location: "Cabinate End Point",
            coords: target.coords || { x: 70.3, y: 44.4 },
            isDestination: true,
          },
        ];
      }

      // ── 7. Custom or unmapped destination: Clean corridor route up to target coords ──
      const targetSeq = Number(target.sequence) || 99;
      const route = [];
      let reachedTarget = false;

      for (let i = 0; i < baseRoute.length; i++) {
        const r = baseRoute[i];
        const rSeq = Number(r.sequence) || 0;

        if (rSeq < targetSeq) {
          route.push(r);
        } else if (
          rSeq === targetSeq ||
          r.id === target.readerId ||
          r.id === target.id
        ) {
          route.push({
            ...r,
            location: target.name || r.location,
            coords: target.coords || r.coords,
            isDestination: true,
          });
          reachedTarget = true;
          break;
        } else {
          if (!reachedTarget) {
            route.push({
              id: target.id || 9999,
              sequence: targetSeq,
              location: target.name,
              coords: target.coords,
              isDestination: true,
            });
            reachedTarget = true;
          }
          break;
        }
      }

      if (!reachedTarget) {
        route.push({
          id: target.id || 9999,
          sequence: targetSeq,
          location: target.name,
          coords: target.coords,
          isDestination: true,
        });
      }

      return route;
    },
    [activeDestination, allMergedReaders, destinations],
  );

  return {
    destinations,
    activeDestination,
    activeDestinationId,
    selectedKeyCabinetColo,
    selectKeyCabinetColo,
    selectDestination,
    allMergedReaders,
    customLocations,
    addReaderLocation,
    updateReaderLocation,
    deleteLocation: deleteReaderLocation,
    deleteReaderLocation,
    resetToDefaults,
    getRouteForDestination,
  };
}
