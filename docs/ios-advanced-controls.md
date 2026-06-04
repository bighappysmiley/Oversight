# Advanced controls on iPhone & iPad (the MDM / supervision route)

The Oversight profile you install from Safari can filter web content and lock
its own removal. It **cannot** do app time limits, downtime, or block the App
Store. Those are deliberately reserved by Apple for one of two mechanisms:

1. **Screen Time / Family Sharing** — Apple's own parental controls. No code
   needed, but managed from the parent's Apple device, not from a website.
2. **MDM (Mobile Device Management) on a *supervised* device** — the
   professional route, and the only way a *web dashboard like Oversight* can
   control an iPhone's apps, downtime, and App Store. This document explains it.

---

## What "supervised + MDM" gives you

Once an iPhone/iPad is **supervised** and **enrolled in your MDM**, your server
can push commands and profiles over the air (no cable, no re-install) to:

- Block or hide the **App Store** (`allowAppInstallation`, `allowUIAppInstallation = false`).
- Hide/blacklist specific apps, or run an **allow-list of apps** the child may use.
- Enforce **downtime / web-only windows** by pushing/removing profiles on a schedule.
- Force a **web content filter**, Safe Search, and a global proxy/DNS.
- Make the management profile **truly non-removable**.

These are MDM "restrictions" and "Managed Settings" — far beyond what an
unsupervised Safari-installed profile can do.

> Note: per-app *time limits* (like "1 hour of YouTube") specifically are a
> **Screen Time** feature. MDM can fully block/allow apps and schedule windows,
> but minute-by-minute per-app quotas come from Apple's **Family Controls /
> DeviceActivity** framework, which needs a native iOS app with a special Apple
> entitlement (see the last section). MDM covers downtime and App-Store blocking
> cleanly; true per-app minute quotas on iOS are the hardest piece.

---

## The two ingredients

### 1. Supervision
Supervision marks the device as organization-owned. Options:

- **Apple Configurator** (free Mac app): plug the iPhone into a Mac, erase it,
  and supervise it. Best for a device you physically own (your child's). ~10
  minutes per device. No company needed.
- **Automated Device Enrollment (ADE)** via **Apple Business/School Manager**:
  devices bought through Apple/authorized resellers auto-supervise on setup.
  This is for organizations, not typical families.

For a parent, **Apple Configurator on a borrowed/owned Mac** is the realistic
path to supervise the child's iPhone once.

### 2. An MDM server + an APNs certificate
MDM talks to devices through **Apple Push Notification service (APNs)**. You
need an **MDM Push Certificate** from Apple's *Apple Push Certificates Portal*
(free, needs an Apple ID). To *get* that certificate signed you need a "vendor"
signing certificate, which in practice means:

- **Run an existing open-source MDM** that handles the protocol and cert flow
  for you (recommended), or
- Use a **commercial MDM** and point it at Oversight, or
- Build the MDM protocol yourself (largest effort).

---

## Recommended path for Oversight

You do **not** need to implement the MDM protocol from scratch. Stand up a
proven open-source MDM and let Oversight be the policy brain that drives it.

### Option A — Self-hosted open-source MDM (most control, free software)
Good choices:

- **MicroMDM** (https://github.com/micromdm/micromdm) — lightweight, battle-tested.
- **NanoMDM** (https://github.com/micromdm/nanomdm) — minimal, scalable core.
- **Fleet** (https://fleetdm.com) — full UI + MDM, heavier.

High-level steps:
1. Get a domain + HTTPS server (a small VPS).
2. Generate an **APNs MDM push certificate** via the Apple Push Certificates
   Portal (the MDM project's docs walk you through the signing-request flow).
3. Run MicroMDM/NanoMDM with that cert.
4. **Supervise** the child's iPhone with Apple Configurator and enroll it into
   your MDM (Configurator can drop in the enrollment profile).
5. From **Oversight**, call the MDM's API to push restriction profiles
   (App-Store block, app allow-list, content filter) and schedule downtime by
   pushing/removing a "downtime" profile via cron.

Integration with this repo: add an `mdm` module with a server-side function
(e.g. `netlify/functions/mdm-push.js`) that, when a parent saves a policy for a
*supervised iOS device*, builds the corresponding **MDM restriction profile**
(reusing `netlify/lib/mobileconfig.js`) and POSTs it to your MicroMDM
`/v1/commands` endpoint (InstallProfile / RemoveProfile). The dashboard would
mark such devices as "Supervised (MDM)" and expose the app/downtime controls
for them.

### Option B — Commercial MDM (least effort, paid)
Services like **Jamf Now**, **Mosyle** (has a free tier for small fleets),
**Hexnode**, **Scalefusion**, or **SimpleMDM** give you APNs + supervision
tooling + an API. You still supervise the device once (Configurator or ADE),
then use the vendor API from Oversight to push restrictions. Mosyle/SimpleMDM
are the friendliest for a handful of family devices, and several have free or
cheap small-fleet tiers.

### Option C — Build the MDM protocol yourself
Implement the Apple MDM check-in/command protocol + APNs directly. This is a
multi-week effort and you still need the Apple push cert. Only worth it if you
want zero external dependencies. NanoMDM's source is the best reference.

---

## Cost & effort summary

| Path | One-time setup | Ongoing cost | Difficulty | Per-app minute limits? |
|---|---|---|---|---|
| Screen Time (no code) | none | free | easy, but not web-managed | yes (Apple) |
| Self-hosted MDM (A) | Mac for supervision + VPS + APNs cert | ~$5/mo VPS | high | no (needs Family Controls app) |
| Commercial MDM (B) | Mac for supervision | free–$ per device | medium | no (needs Family Controls app) |
| DIY MDM protocol (C) | everything in A + protocol code | ~$5/mo VPS | very high | no |

## The one piece MDM can't do: per-app minute quotas

If you specifically need "30 minutes of TikTok per day" on iPhone, that requires
a **native iOS app** using Apple's **Family Controls / ManagedSettings /
DeviceActivity** frameworks and the **Family Controls (Distribution)
entitlement**, which you request from Apple. That app would pair with Oversight
the way the Android guardian app does. It's the iOS equivalent of the Android
app in this repo — a separate, sizeable native project, and Apple gates the
entitlement.

---

## TL;DR recommendation

- **Today:** keep using the Safari web-filter profile for iPhones (web content
  control + locked removal). Use the **Android guardian app** for full
  app/downtime/store controls.
- **For real iPhone app + downtime + App-Store control:** supervise the child's
  iPhone once with **Apple Configurator**, run **MicroMDM** (or a cheap
  commercial MDM like **Mosyle/SimpleMDM**), and have Oversight push restriction
  profiles to it. I can scaffold the `mdm-push` integration in this repo when
  you've picked an MDM.
- **For per-app minute limits on iPhone:** that needs a native Family Controls
  app + Apple entitlement — the biggest piece, planned separately.
