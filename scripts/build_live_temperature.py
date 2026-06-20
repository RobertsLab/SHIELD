#!/usr/bin/env python3
"""
Build a near-live water-temperature snapshot for the Shellfish Farm Outplant
Dashboard from public observing networks (NOAA NDBC buoys + NOAA CO-OPS Tides &
Currents stations) located near each outplant site.

Why a build step instead of fetching in the browser? The richest / closest feeds
do NOT send CORS headers, so a static GitHub Pages dashboard cannot fetch them
client-side. This script runs server-side (locally or in GitHub Actions), tries
an ordered list of candidate stations per site, and commits the first valid
reading as `src/data/liveTemperature.json`. The Action re-runs on a schedule, so
the committed snapshot stays "near-live" (e.g. hourly) without any backend.

Sources (no API key required):
  - NDBC realtime2 .txt  https://www.ndbc.noaa.gov/data/realtime2/<ID>.txt
  - NOAA CO-OPS datagetter https://api.tidesandcurrents.noaa.gov/api/prod/datagetter

Each site lists candidate stations in priority order (closest / most reliable
first). Buoy water-temp (WTMP) sensors intermittently report "MM" (missing), so
the script falls through to the next candidate until it gets a fresh value.

Run:  python3 scripts/build_live_temperature.py
"""
import json
import math
import os
import sys
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
OUT = os.path.join(REPO, "src", "data", "liveTemperature.json")

# Drop a reading if its timestamp is older than this many hours (stale sensor).
MAX_AGE_HOURS = 48
HTTP_TIMEOUT = 30

# Site coordinates — kept in sync with SITE_LOCATIONS in
# src/data/mockShellfishData.js (the real C. gigas outplant sites).
SITES = {
    "Baywater": (47.808, -122.738),       # Thorndyke Bay, Hood Canal
    "Sequim Bay": (48.07, -123.03),       # Sequim Bay
    "Goose Point": (46.62, -123.86),      # Palix River, Willapa Bay
    "Westcott": (48.582, -123.167),       # Westcott Bay, San Juan Island
}

# Ordered candidate stations per site. `type` selects the parser. The first
# candidate that returns a fresh (<= MAX_AGE_HOURS) water temperature wins.
#   ndbc  -> NDBC realtime2 standard meteorological file (WTMP column, °C)
#   coops -> NOAA CO-OPS water_temperature product (returned in metric / °C)
STATION_CANDIDATES = {
    "Baywater": [
        {"type": "ndbc", "id": "46125", "name": "Hood Canal (NDBC 46125)",
         "lat": 47.907, "lon": -122.627},
        {"type": "coops", "id": "9444900", "name": "Port Townsend",
         "lat": 48.1112, "lon": -122.7597},
    ],
    "Sequim Bay": [
        {"type": "ndbc", "id": "46088", "name": "New Dungeness (NDBC 46088)",
         "lat": 48.333, "lon": -123.165},
        {"type": "coops", "id": "9444090", "name": "Port Angeles",
         "lat": 48.125, "lon": -123.440},
        {"type": "coops", "id": "9444900", "name": "Port Townsend",
         "lat": 48.1112, "lon": -122.7597},
    ],
    "Goose Point": [
        {"type": "ndbc", "id": "46211", "name": "Grays Harbor (NDBC 46211)",
         "lat": 46.858, "lon": -124.244},
        {"type": "ndbc", "id": "46243", "name": "Grays Harbor Entrance (NDBC 46243)",
         "lat": 46.857, "lon": -124.128},
    ],
    "Westcott": [
        {"type": "ndbc", "id": "46088", "name": "New Dungeness (NDBC 46088)",
         "lat": 48.333, "lon": -123.165},
        {"type": "coops", "id": "9444900", "name": "Port Townsend",
         "lat": 48.1112, "lon": -122.7597},
    ],
}


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2)
    return round(r * 2 * math.asin(math.sqrt(a)), 1)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "mock-farm-dashboard"})
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        return resp.read().decode("utf-8", errors="replace")


def age_hours(dt_utc):
    return (datetime.now(timezone.utc) - dt_utc).total_seconds() / 3600.0


