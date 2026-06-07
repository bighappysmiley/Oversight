# Oversight Apple app (iOS + macOS)

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
