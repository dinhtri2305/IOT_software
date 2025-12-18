const SensorData = require("../models/sensor.model");

// Simple Linear Regression Implementation
class LinearRegression {
  constructor() {
    this.slope = 0;
    this.intercept = 0;
  }

  fit(X, y) {
    const n = X.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += X[i];
      sumY += y[i];
      sumXY += X[i] * y[i];
      sumX2 += X[i] * X[i];
    }

    // Calculate slope and intercept
    const denominator = n * sumX2 - sumX * sumX;

    // Handle edge cases (no variation in X or only 1 data point)
    if (denominator === 0 || n <= 1) {
      this.slope = 0;
      this.intercept = sumY / n; // Use mean of y values
    } else {
      this.slope = (n * sumXY - sumX * sumY) / denominator;
      this.intercept = (sumY - this.slope * sumX) / n;
    }

    return this;
  }

  predict(x) {
    return this.slope * x + this.intercept;
  }

  predictMultiple(X) {
    return X.map((x) => this.predict(x));
  }
}

// Get temperature vs humidity correlation
exports.getTempHumidityCorrelation = async (req, res) => {
  try {
    // Prefer explicit limit (latest N records). Fallback to hours window.
    const limit = parseInt(req.query.limit, 10);
    const hours = parseInt(req.query.hours, 10) || 32; // Default 32 hours
    let data = [];

    if (!Number.isNaN(limit) && limit > 0) {
      // Get latest {limit} records, then reverse to chronological order
      data = await SensorData.find({})
        .select("temperature humidity timestamp")
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
      data = data.reverse();
    } else {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      data = await SensorData.find({
        timestamp: { $gte: startTime },
      })
        .select("temperature humidity timestamp")
        .sort({ timestamp: 1 })
        .lean();
    }

    // Calculate correlation coefficient
    const n = data.length;
    if (n < 2) {
      return res.json({
        success: true,
        correlation: 0,
        dataPoints: [],
        summary: {
          avgTemperature: 0,
          avgHumidity: 0,
          totalRecords: 0,
        },
      });
    }

    const temps = data.map((d) => d.temperature);
    const humids = data.map((d) => d.humidity);

    const avgTemp = temps.reduce((a, b) => a + b, 0) / n;
    const avgHumid = humids.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomTemp = 0;
    let denomHumid = 0;

    for (let i = 0; i < n; i++) {
      const diffTemp = temps[i] - avgTemp;
      const diffHumid = humids[i] - avgHumid;
      numerator += diffTemp * diffHumid;
      denomTemp += diffTemp * diffTemp;
      denomHumid += diffHumid * diffHumid;
    }

    const correlation = numerator / Math.sqrt(denomTemp * denomHumid);

    res.json({
      success: true,
      correlation: Math.round(correlation * 1000) / 1000,
      dataPoints: data.map((d) => ({
        temperature: d.temperature,
        humidity: d.humidity,
        timestamp: d.timestamp,
      })),
      summary: {
        avgTemperature: Math.round(avgTemp * 10) / 10,
        avgHumidity: Math.round(avgHumid * 10) / 10,
        totalRecords: n,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error calculating correlation",
      error: error.message,
    });
  }
};

// Get gas level distribution
exports.getGasDistribution = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 32; // 32 hours
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const distribution = await SensorData.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      {
        $bucket: {
          groupBy: "$gasLevel",
          boundaries: [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4095],
          default: "3500+",
          output: {
            count: { $sum: 1 },
            avgTemperature: { $avg: "$temperature" },
            fireCount: { $sum: { $cond: ["$fireDetected", 1, 0] } },
          },
        },
      },
    ]);

    // Get hourly gas levels
    const hourlyData = await SensorData.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d %H:00",
              date: "$timestamp",
            },
          },
          avgGas: { $avg: "$gasLevel" },
          maxGas: { $max: "$gasLevel" },
          minGas: { $min: "$gasLevel" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      distribution: distribution.map((bucket) => ({
        range: `${bucket._id}-${bucket._id + 500}`,
        count: bucket.count,
        avgTemperature: Math.round(bucket.avgTemperature * 10) / 10,
        fireCount: bucket.fireCount,
      })),
      hourlyTrend: hourlyData.map((d) => ({
        time: d._id,
        average: Math.round(d.avgGas),
        max: d.maxGas,
        min: d.minGas,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error calculating gas distribution",
      error: error.message,
    });
  }
};

