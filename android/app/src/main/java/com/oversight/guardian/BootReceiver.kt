package com.oversight.guardian

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService
import androidx.core.content.ContextCompat

/** Restarts the filter after a reboot if the device is enrolled and VPN consent was granted. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!PolicyStore.isEnrolled(context)) return
        // We can only auto-start the VPN if the user previously granted consent.
        if (VpnService.prepare(context) == null) {
            ContextCompat.startForegroundService(context, Intent(context, FilterVpnService::class.java))
        }
        SyncWorker.schedule(context)
    }
}
