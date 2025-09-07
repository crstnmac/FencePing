package com.crstnmac.fenceping.ui.screens

import android.Manifest
import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.crstnmac.fenceping.services.LocationService
import com.crstnmac.fenceping.data.repository.DeviceRepository
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

data class DeviceStatus(
    val deviceId: String,
    val deviceName: String,
    val isOnline: Boolean,
    val batteryLevel: Int,
    val lastLocationUpdate: Long,
    val locationTrackingEnabled: Boolean
)

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun DashboardScreen(
    deviceStatus: DeviceStatus?,
    deviceRepository: DeviceRepository,
    onDeviceStatusUpdated: (DeviceStatus) -> Unit,
    onUnpairDevice: () -> Unit
) {
    val context = LocalContext.current
    var locationServiceRunning by remember { mutableStateOf(false) }
    
    val locationPermissionState = rememberMultiplePermissionsState(
        permissions = listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        )
    )
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Device Dashboard",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            
            IconButton(onClick = onUnpairDevice) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Logout,
                    contentDescription = "Unpair Device",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        if (deviceStatus != null) {
            // Device Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Smartphone,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(32.dp)
                        )
                        
                        Spacer(modifier = Modifier.width(12.dp))
                        
                        Column {
                            Text(
                                text = deviceStatus.deviceName,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.SemiBold
                            )
                            
                            Text(
                                text = "ID: ${deviceStatus.deviceId.take(8)}...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        StatusChip(
                            label = "Status",
                            value = if (deviceStatus.isOnline) "Online" else "Offline",
                            color = if (deviceStatus.isOnline) Color.Green else Color.Red
                        )
                        
                        StatusChip(
                            label = "Battery",
                            value = "${deviceStatus.batteryLevel}%",
                            color = when {
                                deviceStatus.batteryLevel > 50 -> Color.Green
                                deviceStatus.batteryLevel > 20 -> Color(0xFFFFA500)
                                else -> Color.Red
                            }
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    if (deviceStatus.lastLocationUpdate > 0) {
                        val dateFormat = SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault())
                        val lastUpdateText = dateFormat.format(Date(deviceStatus.lastLocationUpdate))
                        
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(16.dp)
                            )
                            
                            Spacer(modifier = Modifier.width(4.dp))
                            
                            Text(
                                text = "Last location update: $lastUpdateText",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // Location Tracking Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Location Tracking",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            
                            Text(
                                text = if (locationServiceRunning) "Active" else "Inactive",
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (locationServiceRunning) Color.Green else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        
                        Switch(
                            checked = locationServiceRunning,
                            onCheckedChange = { isChecked ->
                                if (isChecked) {
                                    if (locationPermissionState.allPermissionsGranted) {
                                        LocationService.startService(context)
                                        locationServiceRunning = true
                                    } else {
                                        locationPermissionState.launchMultiplePermissionRequest()
                                    }
                                } else {
                                    LocationService.stopService(context)
                                    locationServiceRunning = false
                                }
                            }
                        )
                    }
                    
                    if (!locationPermissionState.allPermissionsGranted) {
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer
                            )
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp)
                            ) {
                                Text(
                                    text = "Location permissions required",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                                
                                Spacer(modifier = Modifier.height(8.dp))
                                
                                Button(
                                    onClick = { locationPermissionState.launchMultiplePermissionRequest() },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = MaterialTheme.colorScheme.error
                                    )
                                ) {
                                    Text("Grant Permissions")
                                }
                            }
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // Geofence Status Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(24.dp)
                        )
                        
                        Spacer(modifier = Modifier.width(8.dp))
                        
                        Text(
                            text = "Geofence Protection",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Text(
                        text = "Your device is being monitored for geofence events. Automations will trigger when you enter or exit defined areas.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
        } else {
            // Loading state
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
        
        Spacer(modifier = Modifier.weight(1f))
        
        // Unpair Button
        OutlinedButton(
            onClick = onUnpairDevice,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.error
            )
        ) {
            Icon(
                imageVector = Icons.Default.LinkOff,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Unpair Device")
        }
    }
    
    // Handle permission changes
    LaunchedEffect(locationPermissionState.allPermissionsGranted) {
        if (locationPermissionState.allPermissionsGranted && locationServiceRunning) {
            LocationService.startService(context)
        }
    }
    
    // Periodic device status updates
    LaunchedEffect(deviceStatus?.deviceId) {
        if (deviceStatus != null) {
            while (true) {
                delay(60000L) // Check every minute
                
                try {
                    val statusResult = deviceRepository.getDeviceStatus()
                    statusResult.fold(
                        onSuccess = { statusData ->
                            val updatedStatus = deviceStatus.copy(
                                deviceName = statusData.name,
                                isOnline = statusData.status == "online",
                                // Extract battery from healthMetrics if available
                                batteryLevel = statusData.healthMetrics?.get("batteryPct") as? Int ?: deviceStatus.batteryLevel
                            )
                            onDeviceStatusUpdated(updatedStatus)
                        },
                        onFailure = { error ->
                            // Silently fail periodic checks, don't overwhelm user
                        }
                    )
                } catch (e: Exception) {
                    // Silently handle exceptions in periodic checks
                }
            }
        }
    }
}

@Composable
private fun StatusChip(
    label: String,
    value: String,
    color: Color
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        
        Spacer(modifier = Modifier.height(4.dp))
        
        Surface(
            color = color.copy(alpha = 0.1f),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                color = color,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
            )
        }
    }
}