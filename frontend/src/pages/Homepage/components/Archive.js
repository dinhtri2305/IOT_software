import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import "./Archive.css";

const formatTime = (isoString) => {
  if (!isoString) return "N/A";
  try {
    const date = new Date(isoString);
    return date.toLocaleString("vi-VN", {
      hour12: false,
    });
  } catch (e) {
    return "N/A";
  }
};

const Archive = ({ authToken }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(
        "http://localhost:3000/api/sensor/history?limit=15",
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      if (res.data?.success) {
        setHistory(res.data.items || []);
      } else {
        setError("Không lấy được lịch sử dữ liệu");
      }
    } catch (err) {
      console.error("Error fetching history:", err);
      setError("Lỗi tải lịch sử dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) fetchHistory();
  }, [authToken, fetchHistory]);

  const rows = history.slice(0, 15);

  const renderTable = (title, accessor, unit) => (
    <div className="archive-section">
      <div className="archive-title">{title}</div>
      <div className="archive-table" role="table" aria-label={title}>
        <div className="archive-row archive-header" role="row">
          <div className="archive-cell" role="columnheader">
            THỜI GIAN
          </div>
          <div className="archive-cell" role="columnheader">
            GIÁ TRỊ
          </div>
        </div>
        {rows.map((item, idx) => (
          <div className="archive-row archive-body" role="row" key={idx}>
            <div className="archive-cell" role="cell">
              {formatTime(item.timestamp)}
            </div>
            <div className="archive-cell" role="cell">
              {item[accessor] !== undefined && item[accessor] !== null
                ? `${item[accessor]}${unit}`
                : "N/A"}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="archive-row archive-body" role="row">
            <div className="archive-cell" role="cell">
              —
            </div>
            <div className="archive-cell" role="cell">
              Không có dữ liệu
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return <div className="archive-loading">Đang tải dữ liệu...</div>;
  }

  if (error) {
    return <div className="archive-error">{error}</div>;
  }

  return (
    <div className="archive-container">
      <div className="archive-toolbar">
        <button className="archive-refresh" onClick={fetchHistory}>
          Làm mới dữ liệu
        </button>
      </div>
      <div className="archive-grid">
        {renderTable("LỊCH SỬ NHIỆT ĐỘ", "temperature", "°C")}
        {renderTable("LỊCH SỬ ĐỘ ẨM", "humidity", "%")}
        {renderTable("LỊCH SỬ NỒNG ĐỘ KHÍ", "gasLevel", "")}
      </div>
    </div>
  );
};

export default Archive;
