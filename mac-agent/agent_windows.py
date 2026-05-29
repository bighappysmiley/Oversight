#!/usr/bin/env python3
"""
Oversight Windows Agent
Runs on the child's Windows PC. Monitors usage, enforces limits and restrictions.
Requires: pip install requests psutil pywin32
Run as Administrator for hosts-file editing.
"""

import base64
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import threading
import time
import argparse
import logging
from datetime import date, datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

try:
    import psutil
except ImportError:
    print("Install psutil: pip install psutil")
    sys.exit(1)

CONFIG_PATH = Path(__file__).parent / "config.json"
HOSTS_PATH = Path(r"C:\Windows\System32\drivers\etc\hosts")
HOSTS_MARKER_START = "# === OVERSIGHT BLOCKED ==="
HOSTS_MARKER_END = "# === OVERSIGHT END ==="

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).parent / "agent.log"),
    ],
)
log = logging.getLogger("oversight")


def load_config():
    if not CONFIG_PATH.exists():
        log.error("config.json not found. Run --pair first to configure this device.")
        sys.exit(1)
    with open(CONFIG_PATH) as f:
        return json.load(f)


def get_device_fingerprint():
    """Return a stable device fingerprint based on hostname + MAC address."""
    import socket
    import uuid
    hostname = socket.gethostname()
    mac = ':'.join(('%012X' % uuid.getnode())[i:i+2] for i in range(0, 12, 2))
    raw = f"{hostname}|{mac}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def pair_device():
    """Interactive pairing flow: claim a 6-digit code and save the device token."""
    print("=== Oversight Device Pairing ===\n")

    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            existing = json.load(f)
        default_url = existing.get("server_url", "")
        prompt = f"Enter your server URL [{default_url}]: "
    else:
        existing = {}
        prompt = "Enter your server URL (e.g. https://oversight.example.com): "

    server_url = input(prompt).strip()
    if not server_url and existing.get("server_url"):
        server_url = existing["server_url"]
    server_url = server_url.rstrip("/")

    if not server_url:
        print("Server URL is required.")
        sys.exit(1)

    fingerprint = get_device_fingerprint()
    code = input("Enter the 6-digit pairing code shown on the parent's device: ").strip()

    if not code or len(code) != 6 or not code.isdigit():
        print("Invalid pairing code. Must be 6 digits.")
        sys.exit(1)

    print(f"\nContacting {server_url} ...")
    try:
        r = requests.post(
            f"{server_url}/api/pair/claim",
            json={"code": code, "device_fingerprint": fingerprint},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
    except requests.HTTPError as e:
        try:
            msg = e.response.json().get("error", str(e))
        except Exception:
            msg = str(e)
        print(f"Pairing failed: {msg}")
        sys.exit(1)
    except Exception as e:
        print(f"Connection error: {e}")
        sys.exit(1)

    config = {
        **existing,
        "server_url": server_url,
        "device_id": data["device_id"],
        "device_token": data["device_token"],
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

    print(f"\nDevice paired! Token saved to {CONFIG_PATH}")
    print(f"   Device ID: {data['device_id']}")

    run_install = input("\nInstall as a startup task now? (requires Admin) [y/N]: ").strip().lower()
    if run_install == "y":
        install_startup()


def get_active_app():
    """Return the name of the currently focused window's process."""
    try:
        import win32gui
        import win32process
        hwnd = win32gui.GetForegroundWindow()
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        try:
            return psutil.Process(pid).name().replace('.exe', '')
        except Exception:
            return None
    except ImportError:
        # Fallback without pywin32
        try:
            result = subprocess.run(
                ['powershell', '-Command',
                 '(Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Sort-Object CPU -Descending | Select-Object -First 1).Name'],
                capture_output=True, text=True, timeout=5
            )
            name = result.stdout.strip()
            return name if name else None
        except Exception:
            return None


def get_running_apps():
    """Return list of {app_name, pid} for running processes."""
    apps = []
    try:
        for p in psutil.process_iter(['name', 'pid']):
            try:
                name = p.info['name']
                if name:
                    apps.append({
                        "app_name": name.replace('.exe', ''),
                        "pid": p.info['pid'],
                        "bundle_id": "",
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception as e:
        log.warning(f"get_running_apps failed: {e}")
    return apps


def kill_app(app_name):
    """Force-quit an app by name."""
    log.info(f"Killing app: {app_name}")
    subprocess.run(['taskkill', '/F', '/IM', f'{app_name}.exe'], capture_output=True)


def get_browser_history_today():
    """Read Chrome history for today and return domain visit counts."""
    today = date.today().isoformat()
    domains = {}

    # Chrome on Windows
    chrome_db = Path(os.environ.get('LOCALAPPDATA', '')) / 'Google' / 'Chrome' / 'User Data' / 'Default' / 'History'
    if chrome_db.exists():
        try:
            import sqlite3
            import tempfile
            import shutil
            tmp = Path(tempfile.mktemp(suffix=".db"))
            shutil.copy2(chrome_db, tmp)
            con = sqlite3.connect(tmp)
            epoch_offset = 11644473600
            today_start_us = (datetime.fromisoformat(today).timestamp() + epoch_offset) * 1_000_000
            today_end_us = today_start_us + 86400 * 1_000_000
            rows = con.execute(
                "SELECT url FROM urls WHERE last_visit_time >= ? AND last_visit_time < ?",
                (today_start_us, today_end_us)
            ).fetchall()
            con.close()
            tmp.unlink(missing_ok=True)
            for (url,) in rows:
                domain = _extract_domain(url)
                if domain:
                    domains[domain] = domains.get(domain, 0) + 1
        except Exception as e:
            log.debug(f"Chrome history read failed: {e}")

    # Edge on Windows
    edge_db = Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft' / 'Edge' / 'User Data' / 'Default' / 'History'
    if edge_db.exists():
        try:
            import sqlite3
            import tempfile
            import shutil
            tmp = Path(tempfile.mktemp(suffix=".db"))
            shutil.copy2(edge_db, tmp)
            con = sqlite3.connect(tmp)
            epoch_offset = 11644473600
            today_start_us = (datetime.fromisoformat(today).timestamp() + epoch_offset) * 1_000_000
            today_end_us = today_start_us + 86400 * 1_000_000
            rows = con.execute(
                "SELECT url FROM urls WHERE last_visit_time >= ? AND last_visit_time < ?",
                (today_start_us, today_end_us)
            ).fetchall()
            con.close()
            tmp.unlink(missing_ok=True)
            for (url,) in rows:
                domain = _extract_domain(url)
                if domain:
                    domains[domain] = domains.get(domain, 0) + 1
        except Exception as e:
            log.debug(f"Edge history read failed: {e}")

    return [{"domain": d, "visits": v} for d, v in domains.items()]


def _extract_domain(url):
    m = re.match(r"https?://([^/]+)", url or "")
    if not m:
        return None
    host = m.group(1).lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def update_hosts(restrictions):
    """Rewrite the Oversight section of the hosts file to block domains."""
    import ctypes
    if not ctypes.windll.shell32.IsUserAnAdmin():
        log.warning("Not running as Administrator; cannot modify hosts file")
        return

    mode = restrictions.get("mode", "blocklist")
    domains = restrictions.get("domains", [])

    if mode == "blocklist":
        blocked = domains
    else:
        blocked = []

    current = HOSTS_PATH.read_text()
    new_text = re.sub(
        rf"{re.escape(HOSTS_MARKER_START)}.*?{re.escape(HOSTS_MARKER_END)}\n?",
        "",
        current,
        flags=re.DOTALL,
    )

    if blocked:
        block_entries = "\n".join(f"0.0.0.0 {d}\n0.0.0.0 www.{d}" for d in blocked)
        oversight_block = f"\n{HOSTS_MARKER_START}\n{block_entries}\n{HOSTS_MARKER_END}\n"
        new_text = new_text.rstrip() + oversight_block

    HOSTS_PATH.write_text(new_text)

    # Flush DNS cache
    subprocess.run(['ipconfig', '/flushdns'], capture_output=True)
    log.info(f"Updated hosts file: {len(blocked)} blocked domains")


def is_downtime(downtime_config):
    """Return True if current time is within the downtime window."""
    if not downtime_config.get("enabled"):
        return False
    now = datetime.now().strftime("%H:%M")
    start = downtime_config.get("start", "22:00")
    end = downtime_config.get("end", "07:00")
    if start <= end:
        return start <= now < end
    else:
        return now >= start or now < end


def install_startup():
    """Install the agent in the Windows registry for auto-start."""
    try:
        import winreg
        agent_path = Path(__file__).resolve()
        python_path = sys.executable.replace('python.exe', 'pythonw.exe')
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r'SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
            0,
            winreg.KEY_SET_VALUE
        )
        winreg.SetValueEx(key, 'OversightAgent', 0, winreg.REG_SZ, f'"{python_path}" "{agent_path}"')
        winreg.CloseKey(key)
        print("Oversight agent installed in registry startup.")
        print("It will start automatically on next login.")
    except ImportError:
        print("winreg not available. Cannot install startup entry.")
    except Exception as e:
        print(f"Failed to install startup entry: {e}")


def uninstall_startup():
    """Remove the agent from Windows registry startup and clean hosts."""
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r'SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
            0,
            winreg.KEY_SET_VALUE
        )
        try:
            winreg.DeleteValue(key, 'OversightAgent')
            print("Removed startup registry entry.")
        except FileNotFoundError:
            print("No startup entry found.")
        winreg.CloseKey(key)
    except ImportError:
        print("winreg not available.")
    except Exception as e:
        print(f"Failed to remove startup entry: {e}")

    # Clean hosts file
    if HOSTS_PATH.exists():
        current = HOSTS_PATH.read_text()
        cleaned = re.sub(
            rf"{re.escape(HOSTS_MARKER_START)}.*?{re.escape(HOSTS_MARKER_END)}\n?",
            "",
            current,
            flags=re.DOTALL,
        )
        HOSTS_PATH.write_text(cleaned)
        subprocess.run(['ipconfig', '/flushdns'], capture_output=True)
        print("Removed Oversight hosts entries.")

    print("Oversight agent uninstalled.")


class Agent:
    def __init__(self, config, dry_run=False):
        self.config = config
        self.dry_run = dry_run
        self.server = config["server_url"].rstrip("/")
        self.token = config["device_token"]
        self.settings = None
        self.app_usage = {}  # app_name -> seconds today
        self.last_active_app = None
        self.last_tick = time.time()
        self.today = date.today().isoformat()
        self.last_settings_fetch = 0
        self.last_usage_push = 0
        self.last_hosts_update = ""
        self.last_stream_check = 0
        self.streaming_enabled = False
        self._capture_thread = None
        self._capture_stop = threading.Event()

    def fetch_settings(self):
        try:
            r = requests.get(
                f"{self.server}/api/devices/agent/settings",
                headers={"X-Device-Token": self.token},
                timeout=10,
            )
            r.raise_for_status()
            self.settings = r.json()
            log.info("Settings fetched successfully")
        except Exception as e:
            log.warning(f"Failed to fetch settings: {e}")

    def push_usage(self):
        today = date.today().isoformat()
        app_usage = [
            {"app_name": name, "bundle_id": "", "duration_seconds": secs}
            for name, secs in self.app_usage.items()
        ]
        web_usage = get_browser_history_today()
        try:
            r = requests.post(
                f"{self.server}/api/devices/agent/usage",
                headers={"X-Device-Token": self.token, "Content-Type": "application/json"},
                json={"app_usage": app_usage, "web_usage": web_usage, "date": today},
                timeout=10,
            )
            r.raise_for_status()
            log.info(f"Usage pushed: {len(app_usage)} apps, {len(web_usage)} sites")
        except Exception as e:
            log.warning(f"Failed to push usage: {e}")

    def enforce(self):
        if not self.settings:
            return

        now_str = date.today().isoformat()
        if now_str != self.today:
            self.app_usage = {}
            self.today = now_str

        app_limits = {l["app_name"].lower(): l for l in self.settings.get("app_limits", [])}
        downtime = self.settings.get("downtime", {})
        in_downtime = is_downtime(downtime)
        allowed_apps = [a.lower() for a in downtime.get("allowed_apps", [])]

        running = get_running_apps()
        active = get_active_app()

        tick_now = time.time()
        elapsed = tick_now - self.last_tick
        self.last_tick = tick_now

        if active:
            self.app_usage[active] = self.app_usage.get(active, 0) + elapsed

        for app_info in running:
            name = app_info["app_name"]
            name_lower = name.lower()

            if in_downtime and name_lower not in allowed_apps:
                log.info(f"Downtime: blocking {name}")
                if not self.dry_run:
                    kill_app(name)
                continue

            if name_lower in app_limits:
                limit_secs = app_limits[name_lower]["daily_limit_minutes"] * 60
                used_secs = self.app_usage.get(name, 0)
                if used_secs >= limit_secs:
                    log.info(f"App limit reached for {name} ({used_secs:.0f}s used, limit {limit_secs}s)")
                    if not self.dry_run:
                        kill_app(name)

        restrictions = self.settings.get("website_restrictions", {})
        restrictions_key = json.dumps(restrictions, sort_keys=True)
        if restrictions_key != self.last_hosts_update:
            if not self.dry_run:
                update_hosts(restrictions)
            self.last_hosts_update = restrictions_key

    def check_streaming(self):
        """Poll the server to see if screen streaming is enabled."""
        try:
            r = requests.get(
                f"{self.server}/api/devices/agent/screen/enabled",
                headers={"X-Device-Token": self.token},
                timeout=10,
            )
            r.raise_for_status()
            enabled = r.json().get("enabled", False)
            if enabled and not self.streaming_enabled:
                log.info("Screen streaming enabled — starting capture thread")
                self.streaming_enabled = True
                self._capture_stop.clear()
                self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
                self._capture_thread.start()
            elif not enabled and self.streaming_enabled:
                log.info("Screen streaming disabled — stopping capture thread")
                self.streaming_enabled = False
                self._capture_stop.set()
        except Exception as e:
            log.debug(f"Stream check failed: {e}")

    def _capture_loop(self):
        """Background thread: capture and upload a screen frame every 2 seconds."""
        tmp = Path(os.environ.get('TEMP', 'C:\\Temp')) / "oversight_frame.png"
        while not self._capture_stop.is_set():
            try:
                # Use PowerShell to capture screen on Windows
                ps_cmd = f"""
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bitmap.Save('{tmp}')
$graphics.Dispose()
$bitmap.Dispose()
"""
                subprocess.run(['powershell', '-Command', ps_cmd], capture_output=True, timeout=10)
                if tmp.exists():
                    frame_b64 = base64.b64encode(tmp.read_bytes()).decode()
                    requests.post(
                        f"{self.server}/api/devices/agent/screen",
                        headers={"X-Device-Token": self.token, "Content-Type": "application/json"},
                        json={"frame": frame_b64, "captured_at": int(time.time())},
                        timeout=10,
                    )
            except Exception as e:
                log.debug(f"Screen capture failed: {e}")
            self._capture_stop.wait(2)

    def run(self):
        log.info(f"Oversight Windows agent starting (dry_run={self.dry_run})")
        signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

        while True:
            now = time.time()

            if now - self.last_settings_fetch >= 60:
                self.fetch_settings()
                self.last_settings_fetch = now

            if now - self.last_stream_check >= 30:
                self.check_streaming()
                self.last_stream_check = now

            self.enforce()

            if now - self.last_usage_push >= 300:
                self.push_usage()
                self.last_usage_push = now

            time.sleep(5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Oversight Windows Agent")
    parser.add_argument("--install", action="store_true", help="Install as Windows startup entry (requires Admin)")
    parser.add_argument("--uninstall", action="store_true", help="Remove startup entry and clean hosts (requires Admin)")
    parser.add_argument("--pair", action="store_true", help="Pair this device with a parent account using a 6-digit code")
    parser.add_argument("--dry-run", action="store_true", help="Monitor only; don't kill apps or edit hosts")
    args = parser.parse_args()

    if args.pair:
        pair_device()
        sys.exit(0)

    if args.install:
        install_startup()
        sys.exit(0)

    if args.uninstall:
        uninstall_startup()
        sys.exit(0)

    config = load_config()
    Agent(config, dry_run=args.dry_run).run()
