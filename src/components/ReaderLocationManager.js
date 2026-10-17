// src/components/ReaderLocationManager.js
import React, { useState } from "react";
import {
  MapPin,
  Plus,
  Trash2,
  X,
  Crosshair,
  RotateCcw,
  Navigation,
  Check,
  Radio,
  Sliders,
} from "lucide-react";

export default function ReaderLocationManager({
  isOpen,
  onClose,
  allLocations,
  onAddLocation,
  onDeleteLocation,
  onResetDefaults,
  onSelectDestination,
  activeDestination,
  isPickMode,
  setIsPickMode,
  pickedCoords,
}) {
  const [name, setName] = useState("");
  const [xVal, setXVal] = useState("");
  const [yVal, setYVal] = useState("");
  const [seqVal, setSeqVal] = useState("16");
  const [categoryVal, setCategoryVal] = useState("Reader");
  const [successMsg, setSuccessMsg] = useState("");

  // Update form inputs when coordinates are picked from the map
  React.useEffect(() => {
    if (pickedCoords) {
      setXVal(pickedCoords.x.toString());
      setYVal(pickedCoords.y.toString());
      setSuccessMsg(`Picked coordinates: (${pickedCoords.x}%, ${pickedCoords.y}%)`);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  }, [pickedCoords]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter a location name.");
      return;
    }
    if (xVal === "" || yVal === "") {
      alert("Please provide valid X and Y coordinates (0 - 100%).");
      return;
    }

    const newLoc = onAddLocation({
      name: name.trim(),
      x: parseFloat(xVal),
      y: parseFloat(yVal),
      sequence: seqVal ? parseFloat(seqVal) : 16,
      category: categoryVal,
    });

    setName("");
    setXVal("");
    setYVal("");
    setSuccessMsg(`Added "${newLoc.name}" at (${newLoc.coords.x}%, ${newLoc.coords.y}%)!`);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
        padding: "16px",
        boxSizing: "border-box",
        animation: "fadeIn 0.25s ease-out forwards",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          maxHeight: "94%",
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15)",
          overflow: "hidden",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          animation: "slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#f0fdf4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Radio size={20} color="#16a34a" />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "17px",
                  fontWeight: "800",
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                Reader Locations
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Add hardcoded locations (name & coordinates)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#f1f5f9",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* Add Location Form Card */}
          <form
            onSubmit={handleSubmit}
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                ➕ Add Reader Location
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsPickMode(!isPickMode);
                  if (!isPickMode) {
                    onClose();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "4px 8px",
                  borderRadius: "8px",
                  border: isPickMode ? "1px solid #0284c7" : "1px solid #cbd5e1",
                  backgroundColor: isPickMode ? "#e0f2fe" : "#ffffff",
                  color: isPickMode ? "#0284c7" : "#475569",
                  cursor: "pointer",
                }}
                title="Click on the 2D map to inspect or pick coordinates"
              >
                <Crosshair size={13} />
                <span>{isPickMode ? "Picking Active" : "Pick on Map"}</span>
              </button>
            </div>

            {/* Name Input */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "#475569",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                Location Name
              </label>
              <input
                type="text"
                placeholder="e.g. Washroom 2, Server Colo-3, Battery Room..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            {/* Coordinates row: X and Y */}
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#475569",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  X Coordinate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 29.5"
                  value={xVal}
                  onChange={(e) => setXVal(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#475569",
                    marginBottom: "49px",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  Y Coordinate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 44.9"
                  value={yVal}
                  onChange={(e) => setYVal(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ width: "90px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#475569",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  Sequence #
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  placeholder="16"
                  value={seqVal}
                  onChange={(e) => setSeqVal(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Success notification */}
            {successMsg && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#16a34a",
                  fontWeight: "600",
                  backgroundColor: "#dcfce7",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Check size={14} />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 16px",
                backgroundColor: "#0ea5e9",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(14, 165, 233, 0.3)",
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={16} />
              <span>Save Hardcoded Reader Location</span>
            </button>
          </form>

          {/* Configured Locations List */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                Configured Reader Locations ({allLocations.length})
              </span>
              <button
                type="button"
                onClick={onResetDefaults}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "#64748b",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                <RotateCcw size={12} />
                <span>Reset Defaults</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {allLocations.map((loc) => {
                const isActive = activeDestination?.id === loc.id;

                return (
                  <div
                    key={loc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      backgroundColor: isActive ? "#f0f9ff" : "#f8fafc",
                      border: isActive ? "1px solid #0284c7" : "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "8px",
                          backgroundColor: loc.isCustom ? "#fef3c7" : "#e0f2fe",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MapPin size={15} color={loc.isCustom ? "#d97706" : "#0284c7"} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                            {loc.name}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "700",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              backgroundColor: loc.isCustom ? "#fef3c7" : "#f1f5f9",
                              color: loc.isCustom ? "#b45309" : "#64748b",
                            }}
                          >
                            {loc.isCustom ? "Custom" : "Default"}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            fontFamily: "monospace",
                            color: "#64748b",
                          }}
                        >
                          X: {loc.coords.x}% · Y: {loc.coords.y}% · Seq: {loc.sequence ?? "-"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        onClick={() => {
                          onSelectDestination(loc);
                          onClose();
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "5px 10px",
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: isActive ? "#0284c7" : "#e0f2fe",
                          color: isActive ? "#ffffff" : "#0284c7",
                          fontSize: "11px",
                          fontWeight: "700",
                          cursor: "pointer",
                        }}
                      >
                        <Navigation size={12} />
                        <span>{isActive ? "Active" : "Move to"}</span>
                      </button>

                      {loc.isCustom && (
                        <button
                          onClick={() => onDeleteLocation(loc.id)}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: "#fee2e2",
                            color: "#ef4444",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                          title="Delete Location"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
