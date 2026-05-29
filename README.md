# Oversight

> **Oversight** gives parents complete control over their child's digital life — block websites across every browser, set app limits, restrict video content, and monitor app and web usage, all from your phone.

## Architecture

```
oversight/
├── backend/        Node.js + Express + SQLite API
├── pwa/            React + Vite Progressive Web App (parent dashboard)
└── mac-agent/      Python daemon running on the child's Mac
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

### 3. Mac Agent (child's Mac)

**Prerequisites:** Python 3.9+, `pip3 install requests`

```bash
# 1. Add the device in the parent PWA → Devices page → copy the token

# 2. Copy the example config
cp mac-agent/config.example.json mac-agent/config.json

# 3. Edit config.json
{
  "server_url": "https://your-server.com",
  "device_token": "paste-token-here"
}

# 4. Test in dry-run mode first (no enforcement, just logging)
python3 mac-agent/agent.py --dry-run

# 5. Install as a persistent background daemon (requires sudo)
sudo python3 mac-agent/agent.py --install

# 6. To uninstall
sudo python3 mac-agent/agent.py --uninstall
```

The agent:
- Polls for settings every **60 seconds**
- Reports usage every **5 minutes**
- Kills apps that exceed their daily limit
- Kills all non-allowed apps during **downtime** hours
- Updates `/etc/hosts` to block domains (requires sudo)

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
