package com.oversight.guardian

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import org.json.JSONArray
import org.json.JSONObject

/** Collects the launchable apps on the device and reports them to the server so
 *  the parent can pick which to block or limit by name. */
object AppInventory {

    fun launchableApps(ctx: Context): List<Pair<String, String>> {
        val pm = ctx.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolved = pm.queryIntentActivities(intent, 0)
        val seen = HashSet<String>()
        val out = ArrayList<Pair<String, String>>()
        for (ri in resolved) {
            val pkg = ri.activityInfo.packageName ?: continue
            if (pkg == ctx.packageName) continue
            if (seen.add(pkg)) {
                val label = runCatching { ri.loadLabel(pm).toString() }.getOrDefault(pkg)
                out.add(pkg to label)
            }
        }
        return out.sortedBy { it.second.lowercase() }
    }

    /** Reports apps to the server. Safe to call from a background thread. */
    fun report(ctx: Context) {
        if (!PolicyStore.isEnrolled(ctx)) return
        val token = PolicyStore.deviceToken(ctx) ?: return
        val arr = JSONArray()
        for ((pkg, label) in launchableApps(ctx)) {
            arr.put(JSONObject().put("pkg", pkg).put("label", label))
        }
        ApiClient.reportApps(PolicyStore.apiBase(ctx), token, JSONObject().put("apps", arr))
    }

    fun isSystemApp(ctx: Context, pkg: String): Boolean {
        return try {
            val info = ctx.packageManager.getApplicationInfo(pkg, 0)
            val mask = android.content.pm.ApplicationInfo.FLAG_SYSTEM or
                android.content.pm.ApplicationInfo.FLAG_UPDATED_SYSTEM_APP
            (info.flags and mask) != 0
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }
}
