import React, { useState } from "react";
import defaultTransform from "../config/mapTransform.json";

export default function ModelCalibrator({
  onChange,
  showFloorplan,
  setShowFloorplan,
  floorplanOpacity,
  setFloorplanOpacity,
  onClose,
}) {
  const [t, setT] = useState(defaultTransform);
  const [copied, setCopied] = useState(false);

  const update = (patch) => {
    const next = { ...t, ...patch, position: { ...t.position, ...(patch.position || {}) } };
    setT(next);
    onChange(next);
  };

  const handleReset = () => {
    setT(defaultTransform);
    onChange(defaultTransform);
  };

  const handleCopy = () => {
    const jsonStr = JSON.stringify(t, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const slider = (label, value, min, max, step, onSlide) => {
    // Determine decimal places from step for the text input display
    const decimals = step < 0.001 ? 5 : step < 0.01 ? 4 : step < 0.1 ? 3 : 2;

    const handleTextChange = (e) => {
      const raw = e.target.value;
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onSlide(parsed);
      }
    };

    return (
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontWeight: "500", color: "#334155", marginBottom: 2 }}>
          <span>{label}</span>
          <input
            type="number"
            value={parseFloat(value.toFixed(decimals))}
            step={step}
            min={min}
            max={max}
            onChange={handleTextChange}
            style={{
              width: 72,
              fontSize: 11,
              fontFamily: "monospace",
              padding: "2px 4px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              textAlign: "right",
              background: "#f8fafc",
              color: "#0f172a",
              outline: "none",
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onSlide(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: "#0ea5e9", margin: "2px 0" }}
        />
      </div>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        background: "rgba(255, 255, 255, 0.95)",
        padding: 12,
        borderRadius: 12,
        zIndex: 50,
        width: 240,
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
        backdropFilter: "blur(8px)",
        border: "1px solid #e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #e2e8f0" }}>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: "700", color: "#0f172a" }}>3D Model Calibrator</h4>
        {onClose && (
          <button
            onClick={onClose}
            style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", fontSize: 14, fontWeight: "bold" }}
          >
            ✕
          </button>
        )}
      </div>

      {slider("Pos X", t.position.x, -50, 50, 0.1, (v) => update({ position: { x: v } }))}
      {slider("Pos Y", t.position.y, -20, 20, 0.1, (v) => update({ position: { y: v } }))}
      {slider("Pos Z", t.position.z, -50, 50, 0.1, (v) => update({ position: { z: v } }))}
      {slider("Rotation Y", t.rotationY, -Math.PI * 2, Math.PI * 2, 0.01, (v) => update({ rotationY: v }))}
      {slider("Scale", t.scale, 0.001, 10, 0.005, (v) => update({ scale: v }))}

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", color: "#334155", fontWeight: "500", marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={showFloorplan}
            onChange={(e) => setShowFloorplan(e.target.checked)}
            style={{ accentColor: "#0ea5e9" }}
          />
          Show 2D Floorplan Overlay
        </label>
        {showFloorplan && slider("Floorplan Opacity", floorplanOpacity, 0.1, 1, 0.05, setFloorplanOpacity)}
      </div>

      <pre
        style={{
          fontSize: 10,
          background: "#0f172a",
          color: "#38bdf8",
          padding: 8,
          borderRadius: 6,
          overflowX: "auto",
          maxHeight: 70,
          margin: "8px 0",
        }}
      >
        {JSON.stringify(t, null, 2)}
      </pre>

      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1,
            padding: "6px 8px",
            fontSize: 11,
            fontWeight: "600",
            backgroundColor: copied ? "#22c55e" : "#0ea5e9",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: "6px 8px",
            fontSize: 11,
            fontWeight: "600",
            backgroundColor: "#f1f5f9",
            color: "#475569",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}