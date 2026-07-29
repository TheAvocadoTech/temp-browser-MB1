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

        {/* EQUINIX Logo */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <img
            src={`${process.env.PUBLIC_URL}/equinix-logo.png`}
            alt="EQUINIX Logo"
            style={{ height: "24px", maxWidth: "200px", objectFit: "contain" }}
          />
        </div>
      </div>

      {/* Center Path Map Area (Takes full remaining vertical space) */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, width: "100%" }}>
        {children}
      </div>
    </div>
  );
}
