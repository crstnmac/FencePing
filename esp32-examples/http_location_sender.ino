/**
 * ESP32 HTTP Location Sender  
 * Sends GPS coordinates via REST API to geofence system
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server configuration
const char* serverUrl = "http://192.168.1.100:3001"; // Your server IP
const char* deviceKey = "YOUR_DEVICE_KEY";  // From pairing

// Location data
struct LocationData {
  double latitude;
  double longitude;
  float accuracy;
  float speed;
  float battery;
  unsigned long timestamp;
} currentLocation;

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("✅ WiFi connected!");
  Serial.println("📍 IP address: " + WiFi.localIP().toString());
  
  // Initialize location (replace with GPS reading)
  currentLocation.latitude = 37.7749;
  currentLocation.longitude = -122.4194;
  currentLocation.accuracy = 10.0;
  currentLocation.speed = 0.0;
  currentLocation.battery = 100.0;
}

void loop() {
  // Update location data (simulate movement)
  updateLocationData();
  
  // Send location via HTTP
  if (sendLocationViaHTTP()) {
    Serial.println("📍 Location sent successfully");
  } else {
    Serial.println("❌ Failed to send location");
  }
  
  // Wait 30 seconds before next update
  delay(30000);
}

void updateLocationData() {
  // Simulate GPS movement for testing
  currentLocation.latitude += (random(-100, 100) / 1000000.0);
  currentLocation.longitude += (random(-100, 100) / 1000000.0);
  currentLocation.battery = max(0.0f, currentLocation.battery - 0.1f);
  currentLocation.timestamp = WiFi.getTime();
}

bool sendLocationViaHTTP() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected");
    return false;
  }
  
  HTTPClient http;
  
  // Create API endpoint URL
  String url = String(serverUrl) + "/api/devices/" + deviceKey + "/location";
  http.begin(url);
  
  // Set headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Device " + String(deviceKey));
  
  // Create JSON payload
  DynamicJsonDocument doc(512);
  
  doc["latitude"] = currentLocation.latitude;
  doc["longitude"] = currentLocation.longitude;
  doc["accuracy"] = currentLocation.accuracy;
  doc["speed"] = currentLocation.speed;
  doc["battery"] = currentLocation.battery;
  doc["timestamp"] = currentLocation.timestamp;
  
  // Add metadata
  JsonObject meta = doc.createNestedObject("metadata");
  meta["rssi"] = WiFi.RSSI();
  meta["freeHeap"] = ESP.getFreeHeap();
  meta["chipId"] = String((uint32_t)ESP.getEfuseMac(), HEX);
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send POST request
  int httpResponseCode = http.POST(jsonString);
  
  bool success = false;
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("📡 HTTP Response: " + String(httpResponseCode));
    Serial.println("📄 Response body: " + response);
    
    // Check if request was successful
    if (httpResponseCode == 200 || httpResponseCode == 201) {
      success = true;
      
      // Parse response to check for geofence events
      DynamicJsonDocument responseDoc(1024);
      deserializeJson(responseDoc, response);
      
      if (responseDoc["geofenceEvents"]) {
        handleGeofenceEvents(responseDoc["geofenceEvents"]);
      }
    }
  } else {
    Serial.println("❌ HTTP Error: " + String(httpResponseCode));
  }
  
  http.end();
  return success;
}

void handleGeofenceEvents(JsonArray events) {
  for (JsonObject event : events) {
    String eventType = event["type"];
    String geofenceName = event["geofenceName"];
    
    Serial.println("🎯 Geofence Event: " + eventType + " - " + geofenceName);
    
    // React to geofence events
    if (eventType == "enter") {
      onGeofenceEnter(geofenceName);
    } else if (eventType == "exit") {
      onGeofenceExit(geofenceName);
    }
  }
}

void onGeofenceEnter(String geofenceName) {
  Serial.println("🏠 Entered: " + geofenceName);
  
  // Example: Flash LED when entering home
  if (geofenceName == "Home") {
    for (int i = 0; i < 5; i++) {
      digitalWrite(LED_BUILTIN, HIGH);
      delay(200);
      digitalWrite(LED_BUILTIN, LOW);
      delay(200);
    }
  }
}

void onGeofenceExit(String geofenceName) {
  Serial.println("🚪 Exited: " + geofenceName);
  
  // Example: Send alert when leaving work
  if (geofenceName == "Work") {
    sendCustomAlert("Left work at " + String(WiFi.getTime()));
  }
}

void sendCustomAlert(String message) {
  HTTPClient http;
  http.begin(String(serverUrl) + "/api/devices/" + deviceKey + "/alert");
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(256);
  doc["message"] = message;
  doc["timestamp"] = WiFi.getTime();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int responseCode = http.POST(jsonString);
  Serial.println("🚨 Alert sent: " + String(responseCode));
  
  http.end();
}