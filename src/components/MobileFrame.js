import React from "react";

export default function MobileFrame({ children }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "640px",
        height: "100vh",
        maxHeight: "1000px",
        backgroundColor: "#ffffff",
        borderRadius: "24px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.12)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        margin: "0 auto",
        boxSizing: "border-box",
        padding: "20px",
      }}
    >
      {/* Brand Header: Red Accent Line + AVOCADO Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
          paddingLeft: "4px",
          flexShrink: 0,
        }}
      >
        {/* Red Vertical Accent Line */}
        <div
          style={{
            width: "4px",
            height: "32px",
            backgroundColor: "#dc2626",
            borderRadius: "2px",
          }}
        />

        {/* AVOCADO Logo Text & Tagline */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Green Leaf Logo Graphic */}
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#658348" />
            <path d="M 14 26 C 14 16 26 14 26 14 C 26 24 16 26 14 26 Z" fill="#ffffff" />
            <circle cx="18" cy="18" r="3" fill="#658348" />
          </svg>
          <div>
            <div style={{ fontSize: "17px", fontWeight: "800", color: "#658348", letterSpacing: "0.08em", lineHeight: "1" }}>
              AVOCADO
            </div>
            <div style={{ fontSize: "9px", fontWeight: "600", color: "#658348", letterSpacing: "0.04em" }}>
              From seed to screen
            </div>
          </div>
        </div>
      </div>

      {/* Center Path Map Area (Takes full remaining vertical space) */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, width: "100%" }}>
        {children}
      </div>
    </div>
  );
}
