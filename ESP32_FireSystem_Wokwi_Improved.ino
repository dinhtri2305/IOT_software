#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "DHT.h"
#include <ArduinoJson.h>

/* ================== CẤU HÌNH LINH KIỆN ================== */
#define DHTPIN 4
#define DHTTYPE DHT22

#define MQ2_PIN 34
#define LDR_PIN 35

#define BUZZER_PIN 27
#define RELAY_PIN 26
#define LED_ALERT_PIN 25
#define LED_LIGHT_PIN 33 // LED chiếu sáng tự động

// MQ2 CHIA ÁP
#define Rt 33000.0
#define Rb 47000.0
#define VREF 3.3

// NGƯỠNG
#define FIRE_SMOKE_VOUT 3.4
#define FIRE_TEMP 60.0
#define LDR_DARK_THRESHOLD 2000 // < là tối

// WIFI & MQTT
const char *ssid = "Wokwi-GUEST";
const char *password = "";

String lcd_display = "";
const char *mqtt_broker = "broker.hivemq.com";
const int mqtt_port = 1883;

const char *mqtt_client_id = "ESP32_FireSystem_Wokwi";
const char *topic_sensor = "fire/sensor/data";
const char *topic_control = "fire/device/control";
const char *topic_status = "fire/device/status"; // Gửi trạng thái về backend
const char *topic_lcd = "fire/device/lcd";       // Nội dung LCD được hiện thị

WiFiClient espClient;
PubSubClient client(espClient);
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);

// Trạng thái
bool relayState = false;
bool buzzerState = false;
bool alertLedState = false;
bool emergencyMode = false;  // Chế độ khẩn cấp (tự động khi phát hiện cháy)
bool manualOverride = false; // Cho phép điều khiển thủ công ngay cả khi cháy

unsigned long lastStatusSend = 0;
const unsigned long STATUS_INTERVAL = 10000; // Gửi trạng thái mỗi 10 giây
unsigned long lastSensorSend = 0;
const unsigned long SENSOR_INTERVAL = 60000; // Gửi dữ liệu cảm biến mỗi 60 giây

// MQTT CALLBACK
void callback(char *topic, byte *payload, unsigned int length)
{
  String msg;
  for (int i = 0; i < length; i++)
    msg += (char)payload[i];

  Serial.println("MQTT control: " + msg);

  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, msg))
  {
    Serial.println("Failed to parse JSON");
    return;
  }

  // Kiểm tra deviceId (nếu có)
  if (doc.containsKey("deviceId"))
  {
    String receivedDeviceId = doc["deviceId"].as<String>();
    if (receivedDeviceId != "ESP32_001")
    {
      Serial.println("Device ID mismatch, ignoring");
      return;
    }
  }

  // Xử lý lệnh emergency stop
  if (doc.containsKey("emergency") && doc["emergency"] == true)
  {
    emergencyMode = false;  // Tắt chế độ khẩn cấp
    manualOverride = false; // Reset manual override
    relayState = false;
    buzzerState = false;
    alertLedState = false;
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_ALERT_PIN, LOW);
    Serial.println("Emergency stop - All devices OFF, auto mode restored");
    sendDeviceStatus(); // Gửi trạng thái ngay
    return;
  }

  // Xử lý lệnh điều khiển từ web, cho phép manual override
  bool hasControlCommand = doc.containsKey("relay") || doc.containsKey("buzzer") || doc.containsKey("led");

  if (hasControlCommand)
  {
    // Bất kỳ lệnh điều khiển nào cũng kích hoạt manual override
    manualOverride = true;

    if (doc.containsKey("relay"))
    {
      String relayCmd = doc["relay"].as<String>();
      relayState = (relayCmd == "on");
      digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
      Serial.println("Manual control - Relay: " + relayCmd);
    }

    if (doc.containsKey("buzzer"))
    {
      String buzzerCmd = doc["buzzer"].as<String>();
      buzzerState = (buzzerCmd == "on");
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
      Serial.println("Manual control - Buzzer: " + buzzerCmd);
    }

    if (doc.containsKey("led"))
    {
      String ledCmd = doc["led"].as<String>();
      if (ledCmd == "on")
      {
        alertLedState = true;
        digitalWrite(LED_ALERT_PIN, HIGH);
      }
      else if (ledCmd == "off")
      {
        alertLedState = false;
        digitalWrite(LED_ALERT_PIN, LOW);
      }
      else if (ledCmd == "blink")
      {
        alertLedState = true;
      }
      Serial.println("Manual control - LED: " + ledCmd);
    }

    if (emergencyMode)
    {
      Serial.println("Manual override active - User control priority over fire detection");
    }

    // Gửi trạng thái về backend sau khi nhận lệnh
    sendDeviceStatus();
  }

  // Nếu payload có trường lcdMessage thì hiển thị lên LCD
  if (doc.containsKey("lcdMessage"))
  {
    String lcdMsg = doc["lcdMessage"].as<String>();
    Serial.println("LCD message: " + lcdMsg);

    lcd_display = lcdMsg;
  }
}

