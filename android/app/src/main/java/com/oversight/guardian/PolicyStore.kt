package com.oversight.guardian

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persists enrollment + policy in SharedPreferences and answers the core
 * question the VPN asks for every DNS lookup: "should this host be blocked?".
 */
object PolicyStore {
    private const val PREFS = "oversight"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isEnrolled(ctx: Context): Boolean = !deviceToken(ctx).isNullOrEmpty()
    fun deviceToken(ctx: Context): String? = prefs(ctx).getString("deviceToken", null)
    fun deviceName(ctx: Context): String = prefs(ctx).getString("deviceName", "This device") ?: "This device"

    fun apiBase(ctx: Context): String =
        prefs(ctx).getString("apiBase", BuildConfig.DEFAULT_API_BASE) ?: BuildConfig.DEFAULT_API_BASE

    fun saveEnrollment(ctx: Context, apiBase: String, token: String, name: String, policy: JSONObject) {
        prefs(ctx).edit()
            .putString("apiBase", apiBase)
            .putString("deviceToken", token)
            .putString("deviceName", name)
            .putString("policy", policy.toString())
            .apply()
    }

    fun savePolicy(ctx: Context, policy: JSONObject) {
        prefs(ctx).edit().putString("policy", policy.toString()).apply()
    }

    fun policy(ctx: Context): JSONObject =
        try { JSONObject(prefs(ctx).getString("policy", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }

    fun clear(ctx: Context) {
        prefs(ctx).edit().clear().apply()
    }

    fun summary(ctx: Context): String {
        val p = policy(ctx)
        val parts = mutableListOf<String>()
        if (p.optBoolean("filterAdultContent", true)) parts.add("Adult content filtered")
        if (p.optBoolean("blockSocialMedia")) parts.add("Social media blocked")
        if (p.optString("mode") == "allowlist") {
            parts.add("Allow-list mode (${p.optJSONArray("allowedDomains")?.length() ?: 0} sites)")
        } else {
            parts.add("${p.optJSONArray("blockedDomains")?.length() ?: 0} sites blocked")
        }
        return parts.joinToString(" · ")
    }

    // ---- A small built-in adult/social list so the basic switches work even
    // before a categorized feed is configured. The dashboard block-list extends
    // this. (Comprehensive category filtering would use a hosted blocklist.) ----
    private val ADULT_DOMAINS = listOf(
        "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com",
        "redtube.com", "youporn.com", "onlyfans.com", "spankbang.com"
    )
    private val SOCIAL_DOMAINS = listOf(
        "tiktok.com", "instagram.com", "snapchat.com", "facebook.com",
        "x.com", "twitter.com", "reddit.com"
    )

    fun isBlocked(ctx: Context, host: String): Boolean {
        if (host.isEmpty()) return false
        val domain = host.lowercase().removePrefix("www.")
        val p = policy(ctx)
        val allowed = toList(p.optJSONArray("allowedDomains"))

        if (p.optString("mode", "blocklist") == "allowlist") {
            // Only explicitly allowed domains are reachable.
            return !matchesAny(domain, allowed)
        }

        if (matchesAny(domain, allowed)) return false

        val blocked = toList(p.optJSONArray("blockedDomains")).toMutableList()
        if (p.optBoolean("blockSocialMedia")) blocked.addAll(SOCIAL_DOMAINS)
        if (p.optBoolean("filterAdultContent", true)) blocked.addAll(ADULT_DOMAINS)
        return matchesAny(domain, blocked)
    }

    private fun matchesAny(domain: String, list: List<String>): Boolean =
        list.any { d -> domain == d || domain.endsWith(".$d") }

    private fun toList(arr: JSONArray?): List<String> {
        if (arr == null) return emptyList()
        return (0 until arr.length())
            .map { arr.optString(it).trim().lowercase().removePrefix("www.") }
            .filter { it.isNotEmpty() }
    }
}
