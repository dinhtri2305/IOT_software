import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import "./Overview.css";

const Overview = ({ authToken }) => {
  const [recentData, setRecentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const lastDataTimeRef = useRef(0);
  const lastEmailSentRef = useRef(0);

  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          "http://localhost:3000/api/sensor/latest",
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (response.data?.success && Array.isArray(response.data.data)) {
          const list = response.data.data.slice(0, 5);

          const latestFire = list.find((item) => item.fireDetected);
          if (latestFire) {
            const fireTime = new Date(latestFire.timestamp).getTime();
            
            if (fireTime > lastDataTimeRef.current) {
              lastDataTimeRef.current = fireTime;

              const now = Date.now();
              const COOLDOWN = 15 * 60 * 1000;
              
              if (now - lastEmailSentRef.current > COOLDOWN) {
                  console.warn("✅ Email sent (Notification triggered)");
                  lastEmailSentRef.current = now;
              } else {
                  console.log("⚠️ Fire detected (Email cooldown active)");
              }
            }
          }

          setRecentData(list);
          setLastUpdate(list[0]?.timestamp || null);
          setError(null);
        } else {
          setError("Không có dữ liệu cảm biến");
          setRecentData([]);
        }
      } catch (err) {
        console.error("Error fetching sensor data:", err);
        setError("Không thể tải dữ liệu cảm biến");
      } finally {
        setLoading(false);
      }
    };

    if (authToken) {
      fetchSensorData();
      const interval = setInterval(fetchSensorData, 5000);
      return () => clearInterval(interval);
    }
  }, [authToken]);

  const latestEntry = useMemo(() => recentData[0], [recentData]);

  const formatTime = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatTimeShort = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getAlertLevel = () => {
    if (!latestEntry) return "UNKNOWN";
    if (latestEntry.fireDetected) return "CRITICAL";
    if (latestEntry.temperature > 50 || latestEntry.gasLevel > 2000)
      return "HIGH";
    if (
      latestEntry.temperature > 40 ||
      latestEntry.gasLevel > 1200 ||
      latestEntry.humidity < 25
    )
      return "WARNING";
    return "NORMAL";
  };

  const getAlertColor = () => {
    const level = getAlertLevel();
    switch (level) {
      case "CRITICAL":
        return "#ff4444";
      case "HIGH":
        return "#ff8c00";
      case "WARNING":
        return "#ffcc00";
      default:
        return "#4CAF50";
    }
  };

  const renderHorizontalTable = (title, dataKey, icons) => {
    // Reverse icons array so newest data appears on the right
    const reversedIcons = [...icons].reverse();
    return (
      <div
        className={`metric-table metric-table--horizontal metric-table--${dataKey}`}
      >
        <div className="metric-table__title">{title}</div>
        <div className="metric-table__columns">
          {reversedIcons.map((iconName, idx) => {
            const entry = recentData[idx];
            const value = entry?.[dataKey];
            const formattedValue =
              value === null || value === undefined
                ? "—"
                : dataKey === "gasLevel"
                ? Number(value).toFixed(0)
                : Number(value).toFixed(1);

            return (
              <div className="metric-column" key={`${dataKey}-${idx}`}>
                <div className="metric-column__time">
                  {formatTimeShort(entry?.timestamp)}
                </div>
                <div className="metric-column__icon">
                  <img src={`/assets/${iconName}`} alt={title} />
                </div>
                <div className="metric-column__value">{formattedValue}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderVerticalTable = (title, dataKey, icons) => {
    // Reverse icons array so newest data appears at the top
    const reversedIcons = [...icons].reverse();
    return (
      <div
        className={`metric-table metric-table--vertical metric-table--${dataKey}`}
      >
        <div className="metric-table__title">{title}</div>
        <div className="metric-table__rows">
          {reversedIcons.map((iconName, idx) => {
            const entry = recentData[idx];
            const value = entry?.[dataKey];
            const formattedValue =
              value === null || value === undefined
                ? "—"
                : dataKey === "gasLevel"
                ? Number(value).toFixed(0)
                : Number(value).toFixed(1);

            return (
              <div className="metric-row-vert" key={`${dataKey}-${idx}`}>
                <div className="metric-row-vert__time">
                  {formatTimeShort(entry?.timestamp)}
                </div>
                <div className="metric-row-vert__icon">
                  <img src={`/assets/${iconName}`} alt={title} />
                </div>
                <div className="metric-row-vert__value">{formattedValue}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="overview-container">
        <div className="loading-spinner">
          <p>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overview-container">
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overview-container">
      <div className="overview-layout">
        <div className="overview-left">
          {renderHorizontalTable("NHIỆT ĐỘ (°C)", "temperature", [
            "sun.png",
            "sun.png",
            "cloudy.png",
            "crescent-moon.png",
            "crescent-moon.png",
          ])}

          {renderHorizontalTable("ĐỘ ẨM (%)", "humidity", [
            "drop.png",
            "drop.png",
            "drop.png",
            "drop.png",
            "drop.png",
          ])}
        </div>

        <div className="overview-right">
          {renderVerticalTable("NỒNG ĐỘ KHÍ GAS (PPM)", "gasLevel", [
            "gas.png",
            "gas.png",
            "gas.png",
            "gas.png",
          ])}
        </div>
      </div>
    </div>
  );
};

export default Overview;
