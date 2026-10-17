// src/components/SelectDestinationModal.js
import React, { useState } from "react";
import {
  Navigation,
  Server,
  Bath,
  Key,
  Truck,
  Shield,
  MapPin,
  CheckCircle,
  Trash2,
  RotateCcw,
  X,
  Search,
  Compass,
} from "lucide-react";

export default function SelectDestinationModal({
  isOpen,
  onClose,
  destinations,
  activeDestination,
  selectedKeyCabinetColo = "colo1",
  onSelectCabinetColo,
  onSelectDestination,
  onDeleteDestination,
  onResetDefaults,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  // Render appropriate category icon
  const getDestinationIcon = (iconName) => {
    switch (iconName) {
      case "server":
        return <Server size={22} color="#0284c7" />;
      case "bath":
        return <Bath size={22} color="#0891b2" />;
      case "key":
        return <Key size={22} color="#f59e0b" />;
      case "truck":
        return <Truck size={22} color="#10b981" />;
      case "shield":
        return <Shield size={22} color="#6366f1" />;
      default:
        return <MapPin size={22} color="#6366f1" />;
    }
  };

  const getIconBackground = (iconName) => {
    switch (iconName) {
      case "server":
        return "#e0f2fe";
      case "bath":
        return "#cffafe";
      case "key":
        return "#fef3c7";
      case "truck":
        return "#d1fae5";
      case "shield":
        return "#ede9fe";
      default:
        return "#e0e7ff";
    }
  };

  const filteredDestinations = destinations.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
        boxSizing: "border-box",
        animation: "fadeIn 0.25s ease-out forwards",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          maxHeight: "92%",
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
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 22px 14px 22px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                backgroundColor: "#e0f2fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Compass size={22} color="#0284c7" />
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
                Where to Move?
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Select a destination to generate route
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
              transition: "all 0.15s ease",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: "12px 20px 8px 20px" }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              backgroundColor: "#f8fafc",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              padding: "8px 12px",
            }}
          >
            <Search size={16} color="#94a3b8" style={{ marginRight: "8px" }} />
            <input
              type="text"
              placeholder="Search Key cabinet, Washroom, NOC, Loading area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "13px",
                width: "100%",
                color: "#0f172a",
              }}
            />
          </div>
        </div>

        {/* Destination Cards List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 20px 16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {filteredDestinations.map((dest) => {
            const isSelected = activeDestination?.id === dest.id;

            return (
              <div
                key={dest.id}
                onClick={() => {
                  onSelectDestination(dest);
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: "16px",
                  backgroundColor: isSelected ? "#f0f9ff" : "#ffffff",
                  border: isSelected ? "2px solid #0284c7" : "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  boxShadow: isSelected
                    ? "0 4px 14px rgba(2, 132, 199, 0.14)"
                    : "0 1px 3px rgba(0,0,0,0.03)",
                }}
                onMouseOver={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      backgroundColor: getIconBackground(dest.icon),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {getDestinationIcon(dest.icon)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: "800",
                          color: "#0f172a",
                        }}
                      >
                        {dest.name}
                      </span>
                      {dest.category && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "2px 6px",
                            borderRadius: "6px",
                            backgroundColor: "#f1f5f9",
                            color: "#475569",
                            textTransform: "uppercase",
                          }}
                        >
                          {dest.category}
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        display: "block",
                        marginTop: "2px",
                      }}
                    >
                      {dest.description || `Coords: (${dest.coords.x}%, ${dest.coords.y}%)`}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "#94a3b8",
                        display: "block",
                        marginTop: "2px",
                        fontFamily: "monospace",
                      }}
                    >
                      X: {dest.coords.x}% · Y: {dest.coords.y}%
                    </span>

                    {/* Key Cabinet Colo Dropdown (Colo 1, 2, 3) */}
                    {dest.category === "Cabinet" && (
                      <div
                        style={{
                          marginTop: "8px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: "#b45309",
                            }}
                          >
                            Colo:
                          </span>
                          <select
                            id="modal-keycabinet-colo-dropdown"
                            value={selectedKeyCabinetColo}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (onSelectCabinetColo) {
                                onSelectCabinetColo(e.target.value);
                              }
                            }}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "8px",
                              border: "1.5px solid #f59e0b",
                              backgroundColor: "#fffbeb",
                              fontSize: "12px",
                              fontWeight: "700",
                              color: "#92400e",
                              cursor: "pointer",
                              outline: "none",
                            }}
                          >
                            <option value="colo1">Colo 1 (Row 5-6)</option>
                            <option value="colo2">Colo 2 (Server Hall)</option>
                            <option value="colo3">Colo 3 (Server Hall)</option>
                          </select>
                        </div>

                        {/* Quick Colo selection pills */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          {[
                            { key: "colo1", label: "Colo 1" },
                            { key: "colo2", label: "Colo 2" },
                            { key: "colo3", label: "Colo 3" },
                          ].map((c) => {
                            const isColoActive = selectedKeyCabinetColo === c.key;
                            return (
                              <button
                                key={c.key}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onSelectCabinetColo) {
                                    onSelectCabinetColo(c.key);
                                  }
                                }}
                                style={{
                                  border: isColoActive
                                    ? "1.5px solid #f59e0b"
                                    : "1px solid #cbd5e1",
                                  backgroundColor: isColoActive
                                    ? "#fef3c7"
                                    : "#ffffff",
                                  color: isColoActive ? "#92400e" : "#64748b",
                                  borderRadius: "6px",
                                  padding: "2px 7px",
                                  fontSize: "10.5px",
                                  fontWeight: isColoActive ? "800" : "600",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  {isSelected ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        backgroundColor: "#0284c7",
                        color: "#ffffff",
                        padding: "6px 12px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: "700",
                      }}
                    >
                      <CheckCircle size={14} />
                      <span>Active</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        color: "#0284c7",
                        fontSize: "12px",
                        fontWeight: "700",
                        padding: "6px 10px",
                        borderRadius: "10px",
                        backgroundColor: "#f0f9ff",
                      }}
                    >
                      <Navigation size={13} />
                      <span>Select</span>
                    </div>
                  )}

                  {onDeleteDestination && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `Are you sure you want to delete "${dest.name}"?`
                          )
                        ) {
                          onDeleteDestination(dest.id);
                        }
                      }}
                      title={`Delete ${dest.name}`}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "10px",
                        border: "1px solid #fee2e2",
                        backgroundColor: "#fff1f2",
                        color: "#e11d48",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "#ffe4e6";
                        e.currentTarget.style.borderColor = "#fca5a5";
                        e.currentTarget.style.color = "#be123c";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "#fff1f2";
                        e.currentTarget.style.borderColor = "#fee2e2";
                        e.currentTarget.style.color = "#e11d48";
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredDestinations.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "36px 16px",
                color: "#64748b",
                fontSize: "13px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {searchTerm ? (
                <span>No location found matching "{searchTerm}"</span>
              ) : (
                <>
                  <span>No locations available.</span>
                  {onResetDefaults && (
                    <button
                      type="button"
                      onClick={onResetDefaults}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        borderRadius: "10px",
                        backgroundColor: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        color: "#334155",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Restore Default Locations</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer: Info & Reset */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #f1f5f9",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
            {destinations.length} location{destinations.length === 1 ? "" : "s"} available
          </span>
          {onResetDefaults && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Restore default predefined locations?")) {
                  onResetDefaults();
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 11px",
                borderRadius: "8px",
                backgroundColor: "#ffffff",
                color: "#64748b",
                border: "1px solid #cbd5e1",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#f1f5f9";
                e.currentTarget.style.color = "#0f172a";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.color = "#64748b";
              }}
              title="Reset locations to factory defaults"
            >
              <RotateCcw size={12} />
              <span>Reset Defaults</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
