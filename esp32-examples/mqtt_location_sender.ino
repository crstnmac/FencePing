/**
 * ESP32 MQTT Location Sender
 * Sends GPS coordinates via MQTT to geofence system
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT configuration (get these from pairing process)
const char* mqttServer = "localhost";  // Your server IP
const int mqttPort = 1883;
const char* deviceKey = "YOUR_DEVICE_KEY";  // From pairing

// GPS module (if using external GPS)
SoftwareSerial gpsSerial(4, 2); // RX, TX pins

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// Location data structure
struct LocationData {
  double latitude;
  double longitude;
  float accuracy;     // GPS accuracy in meters
  float speed;        // Speed in m/s
  float altitude;     // Altitude in meters
  float battery;      // Battery percentage
  unsigned long timestamp;
};

LocationData currentLocation;

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("WiFi connected!");
  
  // Setup MQTT
  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(mqttCallback);
  
  connectToMQTT();
}

void loop() {
  if (!mqttClient.connected()) {
    connectToMQTT();
  }
  mqttClient.loop();
  
  // Read GPS data
  if (readGPSData()) {
    // Send location every 30 seconds
    static unsigned long lastSend = 0;
    if (millis() - lastSend > 30000) {
      sendLocationViaMQTT();
      lastSend = millis();
    }
  }
  
  delay(1000);
}

void connectToMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    
    if (mqttClient.connect(deviceKey)) {
      Serial.println(" connected!");
      
      // Subscribe to device commands
      String commandTopic = "devices/" + String(deviceKey) + "/commands";
      mqttClient.subscribe(commandTopic.c_str());
      
    } else {
      Serial.print(" failed, rc=");
      Serial.print(mqttClient.state());
      delay(5000);
    }
  }
}

void sendLocationViaMQTT() {
  // Create JSON payload
  DynamicJsonDocument doc(512);
  
  doc["deviceKey"] = deviceKey;
  doc["latitude"] = currentLocation.latitude;
  doc["longitude"] = currentLocation.longitude;
  doc["accuracy"] = currentLocation.accuracy;
  doc["speed"] = currentLocation.speed;
  doc["altitude"] = currentLocation.altitude;
  doc["battery"] = currentLocation.battery;
  doc["timestamp"] = WiFi.getTime(); // Unix timestamp
  
  // Add device metadata
  JsonObject meta = doc.createNestedObject("metadata");
  meta["rssi"] = WiFi.RSSI();
  meta["freeHeap"] = ESP.getFreeHeap();
  meta["uptime"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  // Publish to MQTT topic
  String topic = "devices/" + String(deviceKey) + "/location";
  bool published = mqttClient.publish(topic.c_str(), payload.c_str());
  
  if (published) {
    Serial.println("📍 Location sent: " + 
      String(currentLocation.latitude, 6) + ", " + 
      String(currentLocation.longitude, 6));
  } else {
    Serial.println("❌ Failed to send location");
  }
}

bool readGPSData() {
  // Example GPS reading (replace with your GPS module code)
  // This simulates GPS coordinates for testing
  
  static bool firstRun = true;
  if (firstRun) {
    // Set initial location (replace with your actual location)
    currentLocation.latitude = 37.7749;   // San Francisco
    currentLocation.longitude = -122.4194;
    currentLocation.accuracy = 10.0;
    currentLocation.speed = 0.0;
    currentLocation.altitude = 50.0;
    firstRun = false;
  }
  
  // Simulate small movement for testing
  currentLocation.latitude += (random(-100, 100) / 1000000.0);
  currentLocation.longitude += (random(-100, 100) / 1000000.0);
  currentLocation.battery = max(0.0f, currentLocation.battery - 0.1f);
  
  return true; // Return true when GPS fix is available
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.println("📨 Received command: " + message);
  
  // Handle device commands
  DynamicJsonDocument doc(256);
  deserializeJson(doc, message);
  
  String command = doc["command"];
  if (command == "ping") {
    sendPingResponse();
  } else if (command == "restart") {
    ESP.restart();
  }
}

void sendPingResponse() {
  DynamicJsonDocument doc(256);
  doc["command"] = "ping";
  doc["response"] = "pong";
  doc["timestamp"] = WiFi.getTime();
  doc["battery"] = currentLocation.battery;
  doc["rssi"] = WiFi.RSSI();
  
  String payload;
  serializeJson(doc, payload);
  
  String topic = "devices/" + String(deviceKey) + "/status";
  mqttClient.publish(topic.c_str(), payload.c_str());
}