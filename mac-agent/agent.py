#!/usr/bin/env python3
"""
Oversight Mac Agent
Runs on the child's Mac. Monitors usage, enforces limits and restrictions.
Requires: pip3 install requests
Run with sudo for hosts-file editing: sudo python3 agent.py
"""

import json
import os
import re
import signal
import subprocess
import sys
import time
import argparse
import logging
from datetime import date, datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install requests: pip3 install requests")
    sys.exit(1)

CONFIG_PATH = Path(__file__).parent / "config.json"
PLIST_PATH = Path("/Library/LaunchDaemons/com.oversight.agent.plist")
HOSTS_PATH = Path("/etc/hosts")
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
        log.error("config.json not found. Copy config.example.json and fill in your values.")
        sys.exit(1)
    with open(CONFIG_PATH) as f:
        return json.load(f)


def get_running_apps():
    """Return list of {app_name, bundle_id, pid} for visible running apps."""
    script = """
    tell application "System Events"
        set appList to {}
        repeat with p in (processes where background only is false)
            set end of appList to (name of p) & "|" & (unix id of p as string) & "|" & (bundle identifier of p as string)
        end repeat
        return appList
    end tell
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True, timeout=10
        )
        apps = []
        for item in result.stdout.strip().split(", "):
            parts = item.strip().split("|")
            if len(parts) >= 2:
                apps.append({
                    "app_name": parts[0],
                    "pid": int(parts[1]) if parts[1].isdigit() else None,
                    "bundle_id": parts[2] if len(parts) > 2 else "",
                })
        return apps
    except Exception as e:
        log.warning(f"get_running_apps failed: {e}")
        return []


def get_active_app():
    """Return the name of the currently focused app."""
    script = 'tell application "System Events" to return name of first process whose frontmost is true'
    try:
        result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=5)
        return result.stdout.strip()
    except Exception:
        return None


def kill_app(app_name):
    """Force-quit an app by name."""
    log.info(f"Killing app: {app_name}")
    subprocess.run(["pkill", "-x", app_name], capture_output=True)


def get_browser_history_today():
    """Read Safari and Chrome history for today and return domain visit counts."""
    today = date.today().isoformat()
    domains = {}

    # Safari
    safari_db = Path.home() / "Library/Safari/History.db"
    if safari_db.exists():
        try:
            import sqlite3, tempfile, shutil
            tmp = Path(tempfile.mktemp(suffix=".db"))
            shutil.copy2(safari_db, tmp)
            con = sqlite3.connect(tmp)
            # Safari stores dates as CFAbsoluteTime (seconds since 2001-01-01)
            cf_today_start = (datetime.fromisoformat(today) - datetime(2001, 1, 1)).total_seconds()
            cf_today_end = cf_today_start + 86400
            rows = con.execute(
                "SELECT url FROM history_items hi JOIN history_visits hv ON hi.id=hv.history_item "
                "WHERE hv.visit_time >= ? AND hv.visit_time < ?",
                (cf_today_start, cf_today_end)
            ).fetchall()
            con.close()
            tmp.unlink(missing_ok=True)
            for (url,) in rows:
                domain = _extract_domain(url)
                if domain:
                    domains[domain] = domains.get(domain, 0) + 1
        except Exception as e:
            log.debug(f"Safari history read failed: {e}")

    # Chrome
    chrome_db = Path.home() / "Library/Application Support/Google/Chrome/Default/History"
    if chrome_db.exists():
        try:
            import sqlite3, tempfile, shutil
            tmp = Path(tempfile.mktemp(suffix=".db"))
            shutil.copy2(chrome_db, tmp)
            con = sqlite3.connect(tmp)
            # Chrome stores dates as microseconds since 1601-01-01
            epoch_offset = 11644473600  # seconds between 1601-01-01 and 1970-01-01
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

    return [{"domain": d, "visits": v} for d, v in domains.items()]


def _extract_domain(url):
    m = re.match(r"https?://([^/]+)", url or "")
    if not m:
        return None
    host = m.group(1).lower()
    # Strip leading www.
    if host.startswith("www."):
        host = host[4:]
    return host


def update_hosts(restrictions):
    """Rewrite the Oversight section of /etc/hosts to block/allow domains."""
    if os.geteuid() != 0:
        log.warning("Not running as root; cannot modify /etc/hosts")
        return

    mode = restrictions.get("mode", "blocklist")
    domains = restrictions.get("domains", [])

    if mode == "blocklist":
        blocked = domains
    else:
        # allowlist mode: block everything is not feasible via hosts; we just block listed-not-allowed
        # In allowlist mode we can only block explicit domains not in the allowlist
        # A proper DNS sinkhole would be needed for full allowlist; we do best-effort
        blocked = []  # allowlist mode requires DNS proxy beyond this agent's scope

    current = HOSTS_PATH.read_text()
    # Remove previous Oversight block
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
    subprocess.run(["dscacheutil", "-flushcache"], capture_output=True)
    subprocess.run(["killall", "-HUP", "mDNSResponder"], capture_output=True)
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
        # Overnight
        return now >= start or now < end


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
        # Look up bundle_id from the last known running apps snapshot
        bundle_map = {a["app_name"]: a.get("bundle_id", "") for a in get_running_apps()}
        app_usage = [
            {"app_name": name, "bundle_id": bundle_map.get(name, ""), "duration_seconds": secs}
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

            # Downtime enforcement
            if in_downtime and name_lower not in allowed_apps:
                log.info(f"Downtime: blocking {name}")
                if not self.dry_run:
                    kill_app(name)
                continue

            # App limit enforcement
            if name_lower in app_limits:
                limit_secs = app_limits[name_lower]["daily_limit_minutes"] * 60
                used_secs = self.app_usage.get(name, 0)
                if used_secs >= limit_secs:
                    log.info(f"App limit reached for {name} ({used_secs:.0f}s used, limit {limit_secs}s)")
                    if not self.dry_run:
                        kill_app(name)

        # Website restrictions
        restrictions = self.settings.get("website_restrictions", {})
        restrictions_key = json.dumps(restrictions, sort_keys=True)
        if restrictions_key != self.last_hosts_update:
            if not self.dry_run:
                update_hosts(restrictions)
            self.last_hosts_update = restrictions_key

    def run(self):
        log.info(f"Oversight agent starting (dry_run={self.dry_run})")
        signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

        while True:
            now = time.time()

            # Fetch settings every 60 seconds
            if now - self.last_settings_fetch >= 60:
                self.fetch_settings()
                self.last_settings_fetch = now

            self.enforce()

            # Push usage every 5 minutes
            if now - self.last_usage_push >= 300:
                self.push_usage()
                self.last_usage_push = now

            time.sleep(5)


def install_launchd(config_path):
    """Install the agent as a root LaunchDaemon."""
    agent_path = Path(__file__).resolve()
    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.oversight.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>{agent_path}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{agent_path.parent}/agent.log</string>
    <key>StandardErrorPath</key>
    <string>{agent_path.parent}/agent.log</string>
    <key>WorkingDirectory</key>
    <string>{agent_path.parent}</string>
</dict>
</plist>
"""
    PLIST_PATH.write_text(plist_content)
    subprocess.run(["launchctl", "load", str(PLIST_PATH)], check=True)
    print(f"✅ Oversight agent installed as LaunchDaemon: {PLIST_PATH}")
    print("   It will start automatically on boot and restart if it crashes.")


