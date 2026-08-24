import React from "react";
import { ShieldCheck, MapPinOff, RefreshCw } from "lucide-react";

export default function SessionExpiredScreen({ onRecheck }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        boxSizing: "border-box",
        textAlign: "center",
        color: "#ffffff",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "24px",
          backgroundColor: "rgba(14, 165, 233, 0.12)",
          border: "1px solid rgba(14, 165, 233, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
          boxShadow: "0 0 30px rgba(14, 165, 233, 0.2)",
        }}
      >
        <ShieldCheck size={38} color="#0ea5e9" />
      </div>

      <h2
        style={{
          fontSize: "22px",
          fontWeight: "800",
          margin: "0 0 10px 0",
          color: "#f8fafc",
          letterSpacing: "-0.02em",
        }}
      >
        Session Expired & Map Closed
      </h2>

      <p
        style={{
          fontSize: "14px",
          color: "#94a3b8",
          lineHeight: "1.6",
          maxWidth: "280px",
          margin: "0 0 28px 0",
        }}
      >
        Your 3D map tracking session has ended. Thank you for using the Course Navigation system.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderRadius: "20px",
          fontSize: "12px",
          color: "#64748b",
          marginBottom: "28px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <MapPinOff size={14} color="#64748b" />
        <span>Live location updates stopped</span>
      </div>

      {onRecheck && (
        <button
          onClick={onRecheck}
          style={{
            backgroundColor: "transparent",
            color: "#0ea5e9",
            border: "1px solid rgba(14, 165, 233, 0.4)",
            borderRadius: "12px",
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s ease",
          }}
        >
          <RefreshCw size={14} />
          <span>Re-open Navigation</span>
        </button>
      )}
    </div>
  );
}
