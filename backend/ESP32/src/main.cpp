#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "DHT.h"

// ====== Cấu hình linh kiện ======
#define DHTPIN 4
#define DHTTYPE DHT22
#define MQ2_PIN 34
#define BUZZER_PIN 27
#define RELAY_PIN 26
#define LED_PIN 25

// ====== Cấu hình chia áp MQ2 ======
#define Rt 33000.0
#define Rb 47000.0
#define VREF 3.3

// ====== Ngưỡng cháy ======
#define FIRE_SMOKE_VOUT 3.4 // Ngưỡng khói
#define FIRE_TEMP 60.0      // Ngưỡng nhiệt độ cháy (°C)

LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);

void setup()
{
  Serial.begin(115200);
  lcd.init();
  lcd.backlight();

  pinMode(MQ2_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  dht.begin();

  lcd.setCursor(0, 0);
  lcd.print("AI Smart FireSys");
  lcd.setCursor(0, 1);
  lcd.print("Dang khoi dong...");
  delay(2000);
  lcd.clear();
}

void loop()
{
  // ====== Đọc cảm biến ======
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  int adcValue = analogRead(MQ2_PIN);
  float Vadc = adcValue * (VREF / 4095.0);
  float Vout = Vadc * ((Rt + Rb) / Rb);

  // ====== Debug Serial ======
  Serial.print("Temp: ");
  Serial.print(temperature);
  Serial.print(" | Hum: ");
  Serial.print(humidity);
  Serial.print(" | MQ2(Vout): ");
  Serial.print(Vout, 2);
  Serial.println("V");

  // ====== Kiểm tra cháy ======
  bool fireDetected = (Vout > FIRE_SMOKE_VOUT || temperature > FIRE_TEMP);

  if (fireDetected)
  {
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(RELAY_PIN, HIGH);
    digitalWrite(LED_PIN, HIGH);

    // 🔁 Hiển thị 3 pha cảnh báo để người xem dễ đọc
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("CANH BAO CHAY!");
    lcd.setCursor(0, 1);
    lcd.print("Kich hoat relay!");
    delay(1500);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Temp:");
    lcd.print(temperature, 1);
    lcd.print("C");
    lcd.setCursor(0, 1);
    lcd.print("Gas:");
    lcd.print(Vout, 1);
    lcd.print("V");
    delay(1500);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Dang phun nuoc...");
    lcd.setCursor(0, 1);
    lcd.print("Kiem tra an toan");
    delay(1500);
  }
  else
  {
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(LED_PIN, LOW);

    // 🌤 Hiển thị chế độ bình thường
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Nhiet: ");
    lcd.print(temperature, 1);
    lcd.print("C ");
    lcd.setCursor(0, 1);
    lcd.print("Do am: ");
    lcd.print(humidity, 0);
    lcd.print("% ");
    delay(2000);
  }
}
