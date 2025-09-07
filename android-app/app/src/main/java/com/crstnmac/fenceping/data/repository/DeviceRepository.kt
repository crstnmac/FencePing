package com.crstnmac.fenceping.data.repository

import com.crstnmac.fenceping.data.api.ApiClient
import com.crstnmac.fenceping.data.api.DeviceStatusData
import com.crstnmac.fenceping.data.api.RefreshTokenRequest
import com.crstnmac.fenceping.data.storage.SecureStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DeviceRepository(private val secureStorage: SecureStorage) {
    
    private val apiService = ApiClient.apiService
    
    suspend fun getDeviceStatus(): Result<DeviceStatusData> {
        return withContext(Dispatchers.IO) {
            try {
                val deviceId = secureStorage.getDeviceId()
                val accessToken = secureStorage.getAccessToken()
                
                if (deviceId == null || accessToken == null) {
                    return@withContext Result.failure(Exception("Device not paired"))
                }
                
                val response = apiService.getDeviceStatus(
                    deviceId = deviceId,
                    token = "Bearer $accessToken"
                )
                
                if (response.isSuccessful && response.body()?.success == true) {
                    Result.success(response.body()!!.data)
                } else if (response.code() == 401) {
                    // Try to refresh token and retry
                    val refreshResult = refreshTokenAndRetry(deviceId)
                    refreshResult.fold(
                        onSuccess = { newToken ->
                            val retryResponse = apiService.getDeviceStatus(
                                deviceId = deviceId,
                                token = "Bearer $newToken"
                            )
                            
                            if (retryResponse.isSuccessful && retryResponse.body()?.success == true) {
                                Result.success(retryResponse.body()!!.data)
                            } else {
                                Result.failure(Exception("Failed to get device status after token refresh"))
                            }
                        },
                        onFailure = { error ->
                            Result.failure(error)
                        }
                    )
                } else {
                    Result.failure(Exception("Failed to get device status: ${response.message()}"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    private suspend fun refreshTokenAndRetry(deviceId: String): Result<String> {
        return try {
            val refreshToken = secureStorage.getRefreshToken()
            if (refreshToken == null) {
                return Result.failure(Exception("No refresh token available"))
            }
            
            val response = apiService.refreshToken(RefreshTokenRequest(refreshToken))
            
            if (response.isSuccessful && response.body()?.success == true) {
                val newAccessToken = response.body()!!.data.accessToken
                secureStorage.updateAccessToken(newAccessToken)
                Result.success(newAccessToken)
            } else {
                Result.failure(Exception("Token refresh failed: ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}