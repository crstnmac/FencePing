package com.crstnmac.fenceping.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException

data class QRCodeData(
    val type: String,
    val pairingCode: String,
    val accountId: String,
    val timestamp: Long
)

@Composable
fun PairingScreen(
    onPairingCodeEntered: (String) -> Unit,
    onQRScanRequested: () -> Unit
) {
    var pairingCode by remember { mutableStateOf("") }
    var isValidCode by remember { mutableStateOf(true) }
    
    // Validate pairing code format (expecting 8-12 characters)
    val isCodeValid = pairingCode.length >= 6 && pairingCode.matches(Regex("^[A-Z0-9]+$"))
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Device Pairing",
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        
        Text(
            text = "Enter the pairing code from your dashboard or scan the QR code",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(bottom = 32.dp)
        )
        
        OutlinedTextField(
            value = pairingCode,
            onValueChange = { newValue ->
                pairingCode = newValue.uppercase()
                isValidCode = true
            },
            label = { Text("Pairing Code") },
            isError = !isValidCode,
            supportingText = if (!isValidCode) {
                { Text("Invalid pairing code format") }
            } else null,
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Characters,
                keyboardType = KeyboardType.Text
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
        )
        
        Button(
            onClick = {
                if (isCodeValid) {
                    onPairingCodeEntered(pairingCode)
                } else {
                    isValidCode = false
                }
            },
            enabled = pairingCode.isNotEmpty(),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
        ) {
            Text("Continue with Code")
        }
        
        OutlinedButton(
            onClick = onQRScanRequested,
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(
                imageVector = Icons.Default.QrCode,
                contentDescription = null,
                modifier = Modifier.padding(end = 8.dp)
            )
            Text("Scan QR Code")
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Text(
            text = "The pairing code is valid for 10 minutes and can be found on your dashboard",
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

fun parseQRCodeData(qrContent: String): String? {
    return try {
        val gson = Gson()
        val qrData = gson.fromJson(qrContent, QRCodeData::class.java)
        
        if (qrData.type == "device_pairing") {
            qrData.pairingCode
        } else {
            null
        }
    } catch (e: JsonSyntaxException) {
        // Try treating it as a plain pairing code
        if (qrContent.matches(Regex("^[A-Z0-9]{6,12}$"))) {
            qrContent
        } else {
            null
        }
    }
}