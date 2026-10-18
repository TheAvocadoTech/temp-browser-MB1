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
  X,
  Search,
  Compass,
} from "lucide-react";

export default function SelectDestinationModal({
  isOpen,
  onClose,
  destinations = [],
  activeDestination,
  onSelectDestination,
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
      (d.description &&
        d.description.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          maxHeight: "90%",
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
            padding: "18px 20px 14px 20px",
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
                Common Areas
              </h3>
              <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                Select your destination
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
        <div style={{ padding: "10px 20px 8px 20px" }}>
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
              placeholder="Search destination..."
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
                  border: isSelected
                    ? "2px solid #0284c7"
                    : "1px solid #e2e8f0",
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
                {/* Left side: Icon & Info */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
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
                    }}
                  >
                    {getDestinationIcon(dest.icon)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
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
                      {dest.description || dest.fullName}
                    </span>
                  </div>
                </div>

                {/* Right side: Active / Select Badge */}
                <div style={{ flexShrink: 0, marginLeft: "10px" }}>
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