/* ================== MQTT CONNECT ================== */
void connectMQTT()
{
  while (!client.connected())
  {
    Serial.print("Connecting MQTT...");
    if (client.connect(mqtt_client_id))
    {
      Serial.println("OK");
      client.subscribe(topic_control);
      client.subscribe(topic_lcd);
      Serial.println("Subscribed to: " + String(topic_control));

      // Gửi trạng thái ban đầu khi kết nối
      sendDeviceStatus();
    }
    else
    {
      Serial.print("FAILED, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 3 seconds");
      delay(3000);
    }
  }
}

// GỬI DỮ LIỆU CẢM BIẾN
void sendSensorData(float temp, float hum, float gasV,
                    int ldrValue, bool fire)
{

  DynamicJsonDocument doc(512);

  doc["deviceId"] = "ESP32_001";
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["gasVoltage"] = gasV; // Backend hỗ trợ cả gasVoltage và gasLevel
  doc["gasLevel"] = gasV;
  doc["ldrValue"] = ldrValue;
  doc["lightLed"] = digitalRead(LED_LIGHT_PIN) ? "on" : "off";
  doc["fireDetected"] = fire;
  doc["timestamp"] = millis();

  String payload;
  serializeJson(doc, payload);

  if (client.publish(topic_sensor, payload.c_str()))
  {
    Serial.println("Sent sensor data: " + payload);
  }
  else
  {
    Serial.println("Failed to publish sensor data");
  }
}

/* ================== GỬI TRẠNG THÁI THIẾT BỊ ================== */
void sendDeviceStatus()
{
  DynamicJsonDocument doc(256);

  doc["deviceId"] = "ESP32_001";
  doc["relay"] = relayState ? "on" : "off";
  doc["buzzer"] = buzzerState ? "on" : "off";
  doc["led"] = alertLedState ? "on" : "off";
  doc["emergencyMode"] = emergencyMode;
  doc["manualOverride"] = manualOverride;
  doc["timestamp"] = millis();

  String payload;
  serializeJson(doc, payload);

  if (client.publish(topic_status, payload.c_str()))
  {
    Serial.println("Sent device status: " + payload);
  }
  else
  {
    Serial.println("Failed to publish device status");
  }

  lastStatusSend = millis();
}

/* ================== SETUP ================== */
void setup()
{
  Serial.begin(115200);
  delay(1000);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_ALERT_PIN, OUTPUT);
  pinMode(LED_LIGHT_PIN, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_ALERT_PIN, LOW);
  digitalWrite(LED_LIGHT_PIN, LOW);

  lcd.init();
  lcd.backlight();
  dht.begin();

  Serial.println("Connecting to WiFi: " + String(ssid));
  WiFi.begin(ssid, password);
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");

  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20)
  {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    Serial.println("\nWiFi Connected!");
    Serial.println("IP: " + WiFi.localIP().toString());
  }
  else
  {
    lcd.clear();
    lcd.print("WiFi Failed!");
    Serial.println("\nWiFi Connection Failed!");
  }

  delay(2000);

  client.setServer(mqtt_broker, mqtt_port);
  client.setCallback(callback);
  connectMQTT();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Ready");
}

