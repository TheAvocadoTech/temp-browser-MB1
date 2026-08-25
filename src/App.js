import React, { useState, useEffect, useCallback } from "react";
import MobileFrame from "./components/MobileFrame";
import Map3DCanvas from "./components/Map3DCanvas";
import DestinationModal from "./components/DestinationModal";
import SessionExpiredScreen from "./components/SessionExpiredScreen";

export default function App() {
  // Parse URL Query parameters: ?token=VTK_... or ?tagCode=V002
  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get("token");
  const tagCodeParam = urlParams.get("tagCode");

  const [token] = useState(tokenParam || null);
  const [tagCode] = useState(tagCodeParam || "V002");
  const [liveData, setLiveData] = useState(null);

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
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          {isSessionExpired ? (
            <SessionExpiredScreen onRecheck={handleRecheckSession} />
          ) : (
            <>
              {/* 3D Navigation Canvas Container */}
              <Map3DCanvas liveData={liveData} />

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
