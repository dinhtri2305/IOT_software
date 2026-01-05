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
      const interval = setInterval(fetchSensorData, 60 * 1000);
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

  const getTemperatureIcon = (temp) => {
    if (temp === null || temp === undefined) return "sun.png";
    const t = Number(temp);

    if (t <= 0) return "snowflake.png";
    if (t <= 20) return "cold.png";
    if (t <= 30) return "rainbow.png";
    if (t <= 37) return "hot.png";
    return "fire.png";
  };

  const getHumidityScale = (humidity) => {
    if (humidity === null || humidity === undefined) return 1;
    const h = Number(humidity);
    if (h < 20) return 0.2;
    if (h < 40) return 0.4;
    if (h < 60) return 0.6;
    if (h < 80) return 0.8;
    return 1;
  };

  const getGasScale = (gas) => {
    if (gas === null || gas === undefined) return 1;
    const g = Number(gas);
    if (g < 4.975) return 0.5;
    if (g < 5.16) return 0.7;
    if (g < 5.266) return 0.9;
    if (g < 5.37) return 1;
    return 1.5;
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
                : Number(value).toFixed(1);

            const iconStyle =
              dataKey === "humidity"
                ? { transform: `scale(${getHumidityScale(value)})` }
                : {};

            return (
              <div className="metric-column" key={`${dataKey}-${idx}`}>
                <div className="metric-column__time">
                  {formatTimeShort(entry?.timestamp)}
                </div>
                <div className="metric-column__icon">
                  <img
                    src={`/assets/${iconName}`}
                    alt={title}
                    style={iconStyle}
                  />
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
                : Number(value).toFixed(1);

            const iconStyle =
              dataKey === "gasLevel"
                ? { transform: `scale(${getGasScale(value)})` }
                : {};

            return (
              <div className="metric-row-vert" key={`${dataKey}-${idx}`}>
                <div className="metric-row-vert__time">
                  {formatTimeShort(entry?.timestamp)}
                </div>
                <div className="metric-row-vert__icon">
                  <img
                    src={`/assets/${iconName}`}
                    alt={title}
                    style={iconStyle}
                  />
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
          {renderHorizontalTable(
            "NHIỆT ĐỘ TRONG NGÀY (°C)",
            "temperature",
            [...Array(5)]
              .map((_, i) => getTemperatureIcon(recentData[i]?.temperature))
              .reverse()
          )}

          {renderHorizontalTable("ĐỘ ẨM TRONG NGÀY (%)", "humidity", [
            "drop.png",
            "drop.png",
            "drop.png",
            "drop.png",
            "drop.png",
          ])}
        </div>

        <div className="overview-right">
          {renderVerticalTable("NỒNG ĐỘ KHÍ GAS TRONG NGÀY (PPM)", "gasLevel", [
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
