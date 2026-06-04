# Oversight

**A content filter for parents — managed entirely from the web.**

Oversight lets a parent protect a child's **iPhone, iPad, or Android** device
without installing anything on the parent's own phone. The parent signs up on
the website, sets the policy in a browser dashboard, and sets up each child
device by opening a short setup link on it. Protection is locked behind the
parent's password so a child can't simply remove it.

```
┌─────────────────────┐      web dashboard      ┌──────────────────────────┐
│  Parent (any browser)│ ───────────────────────▶│  Oversight site + API     │
│  - sign up / log in  │                          │  (static + Netlify funcs) │
│  - set content policy│ ◀───────────────────────│  storage: Netlify Blobs   │
│  - add devices       │      enrollment code     └────────────┬─────────────┘
└─────────────────────┘                                        │
                                                               │ open setup link
                       ┌───────────────────────────────────────┴───────────────┐
                       ▼                                                         ▼
            ┌───────────────────────┐                          ┌───────────────────────────┐
            │  Child iPhone / iPad   │                          │  Child Android device      │
            │  installs a locked     │                          │  installs the guardian app │
            │  Apple config profile  │                          │  (device admin + DNS VPN)  │
            │  (web content filter + │                          │                            │
            │   removal password)    │                          │  uninstall needs password  │
            └───────────────────────┘                          └───────────────────────────┘
```

## What's in this repo

| Path | What it is |
|---|---|
| `public/` | The website: landing page, parent dashboard, login/signup, and the device-side enrollment page. Plain HTML/CSS/JS — no build step. |
| `netlify/functions/` | The API (serverless functions): auth, content policy, devices, enrollment, **iOS profile generation**, and Android sync. |
| `netlify/lib/` | Shared helpers: storage (Netlify Blobs), password hashing, session tokens, and the `.mobileconfig` builder. |
| `android/` | The Android **guardian app** (Kotlin): device-admin + DNS-filtering VPN + password-gated removal. See `android/README.md`. |
| `.github/workflows/` | CI that builds the Android APK. |

## How it works

### Parent side (web only)
1. **Sign up** on the site → creates the parent account.
2. **Set a device-protection password** (separate from the login password).
   This becomes the iOS profile-removal password and the Android removal
   password.
3. **Set the content policy** — adult-content filter, social-media block,
   Safe Search, and custom block / allow lists (or switch to allow-list-only
   mode).
4. **Add a device** → the dashboard issues a short, one-hour **setup code** and
   a link like `https://your-site/enroll?code=XXXXXXXX`.

### Child device side
Open the setup link (or `…/enroll` and type the code) on the child's device.
The page detects the OS:

- **iOS / iPadOS** → downloads a configuration profile from
  `/api/profile`. The profile uses Apple's **BuiltIn web content filter** plus a
  **profile-removal password**, so the child can't delete it without the
  parent's password. (Works on a normal, unsupervised device installed via
  Safari.)
- **Android** → downloads the **guardian app**. After the parent types the
  setup code, the app enrolls, becomes a device administrator, and starts a
  local DNS-filtering VPN. Uninstalling requires the parent's password.

### Keeping policy in sync
- **iOS**: the policy is baked into the profile at install time. Changing the
  policy and re-installing updates it. (A future MDM/APNs integration could push
  live updates — see *Limitations*.)
- **Android**: the app pulls the latest policy from `/api/agent/policy` every
  ~15 minutes and on demand, so dashboard changes propagate automatically.

## Deploy the website

The site is built to run on **Netlify** with zero external services — storage
uses **Netlify Blobs**, which is provided automatically.

1. Connect this repo to Netlify (or `netlify deploy`). `netlify.toml` already
   sets `publish = "public"` and `functions = "netlify/functions"`.
2. No build command is needed. Netlify installs `@netlify/blobs` from
   `package.json` and serves the functions.
3. (Optional) Set an `OVERSIGHT_SECRET` environment variable to a long random
   string. If unset, the app generates and stores one automatically.

Local development:

```bash
npm install
npx netlify dev      # serves the site + functions + Blobs locally
```

### API summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/signup` · `/api/login` · `/api/logout` | cookie | Parent auth |
| GET/PUT | `/api/account` | cookie | Current account; set protection password |
| GET/PUT | `/api/policy` | cookie | Read / update content policy |
| GET/DELETE | `/api/devices` | cookie | List / remove devices |
| POST | `/api/enroll/start` | cookie | Create a setup code |
| GET | `/api/enroll/info?code=` | public | Validate a setup code |
| GET | `/api/profile?code=&name=` | code | **Generate the iOS `.mobileconfig`** |
| GET | `/api/android/config?code=&name=` | code | Complete Android enrollment |
| GET | `/api/agent/policy` | device token | Android policy sync |
| POST | `/api/agent/checkin` | device token | Android heartbeat |
| POST | `/api/agent/verify` | device token | Verify removal password |

## Build the Android app

See **`android/README.md`**. In short: set your site URL in
`android/app/build.gradle`, then let the **Build Android APK** GitHub Action
produce `oversight.apk`, and place it at `public/downloads/oversight.apk` (or
serve the release asset).

## Security notes

- Login passwords are hashed with **scrypt**; sessions are HMAC-signed,
  `HttpOnly`/`Secure`/`SameSite=Lax` cookies.
- The device-protection password must be recoverable to embed it as the iOS
  removal password, so it is stored **encrypted (AES-256-GCM)** at rest, not as
  a one-way hash. The Android removal check never ships the password to the
  device — it's verified server-side.

## Honest limitations

This is a strong, self-hostable foundation, not a turnkey commercial MDM. Be
aware:

- **iOS profile signing:** the generated profile is unsigned, so Safari shows
  it as *"Not Verified."* It still installs and enforces. To show it as
  verified, sign the `.mobileconfig` with an Apple-issued certificate.
- **iOS true lock / live updates:** a removal password protects an unsupervised
  device well. For non-removable enrollment and pushed live policy updates you
  need **device supervision** (Apple Configurator) or a full **MDM server with
  APNs** — a larger project than this repo.
- **App limits, downtime & app-store blocking:** enforced by the **Android**
  guardian app (it needs "Usage access" and "Display over other apps"
  permissions, requested during setup). On iPhone/iPad these are **not possible
  through a Safari-installed profile** — they require supervision/MDM. See
  [docs/ios-advanced-controls.md](docs/ios-advanced-controls.md) for the full
  MDM walkthrough.
- **Android DNS bypass & Settings deactivation:** see `android/README.md`. DNS
  filtering can be bypassed by hardcoded DoH/DoT; full lockdown needs
  **Device Owner** provisioning.
- **Category filtering** currently uses Apple's BuiltIn filter (iOS) and a small
  built-in list plus your custom lists (Android). For exhaustive category
  coverage, point Android at a hosted categorized blocklist.

These trade-offs are documented so you can decide how far to take the
deployment.
