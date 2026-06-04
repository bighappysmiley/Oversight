package com.oversight.guardian

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var setupGroup: LinearLayout
    private lateinit var statusGroup: LinearLayout
    private lateinit var codeInput: EditText
    private lateinit var nameInput: EditText
    private lateinit var serverInput: EditText
    private lateinit var enrollButton: Button
    private lateinit var progress: ProgressBar
    private lateinit var setupError: TextView
    private lateinit var statusText: TextView
    private lateinit var policySummary: TextView
    private lateinit var removeButton: Button
    private lateinit var reapplyButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        setupGroup = findViewById(R.id.setupGroup)
        statusGroup = findViewById(R.id.statusGroup)
        codeInput = findViewById(R.id.codeInput)
        nameInput = findViewById(R.id.nameInput)
        serverInput = findViewById(R.id.serverInput)
        enrollButton = findViewById(R.id.enrollButton)
        progress = findViewById(R.id.progress)
        setupError = findViewById(R.id.setupError)
        statusText = findViewById(R.id.statusText)
        policySummary = findViewById(R.id.policySummary)
        removeButton = findViewById(R.id.removeButton)
        reapplyButton = findViewById(R.id.reapplyButton)

        enrollButton.setOnClickListener { doEnroll() }
        removeButton.setOnClickListener { promptRemove() }
        reapplyButton.setOnClickListener { reapply() }

        maybeRequestNotificationPermission()
        render()
    }

    private fun render() {
        val enrolled = PolicyStore.isEnrolled(this)
        setupGroup.visibility = if (enrolled) View.GONE else View.VISIBLE
        statusGroup.visibility = if (enrolled) View.VISIBLE else View.GONE
        if (enrolled) {
            statusText.text = "Protection active on “${PolicyStore.deviceName(this)}”"
            policySummary.text = PolicyStore.summary(this)
        }
    }

    // ---------- enrollment ----------
    private fun doEnroll() {
        val code = codeInput.text.toString().trim().uppercase()
        val name = nameInput.text.toString().trim().ifEmpty { Build.MODEL ?: "Android device" }
        val override = serverInput.text.toString().trim()
        val base = if (override.isNotEmpty()) override else BuildConfig.DEFAULT_API_BASE

        if (code.length < 6) {
            showError("Enter the full setup code from the dashboard.")
            return
        }
        setLoading(true)
        Thread {
            val res = ApiClient.enroll(base, code, name)
            runOnUiThread {
                setLoading(false)
                val body = res.body
                if (res.ok && body?.optBoolean("ok") == true) {
                    PolicyStore.saveEnrollment(
                        this,
                        body.optString("apiBase", base),
                        body.optString("deviceToken"),
                        body.optString("name", name),
                        body.optJSONObject("policy") ?: JSONObject()
                    )
                    SyncWorker.schedule(this)
                    startAdminThenVpn()
                } else {
                    showError(body?.optString("error").takeUnless { it.isNullOrEmpty() }
                        ?: "Could not set up. Check the code and your connection.")
                }
            }
        }.start()
    }

    private fun startAdminThenVpn() {
        val admin = ComponentName(this, OversightAdminReceiver::class.java)
        val dpm = getSystemService(DevicePolicyManager::class.java)!!
        if (!dpm.isAdminActive(admin)) {
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
                .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin)
                .putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, getString(R.string.admin_explanation))
            startActivityForResult(intent, REQ_ADMIN)
        } else {
            prepareVpn()
        }
    }

    private fun prepareVpn() {
        val intent = VpnService.prepare(this)
        if (intent != null) startActivityForResult(intent, REQ_VPN) else startVpn()
    }

    private fun startVpn() {
        ContextCompat.startForegroundService(this, Intent(this, FilterVpnService::class.java))
        render()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQ_ADMIN -> prepareVpn() // proceed even if the parent skips admin
            REQ_VPN -> if (resultCode == RESULT_OK) startVpn() else render()
        }
    }

    // ---------- ongoing ----------
    private fun reapply() {
        val base = PolicyStore.apiBase(this)
        val token = PolicyStore.deviceToken(this)
        if (token != null) {
            Thread {
                val r = ApiClient.fetchPolicy(base, token)
                r.body?.optJSONObject("policy")?.let { PolicyStore.savePolicy(this, it) }
                runOnUiThread { render() }
            }.start()
        }
        prepareVpn()
    }

    // ---------- removal (password gated) ----------
    private fun promptRemove() {
        val input = EditText(this).apply {
            hint = "Parent protection password"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        AlertDialog.Builder(this)
            .setTitle("Remove protection")
            .setMessage("Enter the parent's protection password to remove Oversight from this device.")
            .setView(input)
            .setPositiveButton("Remove") { _, _ -> verifyAndRemove(input.text.toString()) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun verifyAndRemove(password: String) {
        val base = PolicyStore.apiBase(this)
        val token = PolicyStore.deviceToken(this) ?: return
        Thread {
            val res = ApiClient.verify(base, token, password)
            val ok = res.ok && res.body?.optBoolean("ok") == true
            runOnUiThread {
                if (ok) doRemove()
                else Toast.makeText(this, "Incorrect password.", Toast.LENGTH_LONG).show()
            }
        }.start()
    }

    private fun doRemove() {
        startService(Intent(this, FilterVpnService::class.java).apply { action = FilterVpnService.ACTION_STOP })
        val dpm = getSystemService(DevicePolicyManager::class.java)!!
        val admin = ComponentName(this, OversightAdminReceiver::class.java)
        if (dpm.isAdminActive(admin)) dpm.removeActiveAdmin(admin)
        SyncWorker.cancel(this)
        PolicyStore.clear(this)
        Toast.makeText(this, "Protection removed. You can now uninstall Oversight.", Toast.LENGTH_LONG).show()
        render()
    }

    // ---------- helpers ----------
    private fun setLoading(loading: Boolean) {
        progress.visibility = if (loading) View.VISIBLE else View.GONE
        enrollButton.isEnabled = !loading
        if (loading) setupError.visibility = View.GONE
    }

    private fun showError(message: String) {
        setupError.text = message
        setupError.visibility = View.VISIBLE
    }

    private fun maybeRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF)
        }
    }

    companion object {
        private const val REQ_ADMIN = 1001
        private const val REQ_VPN = 1002
        private const val REQ_NOTIF = 1003
    }
}
