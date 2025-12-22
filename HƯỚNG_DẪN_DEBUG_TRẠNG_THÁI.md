# Hướng dẫn Debug Trạng thái Thiết bị

## 🔍 Vấn đề: Trạng thái không tự động cập nhật trên Settings

## ✅ Đã sửa

### 1. **Frontend - Đọc đúng format từ Backend**
- Backend trả về `relay`, `buzzer`, `led` là **string trực tiếp** (không phải object)
- Frontend đã được cập nhật để đọc đúng format

### 2. **Backend - Thêm logging chi tiết**
- Log tất cả MQTT messages nhận được
- Log topic và payload để debug
- Log khi cập nhật trạng thái thiết bị

## 🧪 Cách kiểm tra

### Bước 1: Kiểm tra Backend nhận được message từ ESP

Mở terminal Backend và xem logs:

```bash
cd backend
npm start
```

Bạn sẽ thấy:
```
📨 MQTT Message received on topic: "fire/device/status"
📋 Expected topics: { sensor: '...', status: '...', control: '...' }
📦 Parsed payload: { deviceId: 'ESP32_001', relay: 'on', ... }
✅ Processing device status from topic: fire/device/status
✅ Device ESP32_001 status updated: { 'relay.status': 'on', ... }
```

**Nếu KHÔNG thấy logs này:**
- ESP chưa gửi message
- Topic không khớp
- MQTT chưa kết nối

### Bước 2: Kiểm tra ESP gửi message

Mở Serial Monitor trên Wokwi, bạn sẽ thấy:
```
Sent device status: {"deviceId":"ESP32_001","relay":"on","buzzer":"off","led":"on",...}
```

**Nếu KHÔNG thấy:**
- ESP chưa chạy code mới
- MQTT chưa kết nối
- Topic không đúng

### Bước 3: Kiểm tra Topic MQTT

Đảm bảo file `.env` trong `backend/` có:

```env
MQTT_BROKER=broker.hivemq.com
MQTT_PORT=1883
MQTT_TOPIC_SENSOR=fire/sensor/data
MQTT_TOPIC_CONTROL=fire/device/control
MQTT_TOPIC_STATUS=fire/device/status
```

**ESP code phải dùng đúng topics:**
```cpp
const char* topic_sensor  = "fire/sensor/data";
const char* topic_control = "fire/device/control";
const char* topic_status  = "fire/device/status";
```

### Bước 4: Kiểm tra Frontend

Mở Browser Console (F12), bạn sẽ thấy:
```javascript
Device status: { ledStatus: 'on', buzzerStatus: 'off', relayStatus: 'on', device: {...} }
```

**Nếu thấy `undefined` hoặc `null`:**
- Backend chưa có dữ liệu trong DB
- API trả về sai format

## 🔧 Các vấn đề thường gặp

### Vấn đề 1: Backend không nhận được message từ ESP

**Nguyên nhân:**
- Topic không khớp
- MQTT chưa kết nối
- ESP chưa gửi

**Giải pháp:**
1. Kiểm tra logs Backend có thấy "MQTT Connected!" không
2. Kiểm tra Serial Monitor ESP có thấy "MQTT Connected!" không
3. So sánh topic trong ESP code và .env file

### Vấn đề 2: Backend nhận được nhưng không cập nhật DB

**Nguyên nhân:**
- Format payload không đúng
- Device chưa tồn tại trong DB

**Giải pháp:**
1. Xem logs Backend: `📦 Parsed payload: {...}`
2. Đảm bảo payload có `deviceId`, `relay`, `buzzer`, `led`
3. Kiểm tra MongoDB có device với `deviceId: "ESP32_001"` không

### Vấn đề 3: Frontend không hiển thị trạng thái

**Nguyên nhân:**
- API trả về sai format
- Frontend đọc sai field

**Giải pháp:**
1. Mở Browser Console xem logs
2. Kiểm tra Network tab: Response từ `/api/device/status`
3. Đảm bảo response có format:
   ```json
   {
     "success": true,
     "devices": [{
       "deviceId": "ESP32_001",
       "relay": "on",
       "buzzer": "off",
       "led": "on"
     }]
   }
   ```

## 📝 Checklist Debug

- [ ] Backend đã khởi động và MQTT đã kết nối
- [ ] ESP đã upload code mới và đang chạy
- [ ] Serial Monitor ESP hiển thị "Sent device status: ..."
- [ ] Backend logs hiển thị "📨 MQTT Message received on topic: fire/device/status"
- [ ] Backend logs hiển thị "✅ Device ESP32_001 status updated"
- [ ] Browser Console hiển thị "Device status: { ... }"
- [ ] Network tab hiển thị response từ `/api/device/status` có đúng format
- [ ] Settings page hiển thị trạng thái đúng

## 🚀 Test Flow

1. **Bật LED từ Settings:**
   - Click toggle LED trên Frontend
   - Kiểm tra Serial Monitor ESP: "MQTT control: ..."
   - Kiểm tra ESP có bật LED không
   - Đợi 3 giây, kiểm tra Settings có cập nhật không

2. **ESP tự động gửi trạng thái:**
   - ESP gửi mỗi 10 giây
   - Kiểm tra Backend logs
   - Kiểm tra Settings có cập nhật sau 10 giây không

3. **Refresh Settings:**
   - Settings tự động refresh mỗi 3 giây
   - Kiểm tra trạng thái có cập nhật không

## 💡 Tips

1. **Luôn kiểm tra logs Backend trước** - Nó sẽ cho biết có nhận được message không
2. **Kiểm tra Serial Monitor ESP** - Xem ESP có gửi message không
3. **Kiểm tra Browser Console** - Xem Frontend có đọc đúng không
4. **Kiểm tra Network tab** - Xem API response có đúng format không

