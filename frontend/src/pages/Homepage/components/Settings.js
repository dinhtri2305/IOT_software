import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Settings.css";

const DEVICE_ID = "ESP32_001";

const Settings = ({ authToken }) => {
  const [ledOn, setLedOn] = useState(false);
  const [buzzerOn, setBuzzerOn] = useState(false);
  const [relayOn, setRelayOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mqttConnected, setMqttConnected] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!authToken) return;
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/device/status", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.data?.success) {
          const device = res.data.devices?.[0];
          setMqttConnected(!!res.data.mqttConnected);
          setLedOn(device?.led?.status === "on");
          setBuzzerOn(device?.buzzer?.status === "on");
          setRelayOn(device?.relay?.status === "on");
          setError("");
        } else {
          setError("Không lấy được trạng thái thiết bị");
        }
      } catch (err) {
        console.error("Fetch status error", err);
        setError("Không lấy được trạng thái thiết bị");
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [authToken]);

  const sendCommand = async (path, nextStateSetter, revertValue, payload) => {
    try {
      setSending(true);
      setError("");
      await axios.post(`http://localhost:3000/api/device/${path}`, payload, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      nextStateSetter(payload.action === "on");
    } catch (err) {
      console.error("Send command error", err);
      nextStateSetter(revertValue);
      setError("Gửi lệnh thất bại. Kiểm tra kết nối MQTT.");
    } finally {
      setSending(false);
    }
  };

  const handleToggle = (type) => {
    if (sending) return;
    if (type === "led") {
      const next = !ledOn;
      setLedOn(next);
      sendCommand("control/led", setLedOn, !next, {
        action: next ? "on" : "off",
        deviceId: DEVICE_ID,
      });
    } else if (type === "buzzer") {
      const next = !buzzerOn;
      setBuzzerOn(next);
      sendCommand("control/buzzer", setBuzzerOn, !next, {
        action: next ? "on" : "off",
        deviceId: DEVICE_ID,
      });
    } else if (type === "relay") {
      const next = !relayOn;
      setRelayOn(next);
      sendCommand("control/relay", setRelayOn, !next, {
        action: next ? "on" : "off",
        deviceId: DEVICE_ID,
      });
    }
  };

  const renderRow = (label, state, onToggle) => (
    <div className="setting-row">
      <div className="setting-info">
        <div className="setting-title">
          <span>{label}</span>
        </div>
      </div>
      <label className={`switch ${sending ? "switch-disabled" : ""}`}>
        <input
          type="checkbox"
          checked={state}
          onChange={onToggle}
          disabled={sending}
        />
        <span className="slider" />
      </label>
    </div>
  );

  if (loading) {
    return <div className="settings-loading">Đang tải trạng thái...</div>;
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <div>
          <div className="settings-title">CÀI ĐẶT THIẾT BỊ</div>
          <div className="settings-subtitle">
            Điều khiển thiết bị Wokwi theo thời gian thực
          </div>
        </div>
        <div className={`mqtt-status ${mqttConnected ? "ok" : "fail"}`}>
          <span className="dot" />
          MQTT {mqttConnected ? "Connected" : "Disconnected"}
        </div>
      </div>

      {error && <div className="settings-error">{error}</div>}

      <div className="settings-card">
        {renderRow("BẬT ĐÈN LED", ledOn, () => handleToggle("led"))}
        {renderRow("BẬT CÒI BÁO ĐỘNG", buzzerOn, () => handleToggle("buzzer"))}
        {renderRow("BẬT VÒI NƯỚC", relayOn, () => handleToggle("relay"))}
      </div>
    </div>
  );
};

export default Settings;