// Predict temperature and humidity for next day using Linear Regression
exports.predictNextDay = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7; // Use last 7 days for training
    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get hourly average data
    let data = await SensorData.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d %H:00",
              date: "$timestamp",
            },
          },
          avgTemp: { $avg: "$temperature" },
          avgHumid: { $avg: "$humidity" },
          avgGas: { $avg: "$gasLevel" },
          timestamp: { $first: "$timestamp" },
        },
      },
      { $sort: { timestamp: 1 } },
    ]);

    // Fallback: if hourly aggregation has no data, use latest 10 raw points
    if (data.length < 1) {
      const fallback = await SensorData.find({})
        .select("temperature humidity timestamp")
        .sort({ timestamp: -1 })
        .limit(10)
        .lean();

      if (fallback.length < 1) {
        return res.json({
          success: true,
          predictions: [],
          trainingHours: 0,
          message: "Not enough data for prediction (need at least 1 data point)",
        });
      }

      // Map raw points into the same shape as aggregated data
      data = fallback
        .reverse()
        .map((d, idx) => ({
          _id: `raw-${idx}`,
          avgTemp: d.temperature,
          avgHumid: d.humidity,
          timestamp: d.timestamp,
        }));
    }

    // Prepare data for linear regression
    const X = data.map((_, index) => index); // Time index
    const yTemp = data.map((d) => d.avgTemp);
    const yHumid = data.map((d) => d.avgHumid);

    // Train models
    const tempModel = new LinearRegression();
    const humidModel = new LinearRegression();

    tempModel.fit(X, yTemp);
    humidModel.fit(X, yHumid);

    // Predict next 24 hours
    const predictions = [];
    const currentHour = data.length;
    const lastTimestamp = new Date(data[data.length - 1].timestamp);

    for (let i = 0; i < 24; i++) {
      const nextIndex = currentHour + i;
      let predictedTemp = tempModel.predict(nextIndex);
      let predictedHumid = humidModel.predict(nextIndex);

      // Handle case where all data is the same (no variation)
      // If slope is 0 or very close to 0, use the last known value
      if (Math.abs(tempModel.slope) < 0.0001) {
        predictedTemp = yTemp[yTemp.length - 1];
      }
      if (Math.abs(humidModel.slope) < 0.0001) {
        predictedHumid = yHumid[yHumid.length - 1];
      }

      const nextTimestamp = new Date(
        lastTimestamp.getTime() + (i + 1) * 60 * 60 * 1000
      );

      predictions.push({
        hour: i + 1,
        timestamp: nextTimestamp.toISOString(),
        predictedTemperature: Math.round(predictedTemp * 10) / 10,
        predictedHumidity: Math.round(predictedHumid * 10) / 10,
      });
    }

    // Calculate model accuracy (R²)
    const calculateR2 = (actual, predicted) => {
      const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
      const ssTotal = actual.reduce(
        (sum, val) => sum + Math.pow(val - mean, 2),
        0
      );
      const ssRes = actual.reduce(
        (sum, val, i) => sum + Math.pow(val - predicted[i], 2),
        0
      );
      return 1 - ssRes / ssTotal;
    };

    const tempPredicted = tempModel.predictMultiple(X);
    const humidPredicted = humidModel.predictMultiple(X);

    const tempR2 = calculateR2(yTemp, tempPredicted);
    const humidR2 = calculateR2(yHumid, humidPredicted);

    res.json({
      success: true,
      predictions: predictions,
      modelAccuracy: {
        temperatureR2: Math.round(tempR2 * 1000) / 1000,
        humidityR2: Math.round(humidR2 * 1000) / 1000,
      },
      trainingData: {
        records: data.length,
        period: `Last ${days} days`,
        startDate: data[0].timestamp,
        endDate: data[data.length - 1].timestamp,
      },
      modelParameters: {
        temperature: {
          slope: Math.round(tempModel.slope * 1000) / 1000,
          intercept: Math.round(tempModel.intercept * 100) / 100,
        },
        humidity: {
          slope: Math.round(humidModel.slope * 1000) / 1000,
          intercept: Math.round(humidModel.intercept * 100) / 100,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error predicting next day values",
      error: error.message,
    });
  }
};

