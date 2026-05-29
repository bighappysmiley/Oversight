# Oversight

> **Oversight** gives parents complete control over their child's digital life — block websites across every browser, set app limits, restrict video content, and monitor app and web usage, all from your phone.

## Architecture

```
oversight/
├── backend/        Node.js + Express + SQLite API
├── pwa/            React + Vite Progressive Web App (parent dashboard)
└── mac-agent/      Python daemons running on the child's device
    ├── agent.py            macOS agent
    ├── agent_windows.py    Windows agent
    └── agent_linux.py      Linux agent
```

---

## Quick Start

### 1. Backend

```bash
cd backend
npm install
# Optional: set environment variables
export PORT=3001
export JWT_SECRET=change-this-in-production
node src/index.js
```

The API runs on `http://localhost:3001`. The SQLite database is created automatically at `backend/oversight.db`.

### 2. Parent PWA

```bash
cd pwa
npm install
npm run dev          # dev server with HMR at http://localhost:5173
npm run build        # production build in pwa/dist/
```

Deploy `pwa/dist/` to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

In production, set the Vite proxy target to your backend URL, or set `VITE_API_BASE` and update `pwa/src/lib/api.js`.

### 3. Child Agent

All agents share the same config format and `--pair` / `--install` / `--uninstall` / `--dry-run` flags.

#### macOS

**Prerequisites:** Python 3.9+, `pip3 install requests`

```bash
python3 mac-agent/agent.py --pair     # pair with parent account
sudo python3 mac-agent/agent.py --install   # install as LaunchDaemon
sudo python3 mac-agent/agent.py --uninstall # remove
python3 mac-agent/agent.py --dry-run        # monitor only, no enforcement
```

Or use the one-line installer:

```bash
curl -fsSL https://your-server.com/install.sh | sudo bash
```

#### Windows

**Prerequisites:** Python 3.9+, `pip install requests psutil pywin32`

Run PowerShell as Administrator:

```powershell
irm https://your-server.com/install.ps1 | iex
```

Or manually:

```powershell
python agent_windows.py --pair
python agent_windows.py --install    # adds registry startup entry (run as Admin)
python agent_windows.py --uninstall  # removes entry and cleans hosts
python agent_windows.py --dry-run
```

#### Linux

**Prerequisites:** Python 3.9+, `pip3 install requests psutil`, `sudo apt install xdotool`

```bash
curl -fsSL https://your-server.com/install-linux.sh | sudo bash
```

Or manually:

```bash
python3 agent_linux.py --pair
sudo python3 agent_linux.py --install    # installs systemd service
sudo python3 agent_linux.py --uninstall  # removes service and cleans hosts
python3 agent_linux.py --dry-run
```

The agent:
- Polls for settings every **60 seconds**
- Reports usage every **5 minutes**
- Kills apps that exceed their daily limit
- Kills all non-allowed apps during **downtime** hours
- Updates `/etc/hosts` to block domains (requires root/Admin)

---

## Platform Support

| Platform | Parent (Dashboard) | Child (Agent) |
|---|---|---|
| macOS | ✅ Web PWA | ✅ mac-agent/agent.py |
| Windows | ✅ Web PWA | ✅ mac-agent/agent_windows.py |
| Linux | ✅ Web PWA | ✅ mac-agent/agent_linux.py |
| iOS | ✅ Web PWA (add to home screen) | 🔜 Coming soon |
| Android | ✅ Web PWA (add to home screen) | 🔜 Coming soon |

---

## Features

| Feature | Description |
|---|---|
| **App Limits** | Set per-app daily time limits in minutes. The agent terminates the app when the limit is hit. |
| **Downtime** | Schedule overnight or custom quiet hours. Only explicitly allowed apps remain usable. |
| **Website Filter** | Blocklist or allowlist domains. Changes propagate to `/etc/hosts` within 60 seconds. |
| **Usage Dashboard** | View daily screen time charts, top apps, and top websites for any device. |
| **Multi-device** | Add unlimited child devices to one parent account. |
| **PWA** | Install the parent dashboard to your home screen on iOS/Android/desktop. |

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create parent account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/auth/me` | Current parent info |

### Devices (parent — Bearer token)
| Method | Path | Description |
|---|---|---|
| GET | `/api/devices` | List devices |
| POST | `/api/devices` | Register new device |
| DELETE | `/api/devices/:id` | Remove device |
| GET | `/api/devices/:id/settings` | Get settings |
| PUT | `/api/devices/:id/settings` | Update settings |
| GET | `/api/devices/:id/usage?from=&to=` | Get usage logs |

### Agent endpoints (X-Device-Token header)
| Method | Path | Description |
|---|---|---|
| GET | `/api/devices/agent/settings` | Pull current settings |
| POST | `/api/devices/agent/usage` | Push usage data |

---

## Settings Schema

```json
{
  "app_limits": [
    { "app_name": "Safari", "bundle_id": "com.apple.Safari", "daily_limit_minutes": 60 }
  ],
  "downtime": {
    "enabled": true,
    "start": "22:00",
    "end": "07:00",
    "allowed_apps": ["Messages", "FaceTime"]
  },
  "website_restrictions": {
    "mode": "blocklist",
    "domains": ["youtube.com", "tiktok.com"]
  }
}
```

---

## Production Checklist

- [ ] Set `JWT_SECRET` to a strong random string
- [ ] Use HTTPS for the backend (required for PWA service worker)
- [ ] Set `CORS_ORIGIN` to your PWA domain
- [ ] Put the backend behind nginx or a reverse proxy
- [ ] Back up `oversight.db` regularly