def uninstall_launchd():
    if PLIST_PATH.exists():
        subprocess.run(["launchctl", "unload", str(PLIST_PATH)], capture_output=True)
        PLIST_PATH.unlink()
    # Remove hosts entries
    if HOSTS_PATH.exists():
        current = HOSTS_PATH.read_text()
        cleaned = re.sub(
            rf"{re.escape(HOSTS_MARKER_START)}.*?{re.escape(HOSTS_MARKER_END)}\n?",
            "",
            current,
            flags=re.DOTALL,
        )
        HOSTS_PATH.write_text(cleaned)
    print("✅ Oversight agent uninstalled.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Oversight Mac Agent")
    parser.add_argument("--install", action="store_true", help="Install as LaunchDaemon (requires sudo)")
    parser.add_argument("--uninstall", action="store_true", help="Uninstall LaunchDaemon (requires sudo)")
    parser.add_argument("--dry-run", action="store_true", help="Monitor only; don't kill apps or edit hosts")
    args = parser.parse_args()

    if args.install:
        if os.geteuid() != 0:
            print("sudo required for --install")
            sys.exit(1)
        install_launchd(CONFIG_PATH)
        sys.exit(0)

    if args.uninstall:
        if os.geteuid() != 0:
            print("sudo required for --uninstall")
            sys.exit(1)
        uninstall_launchd()
        sys.exit(0)

    config = load_config()
    Agent(config, dry_run=args.dry_run).run()