/* ================== LOOP ================== */
void loop()
{
  // Duy trì kết nối MQTT
  if (!client.connected())
  {
    connectMQTT();
  }
  client.loop();

  // ĐỌC CẢM BIẾN
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  if (isnan(temperature))
    temperature = 0;
  if (isnan(humidity))
    humidity = 0;

  int gasADC = analogRead(MQ2_PIN);
  float gasV = gasADC * (VREF / 4095.0) * ((Rt + Rb) / Rb);

  int ldrValue = analogRead(LDR_PIN);
  bool isDark = ldrValue < LDR_DARK_THRESHOLD;

  bool fireByTemp = temperature > FIRE_TEMP;
  bool fireByGas = gasV > FIRE_SMOKE_VOUT;
  bool fireDetected = fireByTemp || fireByGas;

  // ĐÈN CHIẾU SÁNG AUTO
  digitalWrite(LED_LIGHT_PIN, isDark ? HIGH : LOW);

  // XỬ LÝ CHÁY
  if (fireDetected)
  {
    if (!emergencyMode)
    {
      // Phát hiện cháy MỚI → reset manual override, quay về chế độ tự động
      emergencyMode = true;
      manualOverride = false;
      Serial.println("FIRE DETECTED - EMERGENCY MODE ACTIVATED (Auto control)");
    }

    // Nếu KHÔNG có manual override → tự động bật tất cả
    if (!manualOverride)
    {
      relayState = true;
      buzzerState = true;
      alertLedState = true;
      digitalWrite(BUZZER_PIN, HIGH);
      digitalWrite(RELAY_PIN, HIGH);
      digitalWrite(LED_ALERT_PIN, HIGH);
    }
    else
    {
      // Có manual override → giữ nguyên trạng thái người dùng đã chọn
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
      digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
      digitalWrite(LED_ALERT_PIN, alertLedState ? HIGH : LOW);
    }
  }
  else
  {
    // Hết cháy → tắt chế độ khẩn cấp
    if (emergencyMode)
    {
      emergencyMode = false;
      Serial.println("Fire cleared - Emergency mode deactivated");

      // Nếu KHÔNG có manual override → tự động tắt hết
      if (!manualOverride)
      {
        relayState = false;
        buzzerState = false;
        alertLedState = false;
        Serial.println("All devices turned OFF automatically");
      }
      else
      {
        Serial.println("Manual override active - keeping user settings");
      }
    }

    // Áp dụng trạng thái hiện tại
    digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
    digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
    digitalWrite(LED_ALERT_PIN, alertLedState ? HIGH : LOW);
  }

  // GỬI DỮ LIỆU CẢM BIẾN MQTT
  if (millis() - lastSensorSend >= SENSOR_INTERVAL)
  {
    sendSensorData(
        temperature,
        humidity,
        gasV,
        ldrValue,
        fireDetected);
    lastSensorSend = millis();
  }

  // GỬI TRẠNG THÁI THIẾT BỊ ĐỊNH KỲ
  if (millis() - lastStatusSend > STATUS_INTERVAL)
  {
    sendDeviceStatus();
  }

  // ================= LCD DISPLAY =================
  lcd.clear();

  if (fireDetected)
  {
    lcd.setCursor(0, 0);

    if (fireByTemp && fireByGas)
    {
      lcd.print("CHAY: N+G");
      lcd.setCursor(0, 1);
      lcd.print("T=");
      lcd.print(temperature, 0);
      lcd.print(" G=");
      lcd.print(gasV, 1);
    }
    else if (fireByTemp)
    {
      lcd.print("CHAY: NHIET");
      lcd.setCursor(0, 1);
      lcd.print("T=");
      lcd.print(temperature, 1);
      lcd.print("C");
    }
    else if (fireByGas)
    {
      lcd.print("CHAY: GAS");
      lcd.setCursor(0, 1);
      lcd.print("G=");
      lcd.print(gasV, 1);
      lcd.print("V");
    }
  }
  else
  {
    if (lcd_display.length() > 0)
    {
      int commaIndex = lcd_display.indexOf(',');

      String line1 = lcd_display.substring(0, commaIndex);
      String line2 = lcd_display.substring(commaIndex + 2);

      lcd.setCursor(0, 0);
      lcd.print(line1);

      lcd.setCursor(0, 1);
      lcd.print(line2);

      // Reset lại
      lcd_display = "";

      delay(4000);
      return;
    }

    lcd.setCursor(0, 0);
    lcd.print("T:");
    lcd.print(temperature, 1);
    lcd.print("C H:");
    lcd.print(humidity, 0);
    lcd.print("%");

    lcd.setCursor(0, 1);
    lcd.print("Den:");
    lcd.print(isDark ? "BAT " : "TAT ");
    lcd.print("G:");
    lcd.print(gasV, 1);
  }

  delay(3000);
}