package com.crstnmac.fenceping.data.api

import retrofit2.Response
import retrofit2.http.*

data class PairingCodeResponse(
    val pairingCode: String,
    val expiresAt: String
)

data class DeviceData(
    val name: String,
    val deviceModel: String,
    val deviceFirmwareVersion: String,
    val deviceOs: String,
    val capabilities: DeviceCapabilities
)

data class DeviceCapabilities(
    val geofencing: Boolean,
    val location: Boolean,
    val battery: Boolean,
    val wifi: Boolean
)

data class PairingRequest(
    val pairingCode: String,
    val deviceData: DeviceData
)

data class PairingResponse(
    val success: Boolean,
    val data: PairingData
)

data class PairingData(
    val accessToken: String,
    val refreshToken: String,
    val deviceId: String,
    val expiresIn: Int,
    val refreshExpiresIn: Int,
    val deviceInfo: DeviceInfo
)

data class DeviceInfo(
    val name: String,
    val status: String,
    val lastSeen: String
)

data class LocationUpdate(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float? = null,
    val timestamp: String? = null,
    val battery: Int? = null
)

data class GeofenceEvent(
    val deviceId: String,
    val geofenceId: String,
    val eventType: String, // "enter", "exit", "dwell"
    val timestamp: Long,
    val location: LocationData
)

data class LocationData(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float
)

data class RefreshTokenRequest(
    val refreshToken: String
)

data class RefreshTokenResponse(
    val success: Boolean,
    val data: TokenData
)

data class TokenData(
    val accessToken: String,
    val expiresIn: Int
)

data class DeviceStatusResponse(
    val success: Boolean,
    val data: DeviceStatusData
)

data class DeviceStatusData(
    val deviceId: String,
    val name: String,
    val status: String,
    val lastHeartbeat: String?,
    val healthMetrics: Map<String, Any>?,
    val capabilities: Map<String, Any>?,
    val isPaired: Boolean,
    val secondsSinceHeartbeat: Double?
)

data class HeartbeatRequest(
    val batteryPct: Int? = null,
    val signalStrength: Int? = null,
    val uptimeSeconds: Long? = null,
    val connectionType: String? = null,
    val metadata: Map<String, Any>? = null
)

interface ApiService {
    
    @POST("devices/pairing/complete")
    suspend fun completePairing(@Body request: PairingRequest): Response<PairingResponse>
    
    @POST("devices/{deviceId}/location")
    suspend fun updateLocation(
        @Path("deviceId") deviceId: String,
        @Header("Authorization") token: String,
        @Body location: LocationUpdate
    ): Response<Unit>
    
    @GET("devices/{deviceId}/status")
    suspend fun getDeviceStatus(
        @Path("deviceId") deviceId: String,
        @Header("Authorization") token: String
    ): Response<DeviceStatusResponse>
    
    @POST("devices/{deviceId}/heartbeat")
    suspend fun sendHeartbeat(
        @Path("deviceId") deviceId: String,
        @Header("Authorization") token: String,
        @Body heartbeat: HeartbeatRequest
    ): Response<Unit>
    
    @POST("auth/refresh")
    suspend fun refreshToken(
        @Body request: RefreshTokenRequest
    ): Response<RefreshTokenResponse>
}