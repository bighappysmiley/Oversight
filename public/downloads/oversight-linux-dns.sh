#!/usr/bin/env bash
# ============================================================
#  Oversight Safe DNS for Linux
#  Run with:  sudo bash oversight-linux-dns.sh
#  Points this computer at the family-safe resolver
#  (Cloudflare for Families 1.1.1.3 / 1.0.0.3), which blocks
#  adult content and malware.
# ============================================================
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo:  sudo bash oversight-linux-dns.sh"
  exit 1
fi

if command -v resolvectl >/dev/null 2>&1; then
  for dev in $(ls /sys/class/net | grep -v '^lo$'); do
    resolvectl dns "$dev" 1.1.1.3 1.0.0.3 2>/dev/null || true
  done
  resolvectl flush-caches 2>/dev/null || true
  echo "Oversight Safe DNS applied via systemd-resolved (1.1.1.3 / 1.0.0.3)."
else
  cp /etc/resolv.conf /etc/resolv.conf.oversight.bak 2>/dev/null || true
  printf 'nameserver 1.1.1.3\nnameserver 1.0.0.3\n' > /etc/resolv.conf
  echo "Oversight Safe DNS written to /etc/resolv.conf (1.1.1.3 / 1.0.0.3)."
  echo "Backup saved to /etc/resolv.conf.oversight.bak"
fi
