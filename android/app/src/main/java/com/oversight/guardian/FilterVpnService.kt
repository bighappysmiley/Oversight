package com.oversight.guardian

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

/**
 * A local VPN that only routes DNS to a virtual server, inspects each query,
 * and either forwards it to a real upstream resolver or answers NXDOMAIN when
 * the requested host is blocked by the policy. Non-DNS traffic is untouched.
 *
 * Note: apps that use hardcoded DNS-over-HTTPS/TLS can bypass DNS filtering.
 * The iOS profile's built-in content filter does not have this limitation; see
 * the project README for the trade-offs.
 */
class FilterVpnService : VpnService() {

    private var vpn: ParcelFileDescriptor? = null
    @Volatile private var running = false
    private var worker: Thread? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopFilter()
            stopSelf()
            return START_NOT_STICKY
        }
        startForegroundNotification()
        if (!running) startFilter()
        return START_STICKY
    }

    private fun startFilter() {
        val builder = Builder()
            .setSession("Oversight")
            .addAddress(VIRTUAL_ADDR, 32)
            .addDnsServer(VIRTUAL_DNS)
            .addRoute(VIRTUAL_DNS, 32)
            .setMtu(1500)
        vpn = try {
            builder.establish()
        } catch (e: Exception) {
            null
        } ?: return

        running = true
        worker = Thread { loop() }.also { it.start() }
    }

    private fun stopFilter() {
        running = false
        worker?.interrupt()
        worker = null
        try { vpn?.close() } catch (_: Exception) {}
        vpn = null
    }

    private fun loop() {
        val fd = vpn ?: return
        val input = FileInputStream(fd.fileDescriptor)
        val output = FileOutputStream(fd.fileDescriptor)
        val packet = ByteArray(32767)
        while (running) {
            val len = try { input.read(packet) } catch (e: Exception) { break }
            if (len <= 0) continue
            try { handlePacket(packet, len, output) } catch (_: Exception) { /* skip malformed */ }
        }
    }

    private fun handlePacket(packet: ByteArray, len: Int, out: FileOutputStream) {
        if (len < 28) return
        if ((packet[0].toInt() and 0xf0) shr 4 != 4) return       // IPv4 only
        val ihl = (packet[0].toInt() and 0x0f) * 4
        if (packet[9].toInt() and 0xff != 17) return              // UDP only
        if (len < ihl + 8) return

        val srcIp = packet.copyOfRange(12, 16)
        val dstIp = packet.copyOfRange(16, 20)
        val srcPort = ((packet[ihl].toInt() and 0xff) shl 8) or (packet[ihl + 1].toInt() and 0xff)
        val dstPort = ((packet[ihl + 2].toInt() and 0xff) shl 8) or (packet[ihl + 3].toInt() and 0xff)
        if (dstPort != 53) return

        val dnsStart = ihl + 8
        if (dnsStart >= len) return
        val dns = packet.copyOfRange(dnsStart, len)
        val host = parseQName(dns)

        val responseDns = if (host.isNotEmpty() && PolicyStore.isBlocked(this, host)) {
            buildNxDomain(dns)
        } else {
            forwardDns(dns) ?: return
        }
        // Response travels from the DNS server back to the device: swap addr/port.
        writeUdpPacket(out, dstIp, srcIp, dstPort, srcPort, responseDns)
    }

    private fun forwardDns(query: ByteArray): ByteArray? {
        return try {
            DatagramSocket().use { socket ->
                protect(socket)
                socket.soTimeout = 5000
                val upstream = InetAddress.getByName(PolicyStore.upstreamDns(this@FilterVpnService))
                socket.send(DatagramPacket(query, query.size, upstream, 53))
                val buf = ByteArray(4096)
                val reply = DatagramPacket(buf, buf.size)
                socket.receive(reply)
                buf.copyOf(reply.length)
            }
        } catch (e: Exception) {
            null
        }
    }

    // ---- DNS helpers ----
    private fun parseQName(dns: ByteArray): String {
        val sb = StringBuilder()
        var pos = 12
        while (pos < dns.size) {
            val labelLen = dns[pos].toInt() and 0xff
            if (labelLen == 0) break
            if ((labelLen and 0xc0) != 0) break // compression pointer; ignore for queries
            if (pos + 1 + labelLen > dns.size) break
            if (sb.isNotEmpty()) sb.append('.')
            sb.append(String(dns, pos + 1, labelLen, Charsets.US_ASCII))
            pos += labelLen + 1
        }
        return sb.toString().lowercase()
    }

    private fun questionEnd(dns: ByteArray): Int {
        var pos = 12
        while (pos < dns.size) {
            val labelLen = dns[pos].toInt() and 0xff
            if (labelLen == 0) { pos += 1; break }
            pos += labelLen + 1
        }
        return (pos + 4).coerceAtMost(dns.size) // + QTYPE + QCLASS
    }

    private fun buildNxDomain(query: ByteArray): ByteArray {
        val resp = query.copyOf(questionEnd(query))
        resp[2] = (resp[2].toInt() or 0x80).toByte() // QR = 1 (response)
        resp[3] = 0x83.toByte()                       // RA = 1, RCODE = 3 (NXDOMAIN)
        // Zero the answer/authority/additional counts; keep QDCOUNT.
        resp[6] = 0; resp[7] = 0
        resp[8] = 0; resp[9] = 0
        resp[10] = 0; resp[11] = 0
        return resp
    }

    private fun writeUdpPacket(
        out: FileOutputStream,
        srcIp: ByteArray, dstIp: ByteArray,
        srcPort: Int, dstPort: Int,
        payload: ByteArray
    ) {
        val total = 20 + 8 + payload.size
        val buf = ByteArray(total)
        // IPv4 header
        buf[0] = 0x45.toByte()              // version 4, IHL 5
        buf[2] = (total shr 8).toByte(); buf[3] = total.toByte()
        buf[8] = 64                          // TTL
        buf[9] = 17                          // protocol UDP
        System.arraycopy(srcIp, 0, buf, 12, 4)
        System.arraycopy(dstIp, 0, buf, 16, 4)
        val ipck = checksum(buf, 0, 20)
        buf[10] = (ipck shr 8).toByte(); buf[11] = ipck.toByte()
        // UDP header (checksum 0 is allowed over IPv4)
        val u = 20
        buf[u] = (srcPort shr 8).toByte(); buf[u + 1] = srcPort.toByte()
        buf[u + 2] = (dstPort shr 8).toByte(); buf[u + 3] = dstPort.toByte()
        val udpLen = 8 + payload.size
        buf[u + 4] = (udpLen shr 8).toByte(); buf[u + 5] = udpLen.toByte()
        System.arraycopy(payload, 0, buf, u + 8, payload.size)
        out.write(buf, 0, total)
        out.flush()
    }

    private fun checksum(data: ByteArray, offset: Int, length: Int): Int {
        var sum = 0L
        var i = offset
        var remaining = length
        while (remaining > 1) {
            sum += (((data[i].toInt() and 0xff) shl 8) or (data[i + 1].toInt() and 0xff)).toLong()
            i += 2; remaining -= 2
        }
        if (remaining > 0) sum += ((data[i].toInt() and 0xff) shl 8).toLong()
        while ((sum shr 16) != 0L) sum = (sum and 0xffff) + (sum shr 16)
        return (sum.inv() and 0xffff).toInt()
    }

    private fun startForegroundNotification() {
        val nm = getSystemService(NotificationManager::class.java)!!
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Oversight Protection", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val notif = NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("Oversight protection active")
            .setContentText("Web content filtering is on for this device.")
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
        stopFilter()
        super.onDestroy()
    }

    companion object {
        const val ACTION_STOP = "com.oversight.guardian.STOP"
        private const val VIRTUAL_ADDR = "10.111.111.2"
        private const val VIRTUAL_DNS = "10.111.111.1"
        private const val CHANNEL = "oversight_vpn"
        private const val NOTIF_ID = 42
    }
}
