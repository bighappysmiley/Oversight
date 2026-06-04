# Keep the device admin receiver and VPN service (referenced from the manifest).
-keep class com.oversight.guardian.OversightAdminReceiver { *; }
-keep class com.oversight.guardian.FilterVpnService { *; }
-keep class com.oversight.guardian.BootReceiver { *; }