// Get 7-day summary for dashboard
exports.getWeeklySummary = async (req, res) => {
  try {
    const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const dailyStats = await SensorData.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$timestamp",
            },
          },
          avgTemp: { $avg: "$temperature" },
          maxTemp: { $max: "$temperature" },
          minTemp: { $min: "$temperature" },
          avgHumid: { $avg: "$humidity" },
          avgGas: { $avg: "$gasLevel" },
          maxGas: { $max: "$gasLevel" },
          fireAlerts: { $sum: { $cond: ["$fireDetected", 1, 0] } },
          totalRecords: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      period: "Last 7 days",
      dailyData: dailyStats.map((day) => ({
        date: day._id,
        temperature: {
          average: Math.round(day.avgTemp * 10) / 10,
          max: Math.round(day.maxTemp * 10) / 10,
          min: Math.round(day.minTemp * 10) / 10,
        },
        humidity: Math.round(day.avgHumid * 10) / 10,
        gasLevel: {
          average: Math.round(day.avgGas),
          max: day.maxGas,
        },
        fireAlerts: day.fireAlerts,
        totalRecords: day.totalRecords,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching weekly summary",
      error: error.message,
    });
  }
};

// Get fire risk analysis
exports.getFireRiskAnalysis = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const riskData = await SensorData.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      {
        $project: {
          timestamp: 1,
          temperature: 1,
          humidity: 1,
          gasLevel: 1,
          fireDetected: 1,
          riskScore: {
            $add: [
              { $cond: [{ $gt: ["$temperature", 40] }, 30, 0] },
              { $cond: [{ $gt: ["$temperature", 50] }, 40, 0] },
              { $cond: [{ $lt: ["$humidity", 30] }, 20, 0] },
              { $cond: [{ $gt: ["$gasLevel", 1000] }, 30, 0] },
              { $cond: [{ $gt: ["$gasLevel", 2000] }, 50, 0] },
            ],
          },
        },
      },
      { $sort: { timestamp: -1 } },
      { $limit: 100 },
    ]);

    // Calculate average risk score
    const avgRisk =
      riskData.reduce((sum, d) => sum + d.riskScore, 0) / riskData.length;

    // Determine risk level
    let riskLevel = "LOW";
    if (avgRisk > 50) riskLevel = "HIGH";
    else if (avgRisk > 30) riskLevel = "MEDIUM";

    res.json({
      success: true,
      currentRiskLevel: riskLevel,
      averageRiskScore: Math.round(avgRisk),
      recentData: riskData.slice(0, 10).map((d) => ({
        timestamp: d.timestamp,
        temperature: d.temperature,
        humidity: d.humidity,
        gasLevel: d.gasLevel,
        riskScore: d.riskScore,
        fireDetected: d.fireDetected,
      })),
      recommendations: getRiskRecommendations(avgRisk),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error analyzing fire risk",
      error: error.message,
    });
  }
};

// Helper function for risk recommendations
function getRiskRecommendations(riskScore) {
  if (riskScore > 50) {
    return [
      "CRITICAL: Immediate action required",
      "Check for fire sources",
      "Ensure fire extinguishers are accessible",
      "Consider evacuation if necessary",
    ];
  } else if (riskScore > 30) {
    return [
      "WARNING: Elevated fire risk",
      "Monitor temperature and gas levels closely",
      "Ensure ventilation is adequate",
      "Be prepared for emergency response",
    ];
  } else {
    return [
      "Normal conditions",
      "Continue regular monitoring",
      "Maintain safety equipment",
    ];
  }
}
