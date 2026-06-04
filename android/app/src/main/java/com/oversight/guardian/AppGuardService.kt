package com.oversight.guardian

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import java.util.Calendar

/**
 * Watches the foreground app and covers it with a full-screen overlay when the
 * policy says it should be blocked: explicit block list, App Store block, daily
 * time limit reached, or downtime. Requires Usage Access + "Display over other
 * apps" permissions (requested during setup).
 */
class AppGuardService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var overlayView: View? = null
    @Volatile private var running = false

    private val tick = object : Runnable {
        override fun run() {
            try { evaluate() } catch (_: Exception) {}
            if (running) handler.postDelayed(this, INTERVAL_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopGuard()
            stopSelf()
            return START_NOT_STICKY
        }
        startForegroundNotification()
        if (!running) {
            running = true
            handler.post(tick)
        }
        return START_STICKY
    }

    private fun stopGuard() {
        running = false
        handler.removeCallbacks(tick)
        hideOverlay()
    }

    private fun evaluate() {
        if (!PolicyStore.isEnrolled(this)) { hideOverlay(); return }
        val pkg = currentForegroundApp() ?: return
        if (pkg == packageName || pkg == launcherPackage()) { hideOverlay(); return }
        val reason = blockReason(pkg)
        if (reason != null) showOverlay(reason) else hideOverlay()
    }

    private fun blockReason(pkg: String): String? {
        if (PolicyStore.isAppListed(this, pkg)) return "This app is blocked."
        if (PolicyStore.blockAppStore(this) && PolicyStore.storePackages().contains(pkg)) {
            return "The app store is blocked."
        }
        val limit = PolicyStore.appLimitMinutes(this, pkg)
        if (limit in 0..1440 && todayMinutes(pkg) >= limit) return "Daily time limit reached."
        if (PolicyStore.downtimeActive(this) && !AppInventory.isSystemApp(this, pkg)) {
            return "It's downtime. Apps are paused."
        }
        return null
    }

    private fun currentForegroundApp(): String? {
        val usm = getSystemService(UsageStatsManager::class.java) ?: return null
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(now - 10_000, now)
        var pkg: String? = null
        val e = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            if (e.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
                e.eventType == UsageEvents.Event.ACTIVITY_RESUMED
            ) {
                pkg = e.packageName
            }
        }
        return pkg
    }

    private fun todayMinutes(pkg: String): Int {
        val usm = getSystemService(UsageStatsManager::class.java) ?: return 0
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        val stats = usm.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, cal.timeInMillis, System.currentTimeMillis()
        ) ?: return 0
        var total = 0L
        for (s in stats) if (s.packageName == pkg) total += s.totalTimeInForeground
        return (total / 60000L).toInt()
    }

    private fun launcherPackage(): String? {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        return packageManager.resolveActivity(intent, 0)?.activityInfo?.packageName
    }

    // ---- overlay ----
    private fun showOverlay(reason: String) {
        if (overlayView != null) {
            (overlayView?.findViewById<TextView>(REASON_ID))?.text = reason
            return
        }
        if (!Settings.canDrawOverlays(this)) return
        val wm = getSystemService(WindowManager::class.java) ?: return
        val view = buildOverlay(reason)
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.OPAQUE
        )
        try {
            wm.addView(view, params)
            overlayView = view
        } catch (_: Exception) {}
    }

    private fun hideOverlay() {
        val v = overlayView ?: return
        overlayView = null
        try { getSystemService(WindowManager::class.java)?.removeView(v) } catch (_: Exception) {}
    }

    private fun buildOverlay(reason: String): View {
        val dp = resources.displayMetrics.density
        val pad = (28 * dp).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0F1226"))
            setPadding(pad, pad, pad, pad)
            isClickable = true
            isFocusable = true
        }
        root.addView(TextView(this).apply {
            text = "Blocked by Oversight"
            setTextColor(Color.WHITE)
            textSize = 24f
            gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            id = REASON_ID
            text = reason
            setTextColor(Color.parseColor("#C4C8EF"))
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(0, (12 * dp).toInt(), 0, (24 * dp).toInt())
        })
        root.addView(Button(this).apply {
            text = "Go to home screen"
            setOnClickListener {
                startActivity(Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                })
            }
        })
        return root
    }

    private fun startForegroundNotification() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm?.createNotificationChannel(
                NotificationChannel(CHANNEL, "Oversight App Guard", NotificationManager.IMPORTANCE_MIN)
            )
        }
        val notif = NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("Oversight is protecting this device")
            .setContentText("App limits and downtime are active.")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    override fun onDestroy() {
        stopGuard()
        super.onDestroy()
    }

    companion object {
        const val ACTION_STOP = "com.oversight.guardian.GUARD_STOP"
        private const val INTERVAL_MS = 1200L
        private const val CHANNEL = "oversight_guard"
        private const val NOTIF_ID = 43
        private const val REASON_ID = 0x7f5a0001
    }
}
