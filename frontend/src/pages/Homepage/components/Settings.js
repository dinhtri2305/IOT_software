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
  const [lastCommandTime, setLastCommandTime] = useState(0); // Track khi vừa gửi lệnh

  useEffect(() => {
    const fetchStatus = async () => {
      if (!authToken) return;
      try {
        // Chỉ hiện loading lần đầu, không hiện khi refresh tự động
        if (loading) setLoading(true);
        const res = await axios.get("http://localhost:3000/api/device/status", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.data?.success) {
          const device = res.data.devices?.[0];
          setMqttConnected(!!res.data.mqttConnected);

          // Nếu chưa có device (chưa nhận status), giữ nguyên state hiện tại để tránh bị reset OFF
          if (!device) {
            setError("Chưa có trạng thái thiết bị (đang đợi ESP gửi lên)");
            return;
          }

          // Backend trả về relay/buzzer/led là string trực tiếp (từ getAllStatus)
          // Format: { relay: "on", buzzer: "off", led: "on" }
          console.log(
            "🔍 Raw device data from API:",
            JSON.stringify(device, null, 2)
          );

          const ledStatus = device.led || "off";
          const buzzerStatus = device.buzzer || "off";
          const relayStatus = device.relay || "off";

          console.log("🔍 Parsed status:", {
            ledStatus,
            buzzerStatus,
            relayStatus,
          });

          // Chỉ cập nhật state nếu không phải vừa gửi lệnh (tránh race condition)
          // Đợi 2 giây sau khi gửi lệnh mới cập nhật từ server
          const timeSinceLastCommand = Date.now() - lastCommandTime;
          if (timeSinceLastCommand > 2000 || lastCommandTime === 0) {
            setLedOn(ledStatus === "on" || ledStatus === "blink");
            setBuzzerOn(buzzerStatus === "on");
            setRelayOn(relayStatus === "on");

            console.log("Device status updated from server:", {
              ledStatus,
              buzzerStatus,
              relayStatus,
              device,
              timeSinceLastCommand,
            });
          } else {
            console.log("⏳ Skipping update (just sent command):", {
              timeSinceLastCommand,
              currentState: { ledOn, buzzerOn, relayOn },
            });
          }
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

    if (authToken) {
      fetchStatus();
      // Refresh trạng thái mỗi 60 giây để tránh quá tải
      const interval = setInterval(fetchStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [authToken]);

  const sendCommand = async (path, nextStateSetter, revertValue, payload) => {
    try {
      setSending(true);
      setError("");

      // Đánh dấu thời gian gửi lệnh để tránh bị override bởi fetchStatus
      setLastCommandTime(Date.now());

      const response = await axios.post(
        `http://localhost:3000/api/device/${path}`,
        payload,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      // Cập nhật state ngay lập tức khi gửi lệnh thành công
      const newState = payload.action === "on";
      nextStateSetter(newState);

      console.log("Command sent successfully:", {
        path,
        payload,
        response: response.data,
        newState,
      });

      // Đợi 1 giây rồi mới cho phép fetchStatus cập nhật lại từ server
      // Để đảm bảo DB đã được cập nhật
      setTimeout(() => {
        setLastCommandTime(Date.now() - 1000); // Cho phép fetchStatus cập nhật sau 1 giây
      }, 1000);
    } catch (err) {
      console.error("❌ Send command error", err);
      nextStateSetter(revertValue);
      setError("Gửi lệnh thất bại. Kiểm tra kết nối MQTT.");
      setLastCommandTime(0); // Reset để cho phép fetchStatus hoạt động bình thường
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
