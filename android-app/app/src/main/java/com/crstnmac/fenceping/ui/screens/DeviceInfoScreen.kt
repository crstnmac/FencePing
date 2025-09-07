package com.crstnmac.fenceping.ui.screens

import android.os.Build
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Smartphone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@Composable
fun DeviceInfoScreen(
    pairingCode: String,
    onDeviceInfoSubmitted: (DeviceInfo) -> Unit,
    isLoading: Boolean = false
) {
    var deviceName by remember { mutableStateOf("") }
    var deviceModel by remember { mutableStateOf(Build.MODEL) }
    var deviceFirmwareVersion by remember { mutableStateOf(Build.VERSION.RELEASE) }
    var deviceOs by remember { mutableStateOf("Android ${Build.VERSION.RELEASE}") }
    
    val isFormValid = deviceName.isNotBlank()
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Smartphone,
            contentDescription = null,
            modifier = Modifier
                .size(64.dp)
                .align(Alignment.CenterHorizontally),
            tint = MaterialTheme.colorScheme.primary
        )
        
        Text(
            text = "Device Information",
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .padding(vertical = 16.dp)
        )
        
        Text(
            text = "Complete the pairing by providing your device information",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .padding(bottom = 32.dp)
        )
        
        OutlinedTextField(
            value = deviceName,
            onValueChange = { deviceName = it },
            label = { Text("Device Name *") },
            placeholder = { Text("My Android Device") },
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Words,
                keyboardType = KeyboardType.Text
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
        )
        
        OutlinedTextField(
            value = deviceModel,
            onValueChange = { deviceModel = it },
            label = { Text("Device Model") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
        )
        
        OutlinedTextField(
            value = deviceFirmwareVersion,
            onValueChange = { deviceFirmwareVersion = it },
            label = { Text("Firmware Version") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
        )
        
        OutlinedTextField(
            value = deviceOs,
            onValueChange = { deviceOs = it },
            label = { Text("Operating System") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
        )
        
        Button(
            onClick = {
                val deviceInfo = DeviceInfo(
                    name = deviceName.trim(),
                    deviceModel = deviceModel.trim(),
                    deviceFirmwareVersion = deviceFirmwareVersion.trim(),
                    deviceOs = deviceOs.trim()
                )
                onDeviceInfoSubmitted(deviceInfo)
            },
            enabled = isFormValid && !isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Pairing...")
            } else {
                Text("Complete Pairing")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = "Pairing Code: $pairingCode",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                Text(
                    text = "This device will be registered with the above information",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

data class DeviceInfo(
    val name: String,
    val deviceModel: String,
    val deviceFirmwareVersion: String,
    val deviceOs: String
)