# Oversight Apple apps

There are two pieces here:

1. **`macos-app/` — the double‑click Mac app (no Xcode needed).** An AppleScript
   app that asks for the setup code, then installs the syncing agent using the
   standard macOS admin‑password prompt. **CI builds it for you** on a macOS
   runner (`.github/workflows/build-mac-app.yml`) and produces `Oversight-Mac.zip`
   as a build artifact (and a release asset on a `v*` tag). Drop that zip at
   `public/downloads/Oversight-Mac.zip` so the site can serve it.
   - To build locally on a Mac: `cd apple/macos-app && osacompile -o Oversight.app oversight.applescript && cp install-agent.sh Oversight.app/Contents/Resources/`.
   - Unsigned apps trigger Gatekeeper — first launch is **right‑click → Open**.
     Signing/notarizing with an Apple Developer ID removes that warning.

2. **The SwiftUI Xcode project (below)** — a native starting point if you want a
   richer app (and a future Network Extension for app‑level enforcement).

---

# Oversight SwiftUI app (iOS + macOS)

A native SwiftUI app you can open in **Xcode** and build into a real `.app`
(macOS) or `.ipa` (iOS/iPadOS). It pairs the device with a parent account by
installing the Oversight **configuration profile** (web content filter + Safe
DNS) — the profile is what enforces filtering, and this app makes installing it
one tap.

This is the foundation for deeper, native enforcement (a Network Extension that
filters app traffic / DNS directly); see *Next steps*.

## Build it

You'll need a Mac with **Xcode** and **[XcodeGen](https://github.com/yonaskolb/XcodeGen)**.

```bash
brew install xcodegen
cd apple
xcodegen generate
open Oversight.xcodeproj
```

In Xcode:
1. Select the **Oversight** target → **Signing & Capabilities** → choose your
   Apple Developer **Team** (free personal team works for local installs).
2. Pick a scheme — **Oversight (iOS)** or **Oversight (macOS)**.
3. **Build & Run** (⌘R). On iOS, run on a real device to install on it.

Set the **Server URL** field in the app to your deployed Oversight site
(e.g. `https://your-site.netlify.app`), enter the setup code from your
dashboard, and tap **Install protection**.

> No XcodeGen? You can instead create a new multiplatform SwiftUI app in Xcode
> and drop in the two files from `apple/Oversight/`.

## Next steps (native enforcement)

The config profile already filters web content + DNS. To enforce at the app
level (block specific apps, screen-time limits on iOS, system-wide content
filtering on macOS) you'd add an Xcode **target** using Apple's
**Network Extension** (`NEFilterDataProvider` / `NEDNSProxyProvider`) and/or
**Family Controls** (`ManagedSettings` / `DeviceActivity`). Those require
requesting the matching **entitlements** from Apple. The `docs/ios-advanced-controls.md`
file in the repo root explains the supervision/MDM route for fleet-wide control.
