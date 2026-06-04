package com.oversight.guardian

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Minimal JSON HTTP client (no third-party dependencies). Call off the UI thread. */
object ApiClient {
    data class Result(val code: Int, val body: JSONObject?) {
        val ok: Boolean get() = code in 200..299
    }

    fun enroll(apiBase: String, code: String, name: String): Result =
        get("${apiBase.trimEnd('/')}/api/android/config?code=${enc(code)}&name=${enc(name)}", null)

    fun fetchPolicy(apiBase: String, token: String): Result =
        get("${apiBase.trimEnd('/')}/api/agent/policy", token)

    fun checkin(apiBase: String, token: String): Result =
        post("${apiBase.trimEnd('/')}/api/agent/checkin", token, JSONObject())

    fun verify(apiBase: String, token: String, password: String): Result =
        post("${apiBase.trimEnd('/')}/api/agent/verify", token, JSONObject().put("password", password))

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private fun get(urlStr: String, token: String?): Result {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        token?.let { conn.setRequestProperty("X-Device-Token", it) }
        return read(conn)
    }

    private fun post(urlStr: String, token: String?, body: JSONObject): Result {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        conn.setRequestProperty("Content-Type", "application/json")
        token?.let { conn.setRequestProperty("X-Device-Token", it) }
        conn.outputStream.use { it.write(body.toString().toByteArray()) }
        return read(conn)
    }

    private fun read(conn: HttpURLConnection): Result {
        return try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            val json = if (text.isNotBlank()) runCatching { JSONObject(text) }.getOrNull() else null
            Result(code, json)
        } catch (e: Exception) {
            Result(-1, null)
        } finally {
            conn.disconnect()
        }
    }
}
