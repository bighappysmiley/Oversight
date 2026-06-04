package com.oversight.guardian

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/** Periodically pulls the latest policy from the server and sends a heartbeat. */
class SyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val ctx = applicationContext
        if (!PolicyStore.isEnrolled(ctx)) return Result.success()
        val base = PolicyStore.apiBase(ctx)
        val token = PolicyStore.deviceToken(ctx) ?: return Result.success()

        val res = ApiClient.fetchPolicy(base, token)
        res.body?.optJSONObject("policy")?.let { PolicyStore.savePolicy(ctx, it) }
        ApiClient.checkin(base, token)
        // Keep the parent's app list fresh.
        runCatching { AppInventory.report(ctx) }
        return Result.success()
    }

    companion object {
        fun schedule(ctx: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
                )
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                "oversight-sync",
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
        }

        fun cancel(ctx: Context) {
            WorkManager.getInstance(ctx).cancelUniqueWork("oversight-sync")
        }
    }
}
