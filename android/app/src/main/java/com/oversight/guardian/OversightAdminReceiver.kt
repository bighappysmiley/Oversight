package com.oversight.guardian

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/**
 * Registering as a device administrator means Android won't let the app be
 * uninstalled until admin is deactivated. Our UI gates deactivation behind the
 * parent's protection password (verified by the server).
 */
class OversightAdminReceiver : DeviceAdminReceiver() {
    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Oversight protection is active. Removing it requires the parent's protection password."
    }
}
