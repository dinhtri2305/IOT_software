# Cấu hình MQTT Topics

## Topics được sử dụng trong hệ thống

### ESP32 (Wokwi)
- **Publish Sensor Data**: `fire/sensor/data`
- **Subscribe Control**: `fire/device/control`
- **Publish Device Status**: `fire/device/status`

### Backend (Node.js)
Cần cấu hình trong file `.env`:

```env
MQTT_BROKER=broker.hivemq.com
MQTT_PORT=1883
MQTT_TOPIC_SENSOR=fire/sensor/data
MQTT_TOPIC_CONTROL=fire/device/control
MQTT_TOPIC_STATUS=fire/device/status
```

## Luồng dữ liệu

### Luồng 1: Input → ESP → MQTT → Backend → Frontend
1. ESP đọc cảm biến (DHT22, MQ2, LDR)
2. ESP publish lên `fire/sensor/data`
3. Backend subscribe và lưu vào MongoDB
4. Frontend lấy dữ liệu qua REST API

### Luồng 2: Frontend → Backend → MQTT → ESP → Output
1. Frontend gửi lệnh điều khiển qua REST API
2. Backend publish lên `fire/device/control`
3. ESP subscribe và điều khiển thiết bị (Relay, Buzzer, LED)
4. ESP publish trạng thái lên `fire/device/status`
5. Backend cập nhật trạng thái vào MongoDB
6. Frontend hiển thị trạng thái từ MongoDB

## Format dữ liệu

### Sensor Data (ESP → Backend)
```json
{
  "deviceId": "ESP32_001",
  "temperature": 25.5,
  "humidity": 60.0,
  "gasVoltage": 2.5,
  "gasLevel": 2.5,
  "ldrValue": 1500,
  "lightLed": "on",
  "fireDetected": false,
  "timestamp": 1234567890
}
```

### Control Command (Backend → ESP)
```json
{
  "deviceId": "ESP32_001",
  "relay": "on",
  "buzzer": "off",
  "led": "on",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Device Status (ESP → Backend)
```json
{
  "deviceId": "ESP32_001",
  "relay": "on",
  "buzzer": "off",
  "led": "on",
  "emergencyMode": false,
  "timestamp": 1234567890
}
```

