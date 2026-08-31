import React, { useState, useEffect, useCallback } from "react";
import MobileFrame from "./components/MobileFrame";
import PathMapCanvas from "./components/PathMapCanvas";
import Map3DCanvas from "./components/Map3DCanvas";
import DestinationModal from "./components/DestinationModal";
import SessionExpiredScreen from "./components/SessionExpiredScreen";
import { Layers, Box } from "lucide-react";

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

  // Session & Arrival Overlay States
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [hasClosedMap, setHasClosedMap] = useState(false);

  const fetchLivePath = useCallback(async () => {
    // If session was expired, halt polling
    if (isSessionExpired) return;

    try {
      const API_BASE =
        process.env.REACT_APP_API_URL ||
        `${window.location.protocol}//${window.location.hostname}:7000`;
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

          // Trigger destination modal when tag reaches final sequence reader
          if (data.isAtDestination && !hasClosedMap) {
            setShowDestinationModal(true);
          }
        }
      }
    } catch (err) {
      console.error("Live path polling error:", err);
    }
  }, [token, tagCode, isSessionExpired, hasClosedMap]);

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
              {/* ── Floating 2D / 3D Mode Toggle ── */}
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "120px",
                  zIndex: 30,
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
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: mapMode === "2D" ? "700" : "600",
                    color: mapMode === "2D" ? "#ffffff" : "#64748b",
                    backgroundColor: mapMode === "2D" ? "#0284c7" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Layers size={14} />
                  <span>2D Map</span>
                </button>
                <button
                  onClick={() => setMapMode("3D")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    border: "none",
                    borderRadius: "9px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: mapMode === "3D" ? "700" : "600",
                    color: mapMode === "3D" ? "#ffffff" : "#64748b",
                    backgroundColor: mapMode === "3D" ? "#0284c7" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Box size={14} />
                  <span>3D Map</span>
                </button>
              </div>

              {/* ── Active Map View ── */}
              <div style={{ width: "100%", height: "100%", flex: 1, position: "relative" }}>
                {mapMode === "2D" ? (
                  <PathMapCanvas liveData={liveData} />
                ) : (
                  <Map3DCanvas liveData={liveData} />
                )}
              </div>

              {/* Destination Reached Modal Overlay */}
              {showDestinationModal && (
                <DestinationModal
                  visitorName={liveData?.visitorName}
                  tagCode={liveData?.idNumber || liveData?.tagCode}
                  company={liveData?.company}
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
