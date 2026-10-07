#!/usr/bin/env bash
# net-watchdog.sh — recover the Pi when it silently drops off the network.
#
# Runs every 10 minutes from net-watchdog.timer (as root, so it can restart
# services and reboot). Two independent checks, two remedies:
#
#   1. LAN/internet: can we ping the default gateway OR a public address?
#      If NEITHER answers for DOWN_LIMIT_MIN continuously -> reboot.
#      Requiring both to fail means the Pi itself has lost the network; a
#      gateway-only check would reboot during an ISP outage the Pi can't fix.
#      This is the 2026-09-28 failure: 8 days unreachable, ACT LED solid,
#      BirdNET still recording, nothing short of a power-cycle brought it back.
#
#   2. Public tunnel: if TUNNEL_HEALTH_URL is set and the internet IS up but
#      the URL fails for TUNNEL_DOWN_LIMIT_MIN -> restart cloudflared and
#      birdnet-api (cheap, no reboot), and again every TUNNEL_DOWN_LIMIT_MIN
#      while it stays dead. The URL round-trips through Cloudflare and back
#      down the tunnel to this very Pi, so it checks the whole public path the
#      site depends on. If restarts haven't fixed it after DOWN_LIMIT_MIN
#      from the first failure -> reboot.
#
# State is a few timestamp files in STATE_DIR on tmpfs, so a reboot resets
# every clock. Worst case during a prolonged real outage: one reboot per
# DOWN_LIMIT_MIN. A healthy check logs nothing.
#
# Env (set in net-watchdog.service):
#   DOWN_LIMIT_MIN         minutes of outage before reboot (240)
#   TUNNEL_HEALTH_URL      e.g. https://api.example.com/health ("" = skip check 2)
#   TUNNEL_DOWN_LIMIT_MIN  minutes of tunnel failure between service restarts (30)
#   PUBLIC_TARGETS         space-separated IPs to ping ("1.1.1.1 8.8.8.8")
#   STATE_DIR              where the clocks live (/run/net-watchdog)
#   DRY_RUN                1 = log what would happen, change nothing (0)

set -u

DOWN_LIMIT_MIN="${DOWN_LIMIT_MIN:-240}"
TUNNEL_HEALTH_URL="${TUNNEL_HEALTH_URL:-}"
TUNNEL_DOWN_LIMIT_MIN="${TUNNEL_DOWN_LIMIT_MIN:-30}"
PUBLIC_TARGETS="${PUBLIC_TARGETS:-1.1.1.1 8.8.8.8}"
STATE_DIR="${STATE_DIR:-/run/net-watchdog}"
DRY_RUN="${DRY_RUN:-0}"

mkdir -p "$STATE_DIR"
now=$(date +%s)

log() {
  logger -t net-watchdog -- "$*" 2>/dev/null
  echo "net-watchdog: $*"
}

# iputils ping (Linux): -W is seconds. 2 packets, 3s wait each.
reachable() { ping -c 2 -W 3 -q "$1" >/dev/null 2>&1; }

stamp() { echo "$now" > "$1"; }

# Minutes since the timestamp in file $1. A corrupt file is re-stamped and
# reported as 0 rather than crashing the script.
age_min() {
  local since
  since=$(cat "$1" 2>/dev/null)
  if [[ ! "$since" =~ ^[0-9]+$ ]]; then stamp "$1"; echo 0; return; fi
  echo $(( (now - since) / 60 ))
}

do_reboot() {
  log "$1 — rebooting"
  if [ "$DRY_RUN" = 1 ]; then log "DRY_RUN=1: not rebooting"; exit 0; fi
  sync
  systemctl reboot
}

# ---- check 1: LAN / internet --------------------------------------------------
# Clock: net_down  = first moment neither gateway nor public target answered.
gw=$(ip -4 route show default 2>/dev/null | awk '{print $3; exit}')
net_up=0
if [ -n "$gw" ] && reachable "$gw"; then
  net_up=1
else
  for t in $PUBLIC_TARGETS; do
    if reachable "$t"; then net_up=1; break; fi
  done
fi

net_down="$STATE_DIR/net_down"
if [ "$net_up" = 1 ]; then
  if [ -f "$net_down" ]; then
    log "network back (gw=${gw:-none}) after $(age_min "$net_down") min"
    rm -f "$net_down"
  fi
else
  if [ ! -f "$net_down" ]; then
    stamp "$net_down"
    log "network DOWN (gw=${gw:-none}); will reboot if still down in ${DOWN_LIMIT_MIN} min"
  else
    mins=$(age_min "$net_down")
    if [ "$mins" -ge "$DOWN_LIMIT_MIN" ]; then
      do_reboot "no gateway (${gw:-none}) and no public address for ${mins} min (limit ${DOWN_LIMIT_MIN})"
    fi
    log "network still down: ${mins}/${DOWN_LIMIT_MIN} min"
  fi
  # Nothing else is meaningful without a network.
  exit 0
fi

# ---- check 2: public tunnel, end to end --------------------------------------
# Clocks: tunnel_first = first failure (gates the reboot escalation)
#         tunnel_last  = first failure, or last service restart (gates the
#                        next restart)
[ -n "$TUNNEL_HEALTH_URL" ] || exit 0

tunnel_first="$STATE_DIR/tunnel_first"
tunnel_last="$STATE_DIR/tunnel_last"

if curl -fsS -m 10 -o /dev/null "$TUNNEL_HEALTH_URL" 2>/dev/null; then
  if [ -f "$tunnel_first" ]; then
    log "tunnel back after $(age_min "$tunnel_first") min"
    rm -f "$tunnel_first" "$tunnel_last"
  fi
  exit 0
fi

if [ ! -f "$tunnel_first" ]; then
  stamp "$tunnel_first"
  stamp "$tunnel_last"
  log "tunnel check FAILED ($TUNNEL_HEALTH_URL); will restart services if still failing in ${TUNNEL_DOWN_LIMIT_MIN} min"
  exit 0
fi

total=$(age_min "$tunnel_first")
since_last=$(age_min "$tunnel_last")

if [ "$total" -ge "$DOWN_LIMIT_MIN" ]; then
  do_reboot "internet up but tunnel dead for ${total} min despite service restarts"
fi

if [ "$since_last" -ge "$TUNNEL_DOWN_LIMIT_MIN" ]; then
  log "internet up but tunnel dead for ${total} min — restarting cloudflared + birdnet-api"
  if [ "$DRY_RUN" = 1 ]; then
    log "DRY_RUN=1: not restarting services"
  else
    systemctl restart cloudflared birdnet-api
  fi
  stamp "$tunnel_last"
  exit 0
fi

log "tunnel still failing: ${since_last}/${TUNNEL_DOWN_LIMIT_MIN} min since last action (${total} min total)"
