# Downloads

Files the setup page (`/enroll`) links to:

| File | Platform | Produced by |
|---|---|---|
| `oversight.apk` | Android app | `.github/workflows/build-android.yml` (artifact / release) |
| `Oversight-Mac.zip` | Mac app (double‑click) | `.github/workflows/build-mac-app.yml` (artifact / release) |
| `oversight-windows-dns.bat` | Windows Safe DNS helper | committed here |
| `oversight-linux-dns.sh` | Linux Safe DNS helper | committed here |
| `oversight-mac-agent.command` | Mac agent (Terminal — advanced) | committed here |

The **APK** and **Mac app** are built in CI (binaries aren't committed). Download
the build artifact (or release asset) and drop it here as `oversight.apk` /
`Oversight-Mac.zip` so Netlify serves it. The `.bat`/`.sh`/`.command` helpers are
plain text and committed directly.
