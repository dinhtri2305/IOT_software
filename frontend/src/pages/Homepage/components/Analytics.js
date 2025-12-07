import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
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

      // Fetch temperature-humidity correlation (last 5 data points)
      const tempHumidResponse = await axios.get(
        "http://localhost:3000/api/analytics/temp-humidity-correlation?hours=32",
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (tempHumidResponse.data.success) {
        const dataPoints = tempHumidResponse.data.dataPoints || [];
        const last5 = dataPoints.slice(-5);
        setTempHumidityData(
          last5.map((d, idx) => ({
            time: `${idx + 1}h`,
            temperature: Math.round(d.temperature * 10) / 10,
            humidity: Math.round(d.humidity * 10) / 10,
          }))
        );
      }

      // Fetch temperature and humidity predictions
      const predictionResponse = await axios.get(
        "http://localhost:3000/api/analytics/predict-next-day",
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
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={tempHumidityData}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="time" stroke="#666" />
                  <YAxis yAxisId="left" stroke="#ff7a00" />
                  <YAxis yAxisId="right" orientation="right" stroke="#4a90e2" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperature"
                    stroke="#ff7a00"
                    name="Nhiệt độ (°C)"
                    strokeWidth={2.5}
                    dot={{ fill: "#ff7a00", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="humidity"
                    stroke="#4a90e2"
                    name="Độ ẩm (%)"
                    strokeWidth={2.5}
                    dot={{ fill: "#4a90e2", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
