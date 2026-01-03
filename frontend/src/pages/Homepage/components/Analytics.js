import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./Analytics.css";

const Analytics = ({ authToken }) => {
  const [tempHumidityData, setTempHumidityData] = useState([]);
  const [predictedTemp, setPredictedTemp] = useState([]);
  const [predictedHumidity, setPredictedHumidity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [domainConfig, setDomainConfig] = useState({ x: [0, 100], y: [0, 50] });

  useEffect(() => {
    fetchAnalyticsData();
  }, [authToken]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError("");
      setTempHumidityData([]);
      setPredictedTemp([]);
      setPredictedHumidity([]);

      // Fetch temperature-humidity correlation (30 newest points)
      const tempHumidResponse = await axios.get(
        "http://localhost:3000/api/analytics/temp-humidity-correlation?limit=30",
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (tempHumidResponse.data.success) {
        const dataPoints = tempHumidResponse.data.dataPoints || [];
        const formattedData = dataPoints
          .filter(
            (d) =>
              d.humidity != null &&
              d.temperature != null &&
              !isNaN(d.humidity) &&
              !isNaN(d.temperature) &&
              d.humidity >= 0 &&
              d.temperature >= 0
          )
          .map((d, idx) => ({
            id: idx + 1,
            humidity: Number(Math.round(d.humidity * 10) / 10),
            temperature: Number(Math.round(d.temperature * 10) / 10),
            size: Math.max(
              60,
              Math.min(400, (d.temperature || 0) + (d.humidity || 0))
            ),
            label:
              d.timestamp &&
              new Date(d.timestamp).toLocaleString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              }),
          }));

        console.log("Formatted scatter data:", formattedData);
        console.log("Data count:", formattedData.length);
        if (formattedData.length > 0) {
          const humids = formattedData.map((d) => d.humidity);
          const temps = formattedData.map((d) => d.temperature);
          const minHumid = Math.min(...humids);
          const maxHumid = Math.max(...humids);
          const minTemp = Math.min(...temps);
          const maxTemp = Math.max(...temps);

          console.log("Humidity range:", minHumid, "-", maxHumid);
          console.log("Temperature range:", minTemp, "-", maxTemp);

          // Calculate domain with padding (10% padding or minimum 5 units)
          const humidRange = maxHumid - minHumid;
          const tempRange = maxTemp - minTemp;

          // Handle case where all values are the same
          const xPadding =
            humidRange === 0 ? 10 : Math.max(humidRange * 0.1, 5);
          const yPadding = tempRange === 0 ? 10 : Math.max(tempRange * 0.1, 5);

          const xDomain = [
            Math.max(0, minHumid - xPadding),
            maxHumid + xPadding,
          ];
          const yDomain = [Math.max(0, minTemp - yPadding), maxTemp + yPadding];

          // Ensure domain values are valid numbers
          if (
            !isNaN(xDomain[0]) &&
            !isNaN(xDomain[1]) &&
            !isNaN(yDomain[0]) &&
            !isNaN(yDomain[1]) &&
            isFinite(xDomain[0]) &&
            isFinite(xDomain[1]) &&
            isFinite(yDomain[0]) &&
            isFinite(yDomain[1])
          ) {
            console.log("X Domain:", xDomain);
            console.log("Y Domain:", yDomain);
            // Set domain and data together
            setDomainConfig({ x: xDomain, y: yDomain });
            setTempHumidityData(formattedData);
          } else {
            console.warn("Invalid domain calculated, using defaults");
            setDomainConfig({ x: [0, 100], y: [0, 50] });
            setTempHumidityData(formattedData);
          }
        } else {
          setDomainConfig({ x: [0, 100], y: [0, 50] });
          setTempHumidityData(formattedData);
        }
      }

      // Fetch temperature and humidity predictions (using 200 data points for better accuracy)
      const predictionResponse = await axios.get(
        "http://localhost:3000/api/analytics/predict-next-day?days=3&limit=200",
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (predictionResponse.data.success) {
        const predictions = predictionResponse.data.predictions || [];
        setPredictedTemp(
          predictions.slice(0, 200).map((p) => ({
            hour: `${p.hour}h`,
            value: Math.round(p.predictedTemperature * 10) / 10,
          }))
        );
        setPredictedHumidity(
          predictions.slice(0, 200).map((p) => ({
            hour: `${p.hour}h`,
            value: Math.round(p.predictedHumidity * 10) / 10,
          }))
        );
      } else {
        setPredictedTemp([]);
        setPredictedHumidity([]);
      }
    } catch (err) {
      console.error("Error fetching analytics data:", err);
      setError("Lỗi khi tải dữ liệu phân tích");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="analytics-loading">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="analytics-container">
      {error && <div className="analytics-error">{error}</div>}

      <div className="analytics-layout" style={{ gap: 40 }}>
        {/* Left side - Scatter Chart */}
        <div className="analytics-left">
          <div className="analytics-section">
            <div className="analytics-chart-title">
              BIỂU ĐỒ PHÂN BỐ NHIỆT ĐỘ THEO ĐỘ ẨM
            </div>
            <div className="analytics-chart-box temp-humidity-chart">
              {tempHumidityData.length === 0 ? (
                <div className="analytics-empty">Chưa có dữ liệu</div>
              ) : (
                <div
                  style={{ width: "100%", height: "500px", minHeight: "500px" }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="humidity"
                        name="Độ ẩm"
                        unit="%"
                        type="number"
                        stroke="#4a90e2"
                        domain={domainConfig.x}
                        label={{
                          value: "Độ ẩm (%)",
                          position: "insideBottom",
                          offset: -5,
                        }}
                      />
                      <YAxis
                        dataKey="temperature"
                        name="Nhiệt độ"
                        unit="°C"
                        type="number"
                        stroke="#ff7a00"
                        domain={domainConfig.y}
                        label={{
                          value: "Nhiệt độ (°C)",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <ZAxis
                        dataKey="size"
                        range={[80, 400]}
                        name="Kích thước"
                        unit=""
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        formatter={(value, name) => {
                          if (name === "temperature") {
                            return [`${value}°C`, "Nhiệt độ"];
                          } else if (name === "humidity") {
                            return [`${value}%`, "Độ ẩm"];
                          } else if (name === "size") {
                            return [value, "Kích thước"];
                          }
                          return [value, name];
                        }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0] && payload[0].payload) {
                            const point = payload[0].payload;
                            return point.label
                              ? `Thời gian: ${point.label}`
                              : "Điểm đo";
                          }
                          return "Điểm đo";
                        }}
                      />
                      <Legend />
                      <Scatter
                        name="Điểm đo"
                        data={tempHumidityData}
                        fill="#ff7a00"
                        shape="circle"
                        line={false}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Predictions (Vertical) */}
        <div className="analytics-right" style={{ gap: 50 }}>
          {/* Chart 2 - Temperature Prediction */}
          <div className="analytics-section">
            <div className="analytics-chart-title">
              DỰ BÁO NHIỆT ĐỘ NGÀY MAI (ĐỘ C)
            </div>
            <div className="analytics-chart-box prediction-value">
              <img
                src="/assets/thermometer.png"
                alt="Thermometer"
                className="prediction-icon"
              />
              <div className="prediction-value-display">
                {predictedTemp.length > 0 ? `${predictedTemp[0].value}` : "N/A"}
              </div>
            </div>
          </div>

          {/* Chart 3 - Humidity Prediction */}
          <div className="analytics-section">
            <div className="analytics-chart-title">
              DỰ BÁO ĐỘ ẨM NGÀY MAI (%)
            </div>
            <div className="analytics-chart-box prediction-value">
              <img
                src="/assets/water.png"
                alt="Water"
                className="prediction-icon"
              />
              <div className="prediction-value-display">
                {predictedHumidity.length > 0
                  ? `${predictedHumidity[0].value}`
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
