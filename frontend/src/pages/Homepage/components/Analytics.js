import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
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

      // Fetch temperature-humidity correlation (10 newest points)
      const tempHumidResponse = await axios.get(
        "http://localhost:3000/api/analytics/temp-humidity-correlation?limit=10",
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (tempHumidResponse.data.success) {
        const dataPoints = tempHumidResponse.data.dataPoints || [];
        setTempHumidityData(
          dataPoints.map((d, idx) => ({
            id: idx + 1,
            humidity: Math.round(d.humidity * 10) / 10,
            temperature: Math.round(d.temperature * 10) / 10,
            label:
              d.timestamp &&
              new Date(d.timestamp).toLocaleString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              }),
          }))
        );
      }

      // Fetch temperature and humidity predictions
      const predictionResponse = await axios.get(
        "http://localhost:3000/api/analytics/predict-next-day?days=3",
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (predictionResponse.data.success) {
        const predictions = predictionResponse.data.predictions || [];
        setPredictedTemp(
          predictions.slice(0, 1).map((p) => ({
            hour: `${p.hour}h`,
            value: Math.round(p.predictedTemperature * 10) / 10,
          }))
        );
        setPredictedHumidity(
          predictions.slice(0, 1).map((p) => ({
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

      <div className="analytics-layout">
        {/* Left side - Charts 1, 3, 4 */}
        <div className="analytics-left">
          {/* Chart 1 - Temperature vs Humidity (B1) */}
          <div className="analytics-section">
            <div className="analytics-chart-title">
              BIỂU ĐỒ PHÂN BỐ NHIỆT ĐỘ THEO ĐỘ ẨM
            </div>
            <div className="analytics-chart-box temp-humidity-chart">
              {tempHumidityData.length === 0 ? (
                <div className="analytics-empty">Chưa có dữ liệu</div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart
                    margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="humidity"
                      name="Độ ẩm (%)"
                      type="number"
                      stroke="#4a90e2"
                      domain={["dataMin - 5", "dataMax + 5"]}
                    />
                    <YAxis
                      dataKey="temperature"
                      name="Nhiệt độ (°C)"
                      type="number"
                      stroke="#ff7a00"
                      domain={["dataMin - 5", "dataMax + 5"]}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      formatter={(value, name) =>
                        name === "temperature"
                          ? [`${value}°C`, "Nhiệt độ"]
                          : [`${value}%`, "Độ ẩm"]
                      }
                      labelFormatter={(label, payload) => {
                        const point = payload && payload[0] && payload[0].payload;
                        return point?.label
                          ? `Thời gian: ${point.label}`
                          : "Điểm đo";
                      }}
                    />
                    <Legend />
                    <Scatter
                      name="Điểm đo"
                      data={tempHumidityData}
                      fill="#ff7a00"
                      shape="circle"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Charts 3 and 4 - Predictions */}
          <div className="analytics-predictions">
            {/* Chart 3 - Temperature Prediction (B3) */}
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
                  {predictedTemp.length > 0
                    ? `${predictedTemp[0].value}`
                    : "N/A"}
                </div>
              </div>
            </div>

            {/* Chart 4 - Humidity Prediction (B4) */}
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

        {/* Right side - Gas Distribution Chart (B2) */}
        <div className="analytics-right">
          <div className="analytics-section">
            <div className="analytics-chart-title">
              BIỂU ĐỒ PHÂN BỐ NỒNG ĐỘ CÁC LOẠI CHẤT KHÍ
            </div>
            <div className="analytics-chart-box gas-distribution">
              <div className="gas-chart-container">
                <img
                  src="/assets/pie-chart.png"
                  alt="Biểu đồ phân bố chất khí"
                  className="gas-chart-image"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
