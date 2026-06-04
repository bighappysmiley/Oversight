# Oversight Android guardian app

The app a parent installs on a child's **Android** device. It:

- enrolls the device with a parent account using the 8-character setup code,
- registers as a **device administrator** (so it can't be uninstalled without
  being deactivated first),
- runs a local **VPN that filters DNS** to block sites per the parent's policy,
- syncs the policy from the server every ~15 minutes (and on demand), and
- only lets itself be removed after the parent's **protection password** is
  verified by the server.

The parent never installs anything on their own phone — they manage everything
from the website dashboard.

## Configure the server URL

Before building, set your deployed site URL in `app/build.gradle`:

```gradle
buildConfigField "String", "DEFAULT_API_BASE", "\"https://your-site.netlify.app\""
```

(Parents can also paste a server URL in the app's *advanced* field at setup
time, but the default makes setup one-tap.)

## Build the APK

### In CI (recommended)

Push to `main` (or run the **Build Android APK** workflow manually). The
workflow in `.github/workflows/build-android.yml` produces `oversight.apk` as a
downloadable artifact, and attaches it to a GitHub Release when you push a `v*`
tag.

Download the artifact and either:
- drop it at `public/downloads/oversight.apk` so the enrollment page can serve
  it, or
- distribute the GitHub Release asset link.

### Locally

Requires JDK 17 and the Android SDK.

```bash
cd android
gradle assembleDebug        # or ./gradlew if you generate a wrapper
# output: app/build/outputs/apk/debug/app-debug.apk
```

> The committed project has no Gradle wrapper jar (binaries aren't checked in).
> Run `gradle wrapper --gradle-version 8.7` once to generate it, or just use a
> locally installed Gradle 8.7+ as shown above. CI installs Gradle for you.

## App & time controls

Beyond web filtering, the app enforces (set per device in the dashboard):

- **App blocking** — fully block chosen apps.
- **Daily app time limits** — e.g. 30 min/day of a game; the app overlays a
  "time's up" screen when the limit is hit.
- **Downtime** — block apps during a daily window.
- **App-store blocking** — block the Play Store so no new apps can be installed.

These use a foreground-app monitor (`AppGuardService`) plus a full-screen
overlay, which require two permissions the parent grants once during setup:

- **Usage access** (`Settings → Usage access`) — to see the foreground app and
  per-app usage time.
- **Display over other apps** — to show the block screen.

The setup screen shows "Allow…" buttons until both are granted.

## How removal is protected

Android blocks uninstalling an **active device-administrator** app until admin
is deactivated. The in-app *Remove protection* button asks for the parent's
protection password and verifies it against the server before deactivating
admin and stopping the filter.

## Honest limitations (non-rooted, sideloaded app)

- **DoH/DoT bypass:** apps with hardcoded DNS-over-HTTPS/TLS (or a user-set
  Private DNS) can bypass DNS filtering. The iOS profile's built-in content
  filter is more robust here.
- **Settings deactivation:** a knowledgeable user could open *Settings → Device
  admin apps* and deactivate Oversight without the in-app password. Truly
  preventing this requires provisioning the app as **Device Owner** (factory
  reset + `adb`/QR provisioning), which is out of scope for a simple sideload.
  The README in the repo root explains this path.
- **Category filtering** uses a small built-in adult/social list plus the
  parent's block-list. A production deployment would point at a hosted,
  categorized blocklist feed.
