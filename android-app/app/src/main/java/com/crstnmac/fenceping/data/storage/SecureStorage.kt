package com.crstnmac.fenceping.data.storage

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SecureStorage(private val context: Context) {
    
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
    
    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "device_credentials",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    suspend fun saveDeviceCredentials(
        deviceId: String,
        accessToken: String,
        refreshToken: String
    ) = withContext(Dispatchers.IO) {
        sharedPreferences.edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putBoolean(KEY_IS_PAIRED, true)
            .apply()
    }
    
    suspend fun getDeviceId(): String? = withContext(Dispatchers.IO) {
        sharedPreferences.getString(KEY_DEVICE_ID, null)
    }
    
    suspend fun getAccessToken(): String? = withContext(Dispatchers.IO) {
        sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
    }
    
    suspend fun getRefreshToken(): String? = withContext(Dispatchers.IO) {
        sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
    }
    
    suspend fun isPaired(): Boolean = withContext(Dispatchers.IO) {
        sharedPreferences.getBoolean(KEY_IS_PAIRED, false)
    }
    
    suspend fun clearCredentials() = withContext(Dispatchers.IO) {
        sharedPreferences.edit().clear().apply()
    }
    
    suspend fun updateAccessToken(token: String) = withContext(Dispatchers.IO) {
        sharedPreferences.edit()
            .putString(KEY_ACCESS_TOKEN, token)
            .apply()
    }
    
    companion object {
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_IS_PAIRED = "is_paired"
    }
}