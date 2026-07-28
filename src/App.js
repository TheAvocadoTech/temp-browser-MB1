import React, { useState, useEffect, useCallback } from "react";
import MobileFrame from "./components/MobileFrame";
import PathMapCanvas from "./components/PathMapCanvas";

export default function App() {
  // Parse URL Query parameters: ?token=VTK_... or ?tagCode=E28011B0...
  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get("token");
  const tagCodeParam = urlParams.get("tagCode");

  const [token] = useState(tokenParam || null);
  const [tagCode] = useState(tagCodeParam || "E28011B0A502006E81D29C8");
  const [liveData, setLiveData] = useState(null);

  const fetchLivePath = useCallback(async () => {
    try {
      // Determine endpoint based on whether ?token= or ?tagCode= is passed in URL
      const targetUrl = token
        ? `http://localhost:3000/api/rfid/live-token/${token}?_t=${Date.now()}`
        : `http://localhost:3000/api/rfid/live/${tagCode}?_t=${Date.now()}`;

      const response = await fetch(targetUrl, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          setLiveData(json.data);
        }
      }
    } catch (err) {
      console.error("Live path polling error:", err);
    }
  }, [token, tagCode]);

  useEffect(() => {
    fetchLivePath();
    // Fast 1000ms polling interval ensures real-time map updates
    const interval = setInterval(fetchLivePath, 1000);
    return () => clearInterval(interval);
  }, [fetchLivePath]);

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
        boxSizing: "border-box",
      }}
    >
      <MobileFrame>
        <PathMapCanvas liveData={liveData} />
      </MobileFrame>
    </div>
  );
}
