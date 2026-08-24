import React from "react";
import { CheckCircle2, XCircle, User, Tag, Building } from "lucide-react";

export default function DestinationModal({ visitorName, tagCode, company, onClose }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
        boxSizing: "border-box",
        animation: "fadeIn 0.3s ease-out forwards",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "360px",
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          padding: "28px 24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)",
          textAlign: "center",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          transform: "translateY(0)",
          transition: "all 0.3s ease",
        }}
      >
        {/* Animated Check Icon Badge */}
        <div
          style={{
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            backgroundColor: "#dcfce7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px auto",
            boxShadow: "0 0 0 8px rgba(34, 197, 94, 0.15)",
          }}
        >
          <CheckCircle2 size={40} color="#16a34a" strokeWidth={2.2} />
        </div>

        {/* Header Title & Subtitle */}
        <h2
          style={{
            margin: "0 0 8px 0",
            fontSize: "20px",
            fontWeight: "800",
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          You reached your cabinet!
        </h2>
        <p
          style={{
            margin: "0 0 22px 0",
            fontSize: "13px",
            color: "#64748b",
            lineHeight: "1.5",
          }}
        >
          Navigation complete. Your tag has arrived at the final destination.
        </p>

        {/* Visitor Info Card */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: "16px",
            padding: "14px 16px",
            margin: "0 0 24px 0",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            textAlign: "left",
          }}
        >
          {visitorName && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <User size={16} color="#64748b" />
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "500", width: "70px" }}>
                Visitor
              </span>
              <span style={{ fontSize: "13px", color: "#0f172a", fontWeight: "700" }}>
                {visitorName}
              </span>
            </div>
          )}

          {tagCode && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Tag size={16} color="#64748b" />
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "500", width: "70px" }}>
                Tag Code
              </span>
              <span style={{ fontSize: "13px", color: "#0ea5e9", fontWeight: "700" }}>
                {tagCode}
              </span>
            </div>
          )}

          {company && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Building size={16} color="#64748b" />
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "500", width: "70px" }}>
                Company
              </span>
              <span style={{ fontSize: "13px", color: "#0f172a", fontWeight: "600" }}>
                {company}
              </span>
            </div>
          )}
        </div>

        {/* Close Map Button */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            height: "48px",
            backgroundColor: "#0ea5e9",
            color: "#ffffff",
            border: "none",
            borderRadius: "14px",
            fontSize: "15px",
            fontWeight: "700",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 10px 20px -5px rgba(14, 165, 233, 0.4)",
            transition: "all 0.2s ease",
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#0284c7")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#0ea5e9")}
        >
          <XCircle size={18} />
          <span>Close Map</span>
        </button>
      </div>
    </div>
  );
}