def read_ndbc(station):
    """Latest valid WTMP from an NDBC realtime2 standard met file (°C, UTC)."""
    url = f"https://www.ndbc.noaa.gov/data/realtime2/{station['id']}.txt"
    text = fetch(url)
    lines = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
    # Columns: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP ...
    for ln in lines:  # newest row first
        c = ln.split()
        if len(c) < 15:
            continue
        wtmp = c[14]
        if wtmp in ("MM", ""):
            continue
        try:
            dt = datetime(int(c[0]), int(c[1]), int(c[2]), int(c[3]), int(c[4]),
                          tzinfo=timezone.utc)
            val = float(wtmp)
        except ValueError:
            continue
        if age_hours(dt) > MAX_AGE_HOURS:
            return None
        return {"temperature_C": round(val, 1),
                "observed_at": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "source_url": url}
    return None


def read_coops(station):
    """Latest CO-OPS water temperature (requested in metric / °C, local time)."""
    url = ("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
           "?product=water_temperature&date=latest"
           f"&station={station['id']}&units=metric&time_zone=gmt"
           "&format=json&application=mock-farm-dashboard")
    data = json.loads(fetch(url))
    rows = data.get("data")
    if not rows:
        return None
    row = rows[-1]
    try:
        val = float(row["v"])
        dt = datetime.strptime(row["t"], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except (KeyError, ValueError):
        return None
    if age_hours(dt) > MAX_AGE_HOURS:
        return None
    return {"temperature_C": round(val, 1),
            "observed_at": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source_url": url}


READERS = {"ndbc": read_ndbc, "coops": read_coops}
PROVIDER = {"ndbc": "NOAA NDBC", "coops": "NOAA CO-OPS"}


def resolve_site(site):
    slat, slon = SITES[site]
    tried = []
    for cand in STATION_CANDIDATES[site]:
        tried.append(cand["id"])
        try:
            reading = READERS[cand["type"]](cand)
        except Exception as e:  # network / parse — fall through to next candidate
            print(f"  ! {site}: {cand['id']} failed ({e.__class__.__name__})",
                  file=sys.stderr)
            reading = None
        if reading is None:
            continue
        return {
            "site": site,
            "station_id": cand["id"],
            "station_name": cand["name"],
            "provider": PROVIDER[cand["type"]],
            "station_lat": cand["lat"],
            "station_lon": cand["lon"],
            "distance_km": haversine_km(slat, slon, cand["lat"], cand["lon"]),
            **reading,
        }
    return {
        "site": site, "station_id": None, "station_name": None,
        "provider": None, "station_lat": None, "station_lon": None,
        "distance_km": None, "temperature_C": None, "observed_at": None,
        "source_url": None, "note": f"No fresh reading from candidates: {', '.join(tried)}",
    }


def main():
    observations = [resolve_site(site) for site in SITES]
    bundle = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "description": (
            "Near-live water temperature (°C) from the closest public NOAA NDBC "
            "buoy or CO-OPS station to each outplant site. Refreshed on a schedule "
            "by scripts/build_live_temperature.py; not the in-situ HOBO loggers."),
        "maxAgeHours": MAX_AGE_HOURS,
        "sites": list(SITES.keys()),
        "observations": observations,
    }
    # Stable key order; pretty enough to diff cleanly in git.
    with open(OUT, "w") as f:
        json.dump(bundle, f, indent=2)
        f.write("\n")

    got = sum(1 for o in observations if o["temperature_C"] is not None)
    print(f"Wrote {OUT} — {got}/{len(observations)} sites with a fresh reading")
    for o in observations:
        if o["temperature_C"] is not None:
            print(f"  {o['site']:12} {o['temperature_C']:5.1f}°C  "
                  f"{o['station_name']} (~{o['distance_km']} km)  {o['observed_at']}")
        else:
            print(f"  {o['site']:12}   n/a  {o.get('note', '')}")
    # Don't fail the build if a sensor is temporarily down; a partial snapshot is
    # still useful and the next scheduled run will backfill.
    return 0


if __name__ == "__main__":
    sys.exit(main())
