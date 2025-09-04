/**
 * ESP32 GeoFence Client - Ultra-Simple Pairing
 * 
 * SETUP INSTRUCTIONS:
 * 1. Flash this code to ESP32 (one-time setup)
 * 2. Power on ESP32 - it creates WiFi hotspot "ESP32-Setup-XXXX"
 * 3. Connect phone/computer to hotspot
 * 4. Scan QR code in dashboard or visit: http://192.168.4.1
 * 5. ESP32 automatically connects and starts tracking
 * 
 * That's it! No manual configuration needed.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <HTTPClient.h>
#include <DNSServer.h>
#include <EEPROM.h>
#include <QRCode.h>

// Device Configuration
String deviceName = "ESP32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
String pairingCode = "";
String deviceKey = "";
String serverUrl = "";
String mqttServer = "";
String wifiSSID = "";
String wifiPassword = "";

// Network Objects
WebServer server(80);
DNSServer dnsServer;
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// States
bool isConfigured = false;
bool pairingMode = true;
unsigned long lastLocationSend = 0;
const unsigned long LOCATION_INTERVAL = 30000; // 30 seconds

// Location simulation (replace with GPS in real implementation)
struct Location {
  float latitude = 37.7749;   // San Francisco default
  float longitude = -122.4194;
  float accuracy = 10.0;
  float speed = 0.0;
  float battery = 100.0;
} currentLocation;

void setup() {
  Serial.begin(115200);
  EEPROM.begin(512);
  
  Serial.println("🚀 ESP32 GeoFence Client Starting...");
  
  // Load saved configuration
  loadConfiguration();
  
  if (isConfigured) {
    Serial.println("📱 Device already configured, connecting to WiFi...");
    connectToWiFi();
  } else {
    Serial.println("🔧 First time setup - Starting pairing mode");
    startPairingMode();
  }
}

void loop() {
  if (pairingMode) {
    // Handle pairing web server
    dnsServer.processNextRequest();
    server.handleClient();
    
    // Blink LED to show pairing mode
    digitalWrite(LED_BUILTIN, millis() % 1000 < 500);
    
  } else if (isConfigured) {
    // Normal operation mode
    if (!mqttClient.connected()) {
      reconnectMQTT();
    }
    mqttClient.loop();
    
    // Send location updates
    if (millis() - lastLocationSend > LOCATION_INTERVAL) {
      sendLocationUpdate();
      lastLocationSend = millis();
    }
    
    // Solid LED when connected
    digitalWrite(LED_BUILTIN, HIGH);
  }
  
  delay(100);
}

void startPairingMode() {
  pairingMode = true;
  
  // Create WiFi Access Point
  String apName = "ESP32-Setup-" + String((uint32_t)ESP.getEfuseMac(), HEX).substring(0, 4);
  WiFi.softAP(apName.c_str(), "geofence123");
  
  // Start DNS server for captive portal
  dnsServer.start(53, "*", WiFi.softAPIP());
  
  // Setup web server routes
  server.on("/", handlePairingPage);
  server.on("/configure", HTTP_POST, handleConfiguration);
  server.on("/status", handleStatus);
  server.onNotFound(handlePairingPage); // Captive portal
  
  server.begin();
  
  Serial.println("📡 Pairing Mode Active!");
  Serial.println("💡 Connect to WiFi: " + apName);
  Serial.println("🌐 Open browser to: http://192.168.4.1");
  Serial.println("📱 Or scan QR code in dashboard");
}

void handlePairingPage() {
  String html = R"(
<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ESP32 Setup</title>
<style>
body{font-family:Arial;margin:20px;background:#f5f5f5}
.card{background:white;padding:20px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);max-width:400px;margin:0 auto}
.btn{background:#007bff;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;width:100%;margin-top:10px}
.btn:hover{background:#0056b3}
input{width:100%;padding:10px;margin:5px 0;border:1px solid #ddd;border-radius:5px;box-sizing:border-box}
.status{padding:10px;border-radius:5px;margin:10px 0}
.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}
.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}
</style>
</head><body>
<div class="card">
<h2>🚀 ESP32 GeoFence Setup</h2>
<p><strong>Device:</strong> )" + deviceName + R"(</p>
<form id="configForm">
<h3>📱 Pairing Code</h3>
<input type="text" id="pairingCode" placeholder="Enter pairing code from dashboard" required>

<h3>📶 WiFi Settings</h3>
<input type="text" id="wifiSSID" placeholder="WiFi Network Name" required>
<input type="password" id="wifiPassword" placeholder="WiFi Password" required>

<button type="submit" class="btn">🔗 Connect Device</button>
</form>
<div id="status"></div>
</div>

<script>
document.getElementById('configForm').onsubmit = function(e) {
  e.preventDefault();
  
  const data = {
    pairingCode: document.getElementById('pairingCode').value,
    wifiSSID: document.getElementById('wifiSSID').value,
    wifiPassword: document.getElementById('wifiPassword').value
  };
  
  document.getElementById('status').innerHTML = '<div class="status">⏳ Configuring device...</div>';
  
  fetch('/configure', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      document.getElementById('status').innerHTML = 
        '<div class="status success">✅ Device configured successfully!<br>📍 Now tracking location...</div>';
      setTimeout(() => location.reload(), 3000);
    } else {
      document.getElementById('status').innerHTML = 
        '<div class="status error">❌ ' + result.error + '</div>';
    }
  })
  .catch(error => {
    document.getElementById('status').innerHTML = 
      '<div class="status error">❌ Connection failed</div>';
  });
};
</script>
</body></html>
  )";
  
  server.send(200, "text/html", html);
}

void handleConfiguration() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"No data received\"}");
    return;
  }
  
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, server.arg("plain"));
  
  pairingCode = doc["pairingCode"].as<String>();
  wifiSSID = doc["wifiSSID"].as<String>();
  wifiPassword = doc["wifiPassword"].as<String>();
  
  Serial.println("🔑 Pairing code: " + pairingCode);
  
  // Validate pairing code with server
  if (validatePairingCode()) {
    // Save configuration
    saveConfiguration();
    
    server.send(200, "application/json", "{\"success\":true}");
    
    Serial.println("✅ Configuration saved, restarting...");
    delay(2000);
    ESP.restart();
    
  } else {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Invalid pairing code\"}");
  }
}

void handleStatus() {
  DynamicJsonDocument doc(512);
  doc["deviceName"] = deviceName;
  doc["configured"] = isConfigured;
  doc["wifiConnected"] = WiFi.status() == WL_CONNECTED;
  doc["mqttConnected"] = mqttClient.connected();
  doc["freeHeap"] = ESP.getFreeHeap();
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

bool validatePairingCode() {
  if (pairingCode.length() == 0) return false;
  
  // Make HTTP request to validate pairing code
  HTTPClient http;
  http.begin("http://192.168.1.100:3001/api/devices/pairing/validate"); // Update with your server IP
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(256);
  doc["pairingCode"] = pairingCode;
  doc["deviceName"] = deviceName;
  doc["deviceType"] = "esp32";
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode == 200) {
    String response = http.getString();
    DynamicJsonDocument responseDoc(1024);
    deserializeJson(responseDoc, response);
    
    if (responseDoc["success"]) {
      deviceKey = responseDoc["deviceKey"].as<String>();
      serverUrl = responseDoc["serverUrl"].as<String>();
      mqttServer = responseDoc["mqttServer"].as<String>();
      
      Serial.println("🔑 Device key received: " + deviceKey);
      return true;
    }
  }
  
  http.end();
  return false;
}

void saveConfiguration() {
  // Save to EEPROM
  int addr = 0;
  EEPROM.writeString(addr, deviceKey); addr += deviceKey.length() + 1;
  EEPROM.writeString(addr, serverUrl); addr += serverUrl.length() + 1;
  EEPROM.writeString(addr, mqttServer); addr += mqttServer.length() + 1;
  EEPROM.writeString(addr, wifiSSID); addr += wifiSSID.length() + 1;
  EEPROM.writeString(addr, wifiPassword); addr += wifiPassword.length() + 1;
  EEPROM.writeBool(addr, true); // configured flag
  EEPROM.commit();
  
  isConfigured = true;
}

void loadConfiguration() {
  int addr = 0;
  deviceKey = EEPROM.readString(addr); addr += deviceKey.length() + 1;
  serverUrl = EEPROM.readString(addr); addr += serverUrl.length() + 1;
  mqttServer = EEPROM.readString(addr); addr += mqttServer.length() + 1;
  wifiSSID = EEPROM.readString(addr); addr += wifiSSID.length() + 1;
  wifiPassword = EEPROM.readString(addr); addr += wifiPassword.length() + 1;
  isConfigured = EEPROM.readBool(addr);
}

void connectToWiFi() {
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  
  Serial.print("📶 Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.println("📍 IP address: " + WiFi.localIP().toString());
    
    mqttClient.setServer(mqttServer.c_str(), 1883);
    pairingMode = false;
  } else {
    Serial.println("\n❌ WiFi connection failed, returning to pairing mode");
    startPairingMode();
  }
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("📡 Connecting to MQTT...");
    
    if (mqttClient.connect(deviceKey.c_str())) {
      Serial.println(" connected!");
      
      // Subscribe to device commands
      String commandTopic = "devices/" + deviceKey + "/commands";
      mqttClient.subscribe(commandTopic.c_str());
      
    } else {
      Serial.print(" failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }
}

void sendLocationUpdate() {
  if (!mqttClient.connected()) return;
  
  // Simulate location updates (replace with real GPS)
  currentLocation.latitude += (random(-100, 100) / 100000.0); // Small random movement
  currentLocation.longitude += (random(-100, 100) / 100000.0);
  currentLocation.battery = max(0.0f, currentLocation.battery - 0.1f); // Battery drain simulation
  
  DynamicJsonDocument doc(512);
  doc["deviceKey"] = deviceKey;
  doc["latitude"] = currentLocation.latitude;
  doc["longitude"] = currentLocation.longitude;
  doc["accuracy"] = currentLocation.accuracy;
  doc["speed"] = currentLocation.speed;
  doc["battery"] = currentLocation.battery;
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  String topic = "devices/" + deviceKey + "/location";
  mqttClient.publish(topic.c_str(), payload.c_str());
  
  Serial.println("📍 Location sent: " + String(currentLocation.latitude, 6) + ", " + String(currentLocation.longitude, 6));
}