package com.crstnmac.fenceping.data.repository

import com.crstnmac.fenceping.data.api.ApiClient
import com.crstnmac.fenceping.data.api.PairingRequest
import com.crstnmac.fenceping.data.api.PairingData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class PairingRepository {
    
    private val apiService = ApiClient.apiService
    
    suspend fun completePairing(pairingRequest: PairingRequest): Result<PairingData> {
        return withContext(Dispatchers.IO) {
            try {
                val response = apiService.completePairing(pairingRequest)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.success) {
                        Result.success(body.data)
                    } else {
                        Result.failure(Exception("Pairing failed: API returned success=false"))
                    }
                } else {
                    Result.failure(Exception("Pairing failed: ${response.message()}"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
}