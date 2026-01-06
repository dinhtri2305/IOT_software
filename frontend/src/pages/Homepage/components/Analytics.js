import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ResponsiveContainer,
} from "recharts";
import "./Analytics.css";

const Analytics = ({ authToken }) => {
  const [tempHumidityData, setTempHumidityData] = useState([]);
  const [regressionLine, setRegressionLine] = useState([]);
  const [outliers, setOutliers] = useState([]);
  const [regressionStats, setRegressionStats] = useState(null);
  const [predictedTemp, setPredictedTemp] = useState([]);
  const [predictedHumidity, setPredictedHumidity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [domainConfig, setDomainConfig] = useState({ x: [0, 100], y: [0, 50] });
  const [totalDataPoints, setTotalDataPoints] = useState(0); // Tổng số điểm dữ liệu gốc

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
        const totalRawPoints = dataPoints.length; // Lưu tổng số điểm gốc
        setTotalDataPoints(totalRawPoints); // Lưu vào state
        const filteredData = dataPoints
          .filter(
            (d) =>
              d.humidity != null &&
              d.temperature != null &&
              !isNaN(d.humidity) &&
              !isNaN(d.temperature) &&
              d.humidity >= 0 &&
              d.temperature >= 0
          )
          .map((d) => ({
            humidity: Number(Math.round(d.humidity * 10) / 10),
            temperature: Number(Math.round(d.temperature * 10) / 10),
            timestamp: d.timestamp,
          }));

        // Count frequency of each (temperature, humidity) pair
        const frequencyMap = {};
        filteredData.forEach((d) => {
          const key = `${d.temperature},${d.humidity}`;
          frequencyMap[key] = (frequencyMap[key] || 0) + 1;
        });

        // Map to unique points with size based on frequency
        const formattedData = Object.keys(frequencyMap).map((key, idx) => {
          const [temp, hum] = key.split(",").map(Number);
          const count = frequencyMap[key];
          return {
            id: idx + 1,
            humidity: hum,
            temperature: temp,
            size: Math.min(400, 80 + Math.sqrt(count) * 60), // size based on frequency
            count: count,
            label: `xuất hiện ${count}x`,
            isOutlier: false, // will be calculated after regression
          };
        });

        // ==================== TÍNH TOÁN HỒISTÍ HỒI QUY ====================
        // X = humidity (độ ẩm), Y = temperature (nhiệt độ)
        if (formattedData.length >= 2) {
          const n = formattedData.length;
          let sumX = 0,
            sumY = 0,
            sumXY = 0,
            sumX2 = 0;

          formattedData.forEach((d) => {
            sumX += d.humidity;
            sumY += d.temperature;
            sumXY += d.humidity * d.temperature;
            sumX2 += d.humidity * d.humidity;
          });

          const denominator = n * sumX2 - sumX * sumX;
          let slope = 0,
            intercept = 0;

          if (denominator !== 0) {
            slope = (n * sumXY - sumX * sumY) / denominator;
            intercept = (sumY - slope * sumX) / n;
          } else {
            intercept = sumY / n; // không có biến thiên
          }

          // Tính residual để xác định outlier
          const residuals = formattedData.map((d) => {
            const predicted = slope * d.humidity + intercept;
            const residual = d.temperature - predicted;
            return residual;
          });

          const meanResidual = residuals.reduce((a, b) => a + b, 0) / n;
          const stdResidual = Math.sqrt(
            residuals.reduce(
              (sum, r) => sum + Math.pow(r - meanResidual, 2),
              0
            ) / n
          );

          // Outlier: |residual| > 2*stdResidual
          const threshold = 2 * stdResidual;
          const outlierPoints = [];

          formattedData.forEach((d, i) => {
            const residual = residuals[i];
            if (Math.abs(residual) > threshold) {
              d.isOutlier = true;
              outlierPoints.push({
                humidity: d.humidity,
                temperature: d.temperature,
                residual: residual.toFixed(2),
                deviation: (Math.abs(residual) / stdResidual).toFixed(1) + "σ",
                count: d.count,
              });
            }
          });

          // Tạo đường hồi quy để vẽ - tạo nhiều điểm để vẽ đường mượt
          const minHumid = Math.min(...formattedData.map((d) => d.humidity));
          const maxHumid = Math.max(...formattedData.map((d) => d.humidity));
          // Tạo 50 điểm để vẽ đường mượt
          const regressionPoints = [];
          for (let i = 0; i <= 50; i++) {
            const h = minHumid + (maxHumid - minHumid) * (i / 50);
            const t = slope * h + intercept;
            regressionPoints.push({ humidity: h, temperature: t });
          }

          // Tính R²
          const yMean = sumY / n;
          const ssTotal = formattedData.reduce(
            (sum, d) => sum + Math.pow(d.temperature - yMean, 2),
            0
          );
          const ssRes = residuals.reduce((sum, r) => sum + Math.pow(r, 2), 0);
          const r2 = 1 - ssRes / ssTotal;

          console.log("Regression stats:", {
            slope,
            intercept,
            r2,
            stdResidual,
            outlierCount: outlierPoints.length,
          });

          setRegressionLine(regressionPoints);
          setOutliers(outlierPoints);

          // Tính tổng số điểm bất thường từ tổng số điểm gốc
          // Mỗi outlier point có thể đại diện cho nhiều điểm gốc (dựa trên count)
          const totalOutlierCount = outlierPoints.reduce(
            (sum, o) => sum + o.count,
            0
          );

          setRegressionStats({
            slope: slope.toFixed(3),
            intercept: intercept.toFixed(2),
            r2: r2.toFixed(3),
            stdResidual: stdResidual.toFixed(2),
            outlierCount: totalOutlierCount, // Số điểm bất thường từ tổng điểm gốc
          });
        }

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

      // Fetch temperature and humidity predictions using latest 200 points
      const predictionResponse = await axios.get(
        "http://localhost:3000/api/analytics/predict-next-day?limit=200",
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
                    <ComposedChart
                      margin={{ top: 20, right: 20, left: 20, bottom: 40 }}
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
                      <Legend wrapperStyle={{ paddingTop: "20px" }} />
                      {/* Điểm bình thường */}
                      <Scatter
                        name="Điểm bình thường"
                        data={tempHumidityData.filter((d) => !d.isOutlier)}
                        fill="#4CAF50"
                        shape="circle"
                        line={false}
                      />
                      {/* Điểm bất thường */}
                      {tempHumidityData.some((d) => d.isOutlier) && (
                        <Scatter
                          name="Điểm bất thường (Outlier)"
                          data={tempHumidityData.filter((d) => d.isOutlier)}
                          fill="#FF5252"
                          shape="diamond"
                          line={false}
                        />
                      )}
                      {/* Đường hồi quy - sử dụng Line component */}
                      {regressionLine.length > 1 && (
                        <Line
                          type="linear"
                          dataKey="temperature"
                          data={regressionLine}
                          stroke="#2196F3"
                          strokeWidth={3}
                          dot={false}
                          activeDot={false}
                          isAnimationActive={false}
                          name="Đường hồi quy"
                          connectNulls={true}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            {/* Thông tin thống kê hồi quy */}
            {regressionStats && (
              <div className="regression-stats">
                <div className="stats-title">
                  📊 Phân tích Hồi quy tuyến tính:
                </div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Phương trình:</span>
                    <span className="stat-value">
                      T = {regressionStats.slope} × H +{" "}
                      {regressionStats.intercept}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">R² (Độ phù hợp):</span>
                    <span
                      className="stat-value"
                      style={{
                        color: regressionStats.r2 > 0.7 ? "#4CAF50" : "#FF9800",
                      }}
                    >
                      {regressionStats.r2}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">
                      Độ lệch chuẩn (residual):
                    </span>
                    <span className="stat-value">
                      ±{regressionStats.stdResidual}°C
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Số điểm bất thường:</span>
                    <span
                      className="stat-value"
                      style={{
                        color:
                          regressionStats.outlierCount > 0
                            ? "#FF5252"
                            : "#4CAF50",
                      }}
                    >
                      {regressionStats.outlierCount}/{totalDataPoints}
                    </span>
                  </div>
                </div>
                {outliers.length > 0 && (
                  <div className="outliers-list">
                    <div className="outliers-title">
                      ⚠️ Các điểm bất thường phát hiện:
                    </div>
                    <div className="outliers-items">
                      {outliers.map((o, i) => (
                        <div key={i} className="outlier-item">
                          <span>
                            T={o.temperature}°C, H={o.humidity}% (xuất hiện{" "}
                            {o.count}x)
                          </span>
                          <span className="outlier-detail">
                            Sai lệch: {o.deviation}, residual={o.residual}°C
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
