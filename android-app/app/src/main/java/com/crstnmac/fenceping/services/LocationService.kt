package com.crstnmac.fenceping.services

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.crstnmac.fenceping.R
import com.crstnmac.fenceping.data.api.ApiClient
import com.crstnmac.fenceping.data.api.LocationUpdate
import com.crstnmac.fenceping.data.api.RefreshTokenRequest
import com.crstnmac.fenceping.data.api.HeartbeatRequest
import com.crstnmac.fenceping.data.storage.SecureStorage
import java.text.SimpleDateFormat
import java.util.*
import com.google.android.gms.location.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import android.util.Log

class LocationService : Service() {
    
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var secureStorage: SecureStorage
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    private val apiService = ApiClient.apiService
    private var lastHeartbeatTime = 0L
    private var startTime = 0L
    
    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "location_tracking"
        private const val LOCATION_UPDATE_INTERVAL = 30000L // 30 seconds
        private const val LOCATION_FASTEST_INTERVAL = 15000L // 15 seconds
        private const val HEARTBEAT_INTERVAL = 300000L // 5 minutes
        private const val TAG = "LocationService"
        
        fun startService(context: Context) {
            val intent = Intent(context, LocationService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
        
        fun stopService(context: Context) {
            val intent = Intent(context, LocationService::class.java)
            context.stopService(intent)
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        
        secureStorage = SecureStorage(this)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        startTime = System.currentTimeMillis()
        
        createNotificationChannel()
        
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    handleLocationUpdate(location)
                }
            }
        }
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundService()
        startLocationUpdates()
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        stopLocationUpdates()
    }
    
    private fun startForegroundService() {
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Tracks device location for geofencing"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FencePing Active")
            .setContentText("Tracking location for geofencing")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }
    
    private fun startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e(TAG, "Location permission not granted")
            return
        }
        
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_UPDATE_INTERVAL
        ).apply {
            setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL)
            setMaxUpdateDelayMillis(LOCATION_UPDATE_INTERVAL * 2)
        }.build()
        
        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )
        
        Log.d(TAG, "Location updates started")
    }
    
    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        Log.d(TAG, "Location updates stopped")
    }
    
    private fun handleLocationUpdate(location: Location) {
        Log.d(TAG, "Location update: ${location.latitude}, ${location.longitude}")
        
        serviceScope.launch {
            try {
                val deviceId = secureStorage.getDeviceId()
                val accessToken = secureStorage.getAccessToken()
                
                if (deviceId != null && accessToken != null) {
                    val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                    dateFormat.timeZone = TimeZone.getTimeZone("UTC")
                    
                    val locationUpdate = LocationUpdate(
                        latitude = location.latitude,
                        longitude = location.longitude,
                        accuracy = location.accuracy,
                        timestamp = dateFormat.format(Date()),
                        battery = getBatteryLevel()
                    )
                    
                    val response = apiService.updateLocation(
                        deviceId = deviceId,
                        token = "Bearer $accessToken",
                        location = locationUpdate
                    )
                    
                    if (response.isSuccessful) {
                        Log.d(TAG, "Location update sent successfully")
                        
                        // Send heartbeat if enough time has passed
                        val currentTime = System.currentTimeMillis()
                        if (currentTime - lastHeartbeatTime > HEARTBEAT_INTERVAL) {
                            sendHeartbeat(deviceId, accessToken)
                            lastHeartbeatTime = currentTime
                        }
                    } else {
                        Log.e(TAG, "Failed to send location update: ${response.message()}")
                        
                        // Try to refresh token if unauthorized
                        if (response.code() == 401) {
                            refreshTokenAndRetry(locationUpdate, deviceId)
                        }
                    }
                } else {
                    Log.w(TAG, "Device not paired, stopping location service")
                    stopSelf()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending location update", e)
            }
        }
    }
    
    private suspend fun refreshTokenAndRetry(locationUpdate: LocationUpdate, deviceId: String) {
        try {
            val refreshToken = secureStorage.getRefreshToken()
            if (refreshToken != null) {
                val response = apiService.refreshToken(RefreshTokenRequest(refreshToken))
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val newAccessToken = response.body()?.data?.accessToken
                    if (newAccessToken != null) {
                        secureStorage.updateAccessToken(newAccessToken)
                        
                        // Retry location update with new token
                        val retryResponse = apiService.updateLocation(
                            deviceId = deviceId,
                            token = "Bearer $newAccessToken",
                            location = locationUpdate
                        )
                        
                        if (retryResponse.isSuccessful) {
                            Log.d(TAG, "Location update sent successfully after token refresh")
                        } else {
                            Log.e(TAG, "Location update still failed after token refresh")
                        }
                    }
                } else {
                    Log.e(TAG, "Token refresh failed: ${response.message()}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error refreshing token", e)
        }
    }
    
    private suspend fun sendHeartbeat(deviceId: String, accessToken: String) {
        try {
            val uptimeSeconds = (System.currentTimeMillis() - startTime) / 1000
            val heartbeat = HeartbeatRequest(
                batteryPct = getBatteryLevel(),
                uptimeSeconds = uptimeSeconds,
                connectionType = "wifi", // Could be improved to detect actual connection
                metadata = mapOf(
                    "app_version" to "1.0",
                    "os_version" to android.os.Build.VERSION.RELEASE,
                    "device_model" to android.os.Build.MODEL
                )
            )
            
            val response = apiService.sendHeartbeat(
                deviceId = deviceId,
                token = "Bearer $accessToken",
                heartbeat = heartbeat
            )
            
            if (response.isSuccessful) {
                Log.d(TAG, "Heartbeat sent successfully")
            } else {
                Log.w(TAG, "Failed to send heartbeat: ${response.message()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error sending heartbeat", e)
        }
    }
    
    private suspend fun checkDeviceStatus(deviceId: String, accessToken: String) {
        try {
            val response = apiService.getDeviceStatus(
                deviceId = deviceId,
                token = "Bearer $accessToken"
            )
            
            if (response.isSuccessful && response.body()?.success == true) {
                val status = response.body()?.data
                Log.d(TAG, "Device status: ${status?.status}, Last heartbeat: ${status?.lastHeartbeat}")
            } else {
                Log.w(TAG, "Failed to get device status: ${response.message()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking device status", e)
        }
    }
    
    private fun getBatteryLevel(): Int {
        return try {
            val batteryManager = getSystemService(Context.BATTERY_SERVICE) as android.os.BatteryManager
            batteryManager.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY)
        } catch (e: Exception) {
            -1 // Unknown battery level
        }
    }
}