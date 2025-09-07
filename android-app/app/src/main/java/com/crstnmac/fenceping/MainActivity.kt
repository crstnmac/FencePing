package com.crstnmac.fenceping

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.crstnmac.fenceping.data.api.*
import com.crstnmac.fenceping.data.repository.PairingRepository
import com.crstnmac.fenceping.data.repository.DeviceRepository
import com.crstnmac.fenceping.data.storage.SecureStorage
import com.crstnmac.fenceping.services.LocationService
import com.crstnmac.fenceping.ui.screens.*
import com.crstnmac.fenceping.ui.theme.FencepingTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var secureStorage: SecureStorage
    private lateinit var pairingRepository: PairingRepository
    private lateinit var deviceRepository: DeviceRepository
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        secureStorage = SecureStorage(this)
        pairingRepository = PairingRepository()
        deviceRepository = DeviceRepository(secureStorage)
        
        enableEdgeToEdge()
        
        setContent {
            FencepingTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    FencePingApp(
                        secureStorage = secureStorage,
                        pairingRepository = pairingRepository,
                        deviceRepository = deviceRepository
                    )
                }
            }
        }
    }
}

@Composable
fun LoadingScreen() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
fun FencePingApp(
    secureStorage: SecureStorage,
    pairingRepository: PairingRepository,
    deviceRepository: DeviceRepository
) {
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    var isPaired by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var deviceStatus by remember { mutableStateOf<DeviceStatus?>(null) }
    var pairingCode by remember { mutableStateOf("") }
    var showError by remember { mutableStateOf<String?>(null) }
    
    // Check if device is already paired on startup
    LaunchedEffect(Unit) {
        try {
            isPaired = secureStorage.isPaired()
            if (isPaired) {
                val deviceId = secureStorage.getDeviceId() ?: ""
                
                // Try to get actual device status from API
                try {
                    val statusResult = deviceRepository.getDeviceStatus()
                    statusResult.fold(
                        onSuccess = { statusData ->
                            deviceStatus = DeviceStatus(
                                deviceId = statusData.deviceId,
                                deviceName = statusData.name,
                                isOnline = statusData.status == "online",
                                batteryLevel = 85, // Could be extracted from healthMetrics
                                lastLocationUpdate = System.currentTimeMillis(),
                                locationTrackingEnabled = true
                            )
                        },
                        onFailure = {
                            // Fallback to basic device status
                            deviceStatus = DeviceStatus(
                                deviceId = deviceId,
                                deviceName = "My Device",
                                isOnline = true,
                                batteryLevel = 85,
                                lastLocationUpdate = System.currentTimeMillis(),
                                locationTrackingEnabled = true
                            )
                        }
                    )
                } catch (e: Exception) {
                    // Fallback to basic device status
                    deviceStatus = DeviceStatus(
                        deviceId = deviceId,
                        deviceName = "My Device",
                        isOnline = true,
                        batteryLevel = 85,
                        lastLocationUpdate = System.currentTimeMillis(),
                        locationTrackingEnabled = true
                    )
                }
            }
        } catch (e: Exception) {
            showError = "Failed to check pairing status"
        } finally {
            isLoading = false
        }
    }
    
    if (isLoading) {
        LoadingScreen()
    } else {
        NavHost(
            navController = navController,
            startDestination = if (isPaired) "dashboard" else "pairing"
        ) {
            composable("pairing") {
                PairingScreen(
                    onPairingCodeEntered = { code ->
                        pairingCode = code
                        navController.navigate("device_info")
                    },
                    onQRScanRequested = {
                        navController.navigate("qr_scanner")
                    }
                )
            }
            
            composable("qr_scanner") {
                QRCodeScannerScreen(
                    onQRCodeScanned = { qrContent ->
                        val extractedCode = parseQRCodeData(qrContent)
                        if (extractedCode != null) {
                            pairingCode = extractedCode
                            navController.navigate("device_info")
                        } else {
                            showError = "Invalid QR code format"
                            navController.popBackStack()
                        }
                    },
                    onBackPressed = {
                        navController.popBackStack()
                    }
                )
            }
            
            composable("device_info") {
                var isSubmitting by remember { mutableStateOf(false) }
                
                DeviceInfoScreen(
                    pairingCode = pairingCode,
                    isLoading = isSubmitting,
                    onDeviceInfoSubmitted = { deviceInfo, context ->
                        isSubmitting = true
                        
                        val pairingRequest = PairingRequest(
                            pairingCode = pairingCode,
                            deviceData = DeviceData(
                                name = deviceInfo.name,
                                deviceModel = deviceInfo.deviceModel,
                                deviceFirmwareVersion = deviceInfo.deviceFirmwareVersion,
                                deviceOs = deviceInfo.deviceOs,
                                capabilities = DeviceCapabilities(
                                    geofencing = true,
                                    location = true,
                                    battery = true,
                                    wifi = true
                                )
                            )
                        )
                        
                        scope.launch {
                            try {
                                val result = pairingRepository.completePairing(pairingRequest)
                                result.fold(
                                    onSuccess = { pairingData ->
                                        secureStorage.saveDeviceCredentials(
                                            deviceId = pairingData.deviceId,
                                            accessToken = pairingData.accessToken,
                                            refreshToken = pairingData.refreshToken
                                        )
                                        
                                        isPaired = true
                                        deviceStatus = DeviceStatus(
                                            deviceId = pairingData.deviceId,
                                            deviceName = pairingData.deviceInfo.name,
                                            isOnline = pairingData.deviceInfo.status == "online",
                                            batteryLevel = 100,
                                            lastLocationUpdate = System.currentTimeMillis(),
                                            locationTrackingEnabled = true
                                        )
                                        
                                        LocationService.startService(context)
                                        
                                        navController.navigate("dashboard") {
                                            popUpTo("pairing") { inclusive = true }
                                        }
                                    },
                                    onFailure = { error ->
                                        showError = "Pairing failed: ${error.message}"
                                    }
                                )
                            } catch (e: Exception) {
                                showError = "Network error: ${e.message}"
                            } finally {
                                isSubmitting = false
                            }
                        }
                    }
                )
            }
            
            composable("dashboard") {
                DashboardScreen(
                    deviceStatus = deviceStatus,
                    deviceRepository = deviceRepository,
                    onDeviceStatusUpdated = { updatedStatus ->
                        deviceStatus = updatedStatus
                    },
                    onUnpairDevice = {
                        scope.launch {
                            try {
                                secureStorage.clearCredentials()
                                isPaired = false
                                deviceStatus = null
                                pairingCode = ""
                                
                                navController.navigate("pairing") {
                                    popUpTo("dashboard") { inclusive = true }
                                }
                            } catch (e: Exception) {
                                showError = "Failed to unpair device"
                            }
                        }
                    }
                )
            }
        }
    }
    
    showError?.let { error ->
        LaunchedEffect(error) {
            println("Error: $error")
            showError = null
        }
    }
}
