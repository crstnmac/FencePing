/**
 * ESP32 Complete GPS Tracker
 * Real GPS module integration + MQTT/HTTP location sending
 * Supports: NEO-6M, NEO-8M, NEO-9M GPS modules
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <HardwareSerial.h>
#include <TinyGPS++.h>

// GPS Configuration
TinyGPSPlus gps;
HardwareSerial ss(1); // Use Serial1 for GPS

// GPIO Pins for GPS module
#define GPS_RX_PIN 4
#define GPS_TX_PIN 2
#define GPS_POWER_PIN 5  // Optional: control GPS power

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server configuration
const char* serverUrl = "http://192.168.1.100:3001";
const char* mqttServer = "192.168.1.100";
const char* deviceKey = "YOUR_DEVICE_KEY";

// Communication clients
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
HTTPClient httpClient;

// Tracking configuration
#define LOCATION_INTERVAL_MOVING 10000    // 10 seconds when moving
#define LOCATION_INTERVAL_STATIONARY 60000 // 1 minute when stationary
#define MIN_MOVEMENT_THRESHOLD 0.0001     // Minimum lat/lng change to detect movement
#define GPS_TIMEOUT 30000                 // 30 seconds to get GPS fix

// Location data
struct LocationData {
  double latitude = 0.0;
  double longitude = 0.0;
  float altitude = 0.0;
  float speed = 0.0;        // km/h
  float course = 0.0;       // degrees
  float hdop = 99.9;        // horizontal dilution of precision
  uint8_t satellites = 0;   // number of satellites
  bool valid = false;       // GPS fix valid
  unsigned long timestamp = 0;
  float battery = 100.0;
} currentLocation, lastLocation;

// State tracking
bool isMoving = false;
unsigned long lastLocationSend = 0;
unsigned long lastGPSFix = 0;

void setup() {
  Serial.begin(115200);
  
  // Initialize GPS
  initializeGPS();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup MQTT
  mqttClient.setServer(mqttServer, 1883);
  mqttClient.setCallback(mqttCallback);
  
  Serial.println("🚀 GPS Tracker initialized!");
  Serial.println("🛰️ Waiting for GPS fix...");
}

void loop() {
  // Read GPS data continuously
  readGPSData();
  
  // Handle MQTT connection
  if (!mqttClient.connected()) {
    connectToMQTT();
  }
  mqttClient.loop();
  
  // Send location updates based on movement
  handleLocationUpdates();
  
  // Update battery level (if monitoring)
  updateBatteryLevel();
  
  delay(1000);
}

void initializeGPS() {
  // Power on GPS module
  if (GPS_POWER_PIN > 0) {
    pinMode(GPS_POWER_PIN, OUTPUT);
    digitalWrite(GPS_POWER_PIN, HIGH);
    delay(1000);
  }
  
  // Start GPS serial communication
  ss.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  
  // Configure GPS module (optional)
  // Set update rate to 1Hz for power saving
  ss.println("$PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0*28"); // Output only RMC and GGA
  ss.println("$PMTK220,1000*1F"); // 1Hz update rate
}

bool readGPSData() {
  bool newData = false;
  
  // Read GPS data for up to 1 second
  for (unsigned long start = millis(); millis() - start < 1000;) {
    while (ss.available()) {
      char c = ss.read();
      if (gps.encode(c)) {
        newData = true;
      }
    }
  }
  
  if (newData && gps.location.isValid()) {
    // Update location data
    currentLocation.latitude = gps.location.lat();
    currentLocation.longitude = gps.location.lng();
    currentLocation.altitude = gps.altitude.meters();
    currentLocation.speed = gps.speed.kmph();
    currentLocation.course = gps.course.deg();
    currentLocation.hdop = gps.hdop.hdop();
    currentLocation.satellites = gps.satellites.value();
    currentLocation.valid = true;
    currentLocation.timestamp = millis();
    lastGPSFix = millis();
    
    // Check if device is moving
    checkMovementStatus();
    
    Serial.printf("📍 GPS: %.6f, %.6f | Alt: %.1fm | Speed: %.1fkm/h | Sats: %d | HDOP: %.1f\n",
      currentLocation.latitude, currentLocation.longitude, 
      currentLocation.altitude, currentLocation.speed,
      currentLocation.satellites, currentLocation.hdop);
    
    return true;
  } 
  else if (millis() - lastGPSFix > GPS_TIMEOUT) {
    currentLocation.valid = false;
    Serial.println("⚠️ GPS fix lost");
    return false;
  }
  
  return false;
}

void checkMovementStatus() {
  if (lastLocation.valid) {
    double latDiff = abs(currentLocation.latitude - lastLocation.latitude);
    double lngDiff = abs(currentLocation.longitude - lastLocation.longitude);
    
    bool wasMoving = isMoving;
    isMoving = (latDiff > MIN_MOVEMENT_THRESHOLD || 
               lngDiff > MIN_MOVEMENT_THRESHOLD ||
               currentLocation.speed > 1.0); // Moving if speed > 1 km/h
    
    if (isMoving != wasMoving) {
      Serial.println(isMoving ? "🚗 Started moving" : "🛑 Stopped moving");
    }
  }
  
  lastLocation = currentLocation;
}

void handleLocationUpdates() {
  if (!currentLocation.valid) return;
  
  unsigned long interval = isMoving ? LOCATION_INTERVAL_MOVING : LOCATION_INTERVAL_STATIONARY;
  
  if (millis() - lastLocationSend > interval) {
    // Try MQTT first, fallback to HTTP
    bool success = sendLocationViaMQTT();
    if (!success) {
      Serial.println("📡 MQTT failed, trying HTTP...");
      success = sendLocationViaHTTP();
    }
    
    if (success) {
      lastLocationSend = millis();
      Serial.println("✅ Location sent successfully");
    } else {
      Serial.println("❌ Failed to send location");
    }
  }
}

bool sendLocationViaMQTT() {
  if (!mqttClient.connected()) return false;
  
  DynamicJsonDocument doc(1024);
  
  doc["deviceKey"] = deviceKey;
  doc["latitude"] = currentLocation.latitude;
  doc["longitude"] = currentLocation.longitude;
  doc["altitude"] = currentLocation.altitude;
  doc["speed"] = currentLocation.speed;
  doc["course"] = currentLocation.course;
  doc["accuracy"] = calculateAccuracy();
  doc["battery"] = currentLocation.battery;
  doc["timestamp"] = WiFi.getTime();
  doc["isMoving"] = isMoving;
  
  // GPS metadata
  JsonObject gpsData = doc.createNestedObject("gpsData");
  gpsData["satellites"] = currentLocation.satellites;
  gpsData["hdop"] = currentLocation.hdop;
  gpsData["fixAge"] = gps.location.age();
  
  // System metadata
  JsonObject meta = doc.createNestedObject("metadata");
  meta["rssi"] = WiFi.RSSI();
  meta["freeHeap"] = ESP.getFreeHeap();
  meta["uptime"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  String topic = "devices/" + String(deviceKey) + "/location";
  return mqttClient.publish(topic.c_str(), payload.c_str());
}

bool sendLocationViaHTTP() {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  httpClient.begin(String(serverUrl) + "/api/devices/" + deviceKey + "/location");
  httpClient.addHeader("Content-Type", "application/json");
  httpClient.addHeader("Authorization", "Device " + String(deviceKey));
  
  // Create same JSON payload as MQTT
  DynamicJsonDocument doc(1024);
  doc["latitude"] = currentLocation.latitude;
  doc["longitude"] = currentLocation.longitude;
  doc["altitude"] = currentLocation.altitude;
  doc["speed"] = currentLocation.speed;
  doc["accuracy"] = calculateAccuracy();
  doc["battery"] = currentLocation.battery;
  doc["timestamp"] = WiFi.getTime();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int responseCode = httpClient.POST(jsonString);
  httpClient.end();
  
  return (responseCode == 200 || responseCode == 201);
}

float calculateAccuracy() {
  // Estimate accuracy based on HDOP and satellite count
  if (currentLocation.hdop < 2.0 && currentLocation.satellites >= 6) {
    return 3.0; // Excellent accuracy
  } else if (currentLocation.hdop < 5.0 && currentLocation.satellites >= 4) {
    return 10.0; // Good accuracy  
  } else {
    return 25.0; // Fair accuracy
  }
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("📶 Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.println("📍 IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n❌ WiFi connection failed!");
  }
}

void connectToMQTT() {
  int attempts = 0;
  while (!mqttClient.connected() && attempts < 3) {
    Serial.print("📡 Connecting to MQTT...");
    
    if (mqttClient.connect(deviceKey)) {
      Serial.println(" connected!");
      
      // Subscribe to commands
      String commandTopic = "devices/" + String(deviceKey) + "/commands";
      mqttClient.subscribe(commandTopic.c_str());
      
      return;
    } else {
      Serial.print(" failed, rc=");
      Serial.println(mqttClient.state());
      attempts++;
      delay(2000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  DynamicJsonDocument doc(256);
  deserializeJson(doc, message);
  
  String command = doc["command"];
  
  if (command == "ping") {
    sendStatusUpdate();
  } else if (command == "reboot") {
    Serial.println("🔄 Rebooting device...");
    ESP.restart();
  } else if (command == "config") {
    // Update configuration
    if (doc["updateInterval"]) {
      // Handle configuration updates
    }
  }
}

void sendStatusUpdate() {
  DynamicJsonDocument doc(512);
  
  doc["command"] = "status";
  doc["battery"] = currentLocation.battery;
  doc["gpsValid"] = currentLocation.valid;
  doc["satellites"] = currentLocation.satellites;
  doc["rssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = millis();
  doc["isMoving"] = isMoving;
  
  String payload;
  serializeJson(doc, payload);
  
  String topic = "devices/" + String(deviceKey) + "/status";
  mqttClient.publish(topic.c_str(), payload.c_str());
}

void updateBatteryLevel() {
  // Read battery voltage (if connected to ADC pin)
  // This is a placeholder - implement based on your hardware
  static float batteryVoltage = 4.2; // Start at full charge
  
  // Simulate battery drain
  batteryVoltage -= 0.0001;
  currentLocation.battery = map(batteryVoltage * 100, 320, 420, 0, 100);
  currentLocation.battery = constrain(currentLocation.battery, 0, 100);
}