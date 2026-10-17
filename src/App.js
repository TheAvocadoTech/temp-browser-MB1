import React, { useState, useEffect, useCallback, useMemo } from "react";
import MobileFrame from "./components/MobileFrame";
import PathMapCanvas from "./components/PathMapCanvas";
import Map3DCanvas from "./components/Map3DCanvas";
import DestinationModal from "./components/DestinationModal";
import SelectDestinationModal from "./components/SelectDestinationModal";
import SessionExpiredScreen from "./components/SessionExpiredScreen";
import { useReaderLocations } from "./hooks/useReaderLocations";
import { Layers, Box, Navigation, Key } from "lucide-react";

export default function App() {
  // Parse URL Query parameters: ?token=VTK_... or ?tagCode=V002
  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get("token");
  const tagCodeParam = urlParams.get("tagCode");

  const [token] = useState(tokenParam || null);
  const [tagCode] = useState(tagCodeParam || "V002");
  const [liveData, setLiveData] = useState(null);

  // Map Mode: "2D" (default blueprint dotted map) or "3D" (3D facility view)
  const [mapMode, setMapMode] = useState("2D");

  // Reader locations & active destination management
  const {
    destinations,
    activeDestination,
    selectDestination,
    selectedKeyCabinetColo,
    selectKeyCabinetColo,
    allMergedReaders,
    deleteReaderLocation,
    resetToDefaults,
    getRouteForDestination,
  } = useReaderLocations();

  // Route computed up to the active destination
  const activeRoute = useMemo(() => {
    return getRouteForDestination(activeDestination, allMergedReaders);
  }, [getRouteForDestination, activeDestination, allMergedReaders]);

  // Modal dialog states
  const [isSelectDestOpen, setIsSelectDestOpen] = useState(false);
  const [isPickMode, setIsPickMode] = useState(false);
  const [, setPickedCoords] = useState(null);

  // Session & Arrival Overlay States
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [hasClosedMap, setHasClosedMap] = useState(false);

  // Reset closed flag whenever user chooses a new destination
  const handleSelectDestination = (dest) => {
    selectDestination(dest);
    setHasClosedMap(false);
  };

  const handlePickCoords = (coords) => {
    setPickedCoords(coords);
    setIsPickMode(false);
  };

  const fetchLivePath = useCallback(async () => {
    // If session was expired, halt polling
    if (isSessionExpired) return;

    try {
      const configuredApi = process.env.REACT_APP_API_URL;
      const API_BASE =
        configuredApi && !configuredApi.includes("192.168.20.10")
          ? configuredApi
          : `${window.location.protocol}//${window.location.hostname || "localhost"}:7000`;
      const targetUrl = token
        ? `${API_BASE}/api/rfid/live-token/${token}?_t=${Date.now()}`
        : `${API_BASE}/api/rfid/live/${tagCode || ""}?_t=${Date.now()}`;

      const response = await fetch(targetUrl);

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          const data = json.data;
          setLiveData(data);

          // Check if token session is expired in DB
          if (data.isExpired) {
            setIsSessionExpired(true);
            setShowDestinationModal(false);
            return;
          }

          // Trigger destination arrival when tag arrives at target
          const currentReader = data.currentReader;
          const isAtActiveTarget =
            (data.isAtDestination && (activeDestination?.id === "dest-key-cabinet" || activeDestination?.readerId === 43)) ||
            (currentReader && (
              currentReader.id === activeDestination?.readerId ||
              currentReader.id === activeDestination?.id ||
              (activeDestination?.coords &&
                Math.abs(currentReader.coords?.x - activeDestination.coords.x) < 0.5 &&
                Math.abs(currentReader.coords?.y - activeDestination.coords.y) < 0.5)
            ));

          if (isAtActiveTarget && !hasClosedMap) {
            setShowDestinationModal(true);
          }
        }
      }
    } catch (err) {
      console.error("Live path polling error:", err);
    }
  }, [token, tagCode, isSessionExpired, hasClosedMap, activeDestination]);

  useEffect(() => {
    fetchLivePath();
    // Fast 300ms polling interval ensures real-time map updates
    const interval = setInterval(fetchLivePath, 300);
    return () => clearInterval(interval);
  }, [fetchLivePath]);

  const handleCloseMap = () => {
    setShowDestinationModal(false);
    setHasClosedMap(true);
  };

  const handleRecheckSession = () => {
    setHasClosedMap(false);
    setIsSessionExpired(false);
  };

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
        boxSizing: "border-box",
      }}
    >
      <MobileFrame>
        <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
          {isSessionExpired ? (
            <SessionExpiredScreen onRecheck={handleRecheckSession} />
          ) : (
            <>
              {/* ── Top Floating Navigation & Action Bar ── */}
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "56px",
                  zIndex: 30,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {/* Destination Selector Pill */}
                <button
                  onClick={() => setIsSelectDestOpen(true)}
                  title="Choose destination to move to (Key cabinet, Washroom, NOC, Loading area)"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "12px",
                    padding: "7px 12px",
                    border: "1px solid #cbd5e1",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#0f172a",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f0f9ff")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.95)")}
                >
                  <Navigation size={14} color="#0284c7" />
                  <span>
                    To: {activeDestination?.name || "Destination"}
                    {activeDestination?.category === "Cabinet"
                      ? ` (${selectedKeyCabinetColo === "colo1" ? "Colo 1" : selectedKeyCabinetColo === "colo2" ? "Colo 2" : "Colo 3"})`
                      : ""}
                  </span>
                </button>

                {/* Key Cabinet Colo Dropdown (Colo 1, Colo 2, Colo 3) */}
                <div
                  title="Select Key Cabinet Colo room (Colo 1, Colo 2, Colo 3)"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "12px",
                    padding: "5px 8px",
                    border:
                      activeDestination?.category === "Cabinet"
                        ? "1.5px solid #f59e0b"
                        : "1px solid #cbd5e1",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                >
                  <Key size={13} color="#f59e0b" />
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#475569",
                    }}
                  >
                    Cabinet:
                  </span>
                  <select
                    id="header-cabinet-dropdown"
                    value={selectedKeyCabinetColo}
                    onChange={(e) => {
                      selectKeyCabinetColo(e.target.value);
                      setHasClosedMap(false);
                    }}
                    style={{
                      border: "none",
                      backgroundColor: "transparent",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#0f172a",
                      cursor: "pointer",
                      outline: "none",
                      padding: "2px 0",
                    }}
                  >
                    <option value="colo1">Colo 1</option>
                    <option value="colo2">Colo 2</option>
                    <option value="colo3">Colo 3</option>
                  </select>
                </div>


                {/* 2D / 3D Mode Toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "12px",
                    padding: "3px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                >
                  <button
                    onClick={() => setMapMode("2D")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      border: "none",
                      borderRadius: "9px",
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: mapMode === "2D" ? "700" : "600",
                      color: mapMode === "2D" ? "#ffffff" : "#64748b",
                      backgroundColor: mapMode === "2D" ? "#0284c7" : "transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Layers size={13} />
                    <span>2D</span>
                  </button>
                  <button
                    onClick={() => setMapMode("3D")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      border: "none",
                      borderRadius: "9px",
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: mapMode === "3D" ? "700" : "600",
                      color: mapMode === "3D" ? "#ffffff" : "#64748b",
                      backgroundColor: mapMode === "3D" ? "#0284c7" : "transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Box size={13} />
                    <span>3D</span>
                  </button>
                </div>
              </div>

              {/* ── Active Map View ── */}
              <div style={{ width: "100%", height: "100%", flex: 1, position: "relative" }}>
                {mapMode === "2D" ? (
                  <PathMapCanvas
                    liveData={liveData}
                    destination={activeDestination}
                    selectedKeyCabinetColo={selectedKeyCabinetColo}
                    activeRoute={activeRoute}
                    allMergedReaders={allMergedReaders}
                    onOpenDestinationModal={() => setIsSelectDestOpen(true)}
                    isPickMode={isPickMode}
                    setIsPickMode={setIsPickMode}
                    onPickCoords={handlePickCoords}
                    onSelectDestination={handleSelectDestination}
                  />
                ) : (
                  <Map3DCanvas
                    liveData={liveData}
                    destination={activeDestination}
                    selectedKeyCabinetColo={selectedKeyCabinetColo}
                    activeRoute={activeRoute}
                    allMergedReaders={allMergedReaders}
                    onOpenDestinationModal={() => setIsSelectDestOpen(true)}
                    onSelectDestination={handleSelectDestination}
                  />
                )}
              </div>

              {/* Modal: Select Destination Location (with Delete unwanted locations) */}
              <SelectDestinationModal
                isOpen={isSelectDestOpen}
                onClose={() => setIsSelectDestOpen(false)}
                destinations={destinations}
                activeDestination={activeDestination}
                selectedKeyCabinetColo={selectedKeyCabinetColo}
                onSelectCabinetColo={selectKeyCabinetColo}
                onSelectDestination={handleSelectDestination}
                onDeleteDestination={deleteReaderLocation}
                onResetDefaults={resetToDefaults}
              />

              {/* Destination Arrival Reached Modal Overlay */}
              {showDestinationModal && (
                <DestinationModal
                  visitorName={liveData?.visitorName}
                  tagCode={liveData?.idNumber || liveData?.tagCode}
                  company={liveData?.company}
                  destinationName={activeDestination?.name}
                  onClose={handleCloseMap}
                />
              )}
            </>
          )}
        </div>
      </MobileFrame>
    </div>
  );
}
