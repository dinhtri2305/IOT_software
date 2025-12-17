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
#define LED_LIGHT_PIN 33 // 💡 LED chiếu sáng tự động

/* ================== MQ2 CHIA ÁP ================== */
#define Rt 33000.0
#define Rb 47000.0
#define VREF 3.3

/* ================== NGƯỠNG ================== */
#define FIRE_SMOKE_VOUT 3.4
#define FIRE_TEMP 60.0
#define LDR_DARK_THRESHOLD 2000 // < ngưỡng này là tối

/* ================== WIFI & MQTT ================== */
const char *ssid = "Wokwi-GUEST";
const char *password = "";

const char *mqtt_broker = "broker.hivemq.com";
const int mqtt_port = 1883;

const char *mqtt_client_id = "ESP32_FireSystem_Wokwi";
const char *topic_sensor = "fire/sensor/data";
const char *topic_control = "fire/device/control";

/* ================== OBJECT ================== */
WiFiClient espClient;
PubSubClient client(espClient);
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);

/* ================== TRẠNG THÁI ================== */
bool relayState = false;
bool buzzerState = false;
bool alertLedState = false;

/* ================== MQTT CALLBACK ================== */
void callback(char *topic, byte *payload, unsigned int length)
{
    String msg;
    for (int i = 0; i < length; i++)
        msg += (char)payload[i];

    Serial.println("MQTT control: " + msg);

    JsonDocument doc;
    if (deserializeJson(doc, msg))
        return;

    if (doc["relay"].is<const char *>())
    {
        relayState = (String(doc["relay"].as<const char *>()) == "on");
        digitalWrite(RELAY_PIN, relayState);
    }

    if (doc["buzzer"].is<const char *>())
    {
        buzzerState = (String(doc["buzzer"].as<const char *>()) == "on");
        digitalWrite(BUZZER_PIN, buzzerState);
    }

    if (doc["led"].is<const char *>())
    {
        alertLedState = (String(doc["led"].as<const char *>()) == "on");
        digitalWrite(LED_ALERT_PIN, alertLedState);
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
        }
        else
        {
            Serial.println("FAILED");
            delay(3000);
        }
    }
}

/* ================== GỬI DỮ LIỆU ================== */
void sendSensorData(float temp, float hum, float gasV,
                    int ldrValue, bool fire)
{

    JsonDocument doc;

    doc["deviceId"] = "ESP32_001";
    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["gasVoltage"] = gasV;
    doc["ldrValue"] = ldrValue;
    doc["lightLed"] = digitalRead(LED_LIGHT_PIN) ? "on" : "off";
    doc["fireDetected"] = fire;
    doc["timestamp"] = millis();

    String payload;
    serializeJson(doc, payload);
    client.publish(topic_sensor, payload.c_str());

    Serial.println("Sent: " + payload);
}

/* ================== SETUP ================== */
void setup()
{
    Serial.begin(115200);

    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(LED_ALERT_PIN, OUTPUT);
    pinMode(LED_LIGHT_PIN, OUTPUT);

    lcd.init();
    lcd.backlight();
    dht.begin();

    WiFi.begin(ssid, password);
    lcd.print("Connecting WiFi");
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
    }

    lcd.clear();
    lcd.print("WiFi Connected");

    client.setServer(mqtt_broker, mqtt_port);
    client.setCallback(callback);
    connectMQTT();
}

/* ================== LOOP ================== */
void loop()
{
    if (!client.connected())
        connectMQTT();
    client.loop();

    /* ====== ĐỌC CẢM BIẾN ====== */
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

    bool fireDetected = (gasV > FIRE_SMOKE_VOUT || temperature > FIRE_TEMP);

    /* ====== ĐÈN CHIẾU SÁNG AUTO ====== */
    digitalWrite(LED_LIGHT_PIN, isDark ? HIGH : LOW);

    /* ====== XỬ LÝ CHÁY ====== */
    if (fireDetected)
    {
        digitalWrite(BUZZER_PIN, HIGH);
        digitalWrite(RELAY_PIN, HIGH);
        digitalWrite(LED_ALERT_PIN, HIGH);
    }
    else
    {
        digitalWrite(BUZZER_PIN, buzzerState);
        digitalWrite(RELAY_PIN, relayState);
        digitalWrite(LED_ALERT_PIN, alertLedState);
    }

    /* ====== GỬI MQTT ====== */
    sendSensorData(
        temperature,
        humidity,
        gasV,
        ldrValue,
        fireDetected);

    /* ====== LCD ====== */
    lcd.clear();
    if (fireDetected)
    {
        lcd.setCursor(0, 0);
        lcd.print("CANH BAO CHAY");
        lcd.setCursor(0, 1);
        lcd.print("Gas:");
        lcd.print(gasV, 1);
        lcd.print("V");
    }
    else
    {
        lcd.setCursor(0, 0);
        lcd.print("T:");
        lcd.print(temperature, 1);
        lcd.print("C H:");
        lcd.print(humidity, 0);
        lcd.print("%");

        lcd.setCursor(0, 1);
        lcd.print("Den:");
        lcd.print(isDark ? "BAT " : "TAT ");
        lcd.print("Gas:");
        lcd.print(gasV, 1);
    }

    delay(3000);
}
