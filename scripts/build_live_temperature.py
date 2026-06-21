#!/usr/bin/env python3
"""
Build a near-live environmental snapshot for the Shellfish Farm Outplant
Dashboard from public observing networks located near each outplant site.

Why a build step instead of fetching in the browser? The richest / closest feeds
do NOT send CORS headers, so a static GitHub Pages dashboard cannot fetch them
client-side. This script runs server-side (locally or in GitHub Actions), tries
an ordered list of candidate stations per site, and commits the first valid
reading as `src/data/liveTemperature.json`. The Action re-runs on a schedule, so
the committed snapshot stays "near-live" (e.g. hourly) without any backend.

Sources (no API key required):
  - NDBC realtime2 .txt  https://www.ndbc.noaa.gov/data/realtime2/<ID>.txt
  - NOAA CO-OPS datagetter https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
  - NANOOS Shellfish Growers source matches for chlorophyll / water quality
    https://nvs.nanoos.org/ShellfishGrowers

Each site lists candidate stations in priority order (closest / most reliable
first). Sensors intermittently report "MM" (missing), so the script falls
through to the next candidate until it gets fresh values. NANOOS/CDMO
chlorophyll stations are matched and recorded as import targets; automated CDMO
pulls require registration/static-IP authorization, so the snapshot keeps that
provenance visible until credentials/station codes are supplied.

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

# Site coordinates. Most are real C. gigas outplant sites from
# src/data/mockShellfishData.js; environmental-only sites can be listed here
# without entering the oyster observation dataset.
SITES = {
    "Baywater": (47.808, -122.738),       # Thorndyke Bay, Hood Canal
    "Bainbridge Island": (47.6262, -122.5212),  # Central Puget Sound
    "Dabob Bay": (47.7617, -122.85),      # Whitney Point / Pt. Whitney Lagoon
    "Sequim Bay": (48.07, -123.03),       # Sequim Bay
    "Goose Point": (46.62, -123.86),      # Palix River, Willapa Bay
    "Westcott": (48.582, -123.167),       # Westcott Bay, San Juan Island
}

# Ordered candidate stations per site. `type` selects the parser.
#   ndbc  -> NDBC realtime2 standard meteorological file
#   coops -> NOAA CO-OPS meteorological products
STATION_CANDIDATES = {
    "Baywater": [
        {"type": "ndbc", "id": "46125", "name": "Hood Canal (NDBC 46125)",
         "lat": 47.907, "lon": -122.627},
        {"type": "coops", "id": "9444900", "name": "Port Townsend",
         "lat": 48.1112, "lon": -122.7597},
    ],
    "Bainbridge Island": [
        {"type": "coops", "id": "9447130", "name": "Seattle",
         "lat": 47.6026, "lon": -122.3393},
        {"type": "ndbc", "id": "46125", "name": "Hansville - Hood Canal (NDBC 46125)",
         "lat": 47.907, "lon": -122.627},
        {"type": "coops", "id": "9444900", "name": "Port Townsend",
         "lat": 48.1112, "lon": -122.7597},
    ],
    "Dabob Bay": [
        {"type": "ndbc", "id": "46125", "name": "Hansville - Hood Canal (NDBC 46125)",
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

CHLOROPHYLL_CANDIDATES = {
    "Baywater": {
        "provider": "NANOOS Shellfish Growers / UW ORCA",
        "station_name": "Hood Canal ORCA moorings (Twanoh, Hoodsport, Dabob Bay)",
        "source_url": "https://nvs.nanoos.org/ShellfishGrowers",
        "note": "Closest shellfish-focused in-situ chlorophyll match for Thorndyke/Hood Canal.",
    },
    "Bainbridge Island": {
        "provider": "NANOOS Shellfish Growers / Puget Sound water quality",
        "station_name": "Central Puget Sound monitoring stations",
        "source_url": "https://nvs.nanoos.org/ShellfishGrowers",
        "note": "Regional Puget Sound shellfish water-quality source; pair with nearby NOAA Seattle / Port Townsend feeds.",
    },
    "Dabob Bay": {
        "provider": "NANOOS Shellfish Growers / UW ORCA",
        "station_name": "Hood Canal ORCA Dabob Bay mooring",
        "source_url": "https://nvs.nanoos.org/ShellfishGrowers",
        "note": "Closest shellfish-focused water-quality source for Pt. Whitney Lagoon / Dabob Bay.",
    },
    "Sequim Bay": {
        "provider": "NANOOS Shellfish Growers / Padilla Bay NERR",
        "station_name": "Padilla Bay / Bayview water-quality stations",
        "source_url": "https://nvs.nanoos.org/ShellfishGrowers",
        "note": "Use as the nearest NANOOS shellfish chlorophyll source until a Sequim-specific public station is available.",
    },
    "Goose Point": {
        "provider": "NANOOS Shellfish Growers / WA Ecology / Pacific Shellfish Institute",
        "station_name": "Willapa Bay / Bay Center monitoring sites",
        "source_url": "https://nvs.nanoos.org/ShellfishGrowers",
        "note": "Closest shellfish-focused chlorophyll source for Palix River / Willapa Bay.",
    },
    "Westcott": {
        "provider": "NANOOS Shellfish Growers / Padilla Bay NERR",
        "station_name": "Padilla Bay / Bayview water-quality stations",
        "source_url": "https://nvs.nanoos.org/ShellfishGrowers",
        "note": "Regional Salish Sea chlorophyll source; pair with nearby NDBC/CO-OPS met data for San Juan sites.",
    },
}

TIDE_STATION_CANDIDATES = {
    "Baywater": [
        {"type": "coops", "id": "9444900", "name": "Port Townsend",
         "lat": 48.1112, "lon": -122.7597},
    ],
    "Bainbridge Island": [
        {"type": "coops", "id": "9447130", "name": "Seattle",
         "lat": 47.6026, "lon": -122.3393},
        {"type": "coops", "id": "9445958", "name": "Bremerton",
         "lat": 47.5617, "lon": -122.6230},
    ],
    "Dabob Bay": [
        {"type": "coops", "id": "9444900", "name": "Port Townsend",
         "lat": 48.1112, "lon": -122.7597},
    ],
    "Sequim Bay": [
        {"type": "coops", "id": "9444090", "name": "Port Angeles",
         "lat": 48.125, "lon": -123.440},
        {"type": "coops", "id": "9444900", "name": "Port Townsend",
         "lat": 48.1112, "lon": -122.7597},
    ],
    "Goose Point": [
        {"type": "coops", "id": "9440910", "name": "Toke Point",
         "lat": 46.7075, "lon": -123.9669},
    ],
    "Westcott": [
        {"type": "coops", "id": "9449880", "name": "Friday Harbor",
         "lat": 48.5453, "lon": -123.0125},
        {"type": "coops", "id": "9444900", "name": "Port Townsend",
         "lat": 48.1112, "lon": -122.7597},
    ],
}

TIDE_PREDICTION_CANDIDATES = {
    "Bainbridge Island": [
        {"id": "9447130", "name": "Seattle",
         "lat": 47.6026, "lon": -122.3393},
        {"id": "9445958", "name": "Bremerton",
         "lat": 47.5617, "lon": -122.6230},
    ],
    "Dabob Bay": [
        {"id": "9445246", "name": "Whitney Point, Dabob Bay",
         "lat": 47.7617, "lon": -122.85},
        {"id": "9445272", "name": "Quilcene, Quilcene Bay, Dabob Bay",
         "lat": 47.8, "lon": -122.858},
        {"id": "9445269", "name": "Zelatched Point, Dabob Bay",
         "lat": 47.7117, "lon": -122.822},
    ],
}

WATERSHED_CANDIDATES = {
    "Dabob Bay": [
        {"id": "12052210", "name": "Big Quilcene River below diversion near Quilcene, WA",
         "lat": 47.78450887, "lon": -122.9795778},
        {"id": "12051900", "name": "Little Quilcene River below diversion near Quilcene, WA",
         "lat": 47.87481306, "lon": -122.9596127},
        {"id": "12054000", "name": "Duckabush River near Brinnon, WA",
         "lat": 47.68398059, "lon": -123.011551},
    ],
}

METRIC_DEFS = {
    "water_temperature_C": {"label": "Water temp", "unit": "°C"},
    "tide_height_m": {"label": "Tide height", "unit": "m MLLW"},
    "next_tide_height_m": {"label": "Next tide", "unit": "m MLLW"},
    "air_temperature_C": {"label": "Air temp", "unit": "°C"},
    "air_pressure_mb": {"label": "Pressure", "unit": "mb"},
    "wind_speed_m_s": {"label": "Wind", "unit": "m/s"},
    "wind_gust_m_s": {"label": "Gust", "unit": "m/s"},
    "wind_direction_deg": {"label": "Wind dir", "unit": "°"},
    "salinity_psu": {"label": "Salinity", "unit": "psu"},
    "conductivity": {"label": "Conductivity", "unit": ""},
    "relative_humidity_percent": {"label": "Humidity", "unit": "%"},
    "wave_height_m": {"label": "Wave height", "unit": "m"},
    "chlorophyll_fluorescence": {"label": "Chlorophyll", "unit": "RFU"},
    "streamflow_cfs": {"label": "Streamflow", "unit": "ft3/s"},
}

NDBC_COLUMNS = {
    "WVHT": "wave_height_m",
    "PRES": "air_pressure_mb",
    "ATMP": "air_temperature_C",
    "WTMP": "water_temperature_C",
    "WSPD": "wind_speed_m_s",
    "GST": "wind_gust_m_s",
    "WDIR": "wind_direction_deg",
    "SAL": "salinity_psu",
}

COOPS_PRODUCTS = {
    "water_temperature": ("water_temperature_C", "v"),
    "air_temperature": ("air_temperature_C", "v"),
    "air_pressure": ("air_pressure_mb", "v"),
    "humidity": ("relative_humidity_percent", "v"),
    "salinity": ("salinity_psu", "s"),
    "conductivity": ("conductivity", "v"),
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


def metric_payload(key, value, observed_at, source_url, station, provider):
    if value is None:
        return None
    spec = METRIC_DEFS[key]
    return {
        "key": key,
        "label": spec["label"],
        "unit": spec["unit"],
        "value": round(value, 1),
        "observed_at": observed_at,
        "source_url": source_url,
        "station_id": station["id"],
        "station_name": station["name"],
        "provider": provider,
        "station_lat": station["lat"],
        "station_lon": station["lon"],
    }


def read_ndbc(station):
    """Latest valid meteorological values from an NDBC realtime2 file."""
    url = f"https://www.ndbc.noaa.gov/data/realtime2/{station['id']}.txt"
    text = fetch(url)
    header = None
    rows = []
    for ln in text.splitlines():
        if not ln:
            continue
        if ln.startswith("#YY"):
            header = ln.lstrip("#").split()
        elif not ln.startswith("#"):
            rows.append(ln)
    if not header:
        return {}
    for ln in rows:  # newest row first
        c = ln.split()
        if len(c) < 5:
            continue
        try:
            dt = datetime(int(c[0]), int(c[1]), int(c[2]), int(c[3]), int(c[4]),
                          tzinfo=timezone.utc)
        except ValueError:
            continue
        if age_hours(dt) > MAX_AGE_HOURS:
            return {}

        observed_at = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        metrics = {}
        for col, key in NDBC_COLUMNS.items():
            if col not in header:
                continue
            idx = header.index(col)
            if idx >= len(c) or c[idx] in ("MM", ""):
                continue
            try:
                value = float(c[idx])
            except ValueError:
                continue
            payload = metric_payload(key, value, observed_at, url, station, PROVIDER["ndbc"])
            if payload:
                metrics[key] = payload
        return metrics
    return {}


def read_coops_product(station, product):
    url = ("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
           f"?product={product}&date=latest"
           f"&station={station['id']}&units=metric&time_zone=gmt"
           "&format=json&application=mock-farm-dashboard")
    data = json.loads(fetch(url))
    rows = data.get("data")
    if not rows:
        return None
    row = rows[-1]
    try:
        key, value_field = COOPS_PRODUCTS[product]
        val = float(row[value_field])
        dt = datetime.strptime(row["t"], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except (KeyError, ValueError):
        return None
    if age_hours(dt) > MAX_AGE_HOURS:
        return None
    return metric_payload(
        key,
        val,
        dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        url,
        station,
        PROVIDER["coops"],
    )


def read_coops(station):
    """Latest valid CO-OPS meteorological products."""
    metrics = {}
    for product in COOPS_PRODUCTS:
        try:
            payload = read_coops_product(station, product)
        except Exception:
            payload = None
        if payload:
            metrics[payload["key"]] = payload
    try:
        wind = read_coops_wind(station)
    except Exception:
        wind = {}
    metrics.update(wind)
    return metrics


def read_coops_wind(station):
    url = ("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
           "?product=wind&date=latest"
           f"&station={station['id']}&units=metric&time_zone=gmt"
           "&format=json&application=mock-farm-dashboard")
    data = json.loads(fetch(url))
    rows = data.get("data")
    if not rows:
        return {}
    row = rows[-1]
    try:
        dt = datetime.strptime(row["t"], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except (KeyError, ValueError):
        return {}
    if age_hours(dt) > MAX_AGE_HOURS:
        return {}

    observed_at = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    fields = {
        "s": "wind_speed_m_s",
        "g": "wind_gust_m_s",
        "d": "wind_direction_deg",
    }
    metrics = {}
    for field, key in fields.items():
        try:
            value = float(row[field])
        except (KeyError, ValueError):
            continue
        payload = metric_payload(key, value, observed_at, url, station, PROVIDER["coops"])
        if payload:
            metrics[key] = payload
    return metrics


def read_coops_tide(station):
    url = ("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
           "?product=water_level&date=latest&datum=MLLW"
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
    return metric_payload(
        "tide_height_m",
        val,
        dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        url,
        station,
        PROVIDER["coops"],
    )


def read_coops_tide_prediction(station):
    url = ("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
           "?product=predictions&date=today&datum=MLLW&interval=hilo"
           f"&station={station['id']}&units=metric&time_zone=gmt"
           "&format=json&application=mock-farm-dashboard")
    data = json.loads(fetch(url))
    rows = data.get("predictions")
    if not rows:
        return None
    now = datetime.now(timezone.utc)
    upcoming = []
    for row in rows:
        try:
            dt = datetime.strptime(row["t"], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
            val = float(row["v"])
        except (KeyError, ValueError):
            continue
        if dt >= now:
            upcoming.append((dt, val, row.get("type")))
    if not upcoming:
        return None
    dt, val, tide_type = min(upcoming, key=lambda item: item[0])
    kind = "high" if tide_type == "H" else "low" if tide_type == "L" else "tide"
    payload = metric_payload(
        "next_tide_height_m",
        val,
        dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        url,
        station,
        "NOAA CO-OPS",
    )
    if payload:
        payload["note"] = f"Predicted {kind} at {dt.strftime('%Y-%m-%d %H:%M')} UTC"
    return payload


def read_usgs_streamflow(station):
    url = ("https://waterservices.usgs.gov/nwis/iv/"
           f"?format=json&sites={station['id']}&parameterCd=00060"
           "&period=P1D&siteStatus=all")
    data = json.loads(fetch(url))
    series = data.get("value", {}).get("timeSeries", [])
    if not series:
        return None
    values = series[0].get("values", [])
    if not values or not values[0].get("value"):
        return None
    for row in reversed(values[0]["value"]):
        try:
            val = float(row["value"])
            dt = datetime.fromisoformat(row["dateTime"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            continue
        dt_utc = dt.astimezone(timezone.utc)
        if age_hours(dt_utc) > MAX_AGE_HOURS:
            return None
        payload = metric_payload(
            "streamflow_cfs",
            val,
            dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            url,
            station,
            "USGS NWIS",
        )
        if payload:
            payload["note"] = "Nearby watershed freshwater-flow context; not an in-lagoon sensor."
        return payload
    return None


READERS = {"ndbc": read_ndbc, "coops": read_coops}
PROVIDER = {"ndbc": "NOAA NDBC", "coops": "NOAA CO-OPS"}


def resolve_site(site):
    slat, slon = SITES[site]
    tried = []
    metrics = {}
    for cand in STATION_CANDIDATES[site]:
        tried.append(cand["id"])
        try:
            readings = READERS[cand["type"]](cand)
        except Exception as e:  # network / parse — fall through to next candidate
            print(f"  ! {site}: {cand['id']} failed ({e.__class__.__name__})",
                  file=sys.stderr)
            readings = {}
        if not readings:
            continue
        for key, payload in readings.items():
            if key in metrics:
                continue
            metrics[key] = {
                **payload,
                "distance_km": haversine_km(slat, slon, payload["station_lat"], payload["station_lon"]),
            }

    for cand in TIDE_STATION_CANDIDATES[site]:
        if cand["id"] not in tried:
            tried.append(cand["id"])
        try:
            tide = read_coops_tide(cand)
        except Exception as e:
            print(f"  ! {site}: tide {cand['id']} failed ({e.__class__.__name__})",
                  file=sys.stderr)
            tide = None
        if tide:
            metrics[tide["key"]] = {
                **tide,
                "distance_km": haversine_km(slat, slon, tide["station_lat"], tide["station_lon"]),
            }
            break

    for cand in TIDE_PREDICTION_CANDIDATES.get(site, []):
        if cand["id"] not in tried:
            tried.append(cand["id"])
        try:
            prediction = read_coops_tide_prediction(cand)
        except Exception as e:
            print(f"  ! {site}: tide prediction {cand['id']} failed ({e.__class__.__name__})",
                  file=sys.stderr)
            prediction = None
        if prediction:
            metrics[prediction["key"]] = {
                **prediction,
                "distance_km": haversine_km(slat, slon, prediction["station_lat"], prediction["station_lon"]),
            }
            break

    for cand in WATERSHED_CANDIDATES.get(site, []):
        if cand["id"] not in tried:
            tried.append(cand["id"])
        try:
            streamflow = read_usgs_streamflow(cand)
        except Exception as e:
            print(f"  ! {site}: streamflow {cand['id']} failed ({e.__class__.__name__})",
                  file=sys.stderr)
            streamflow = None
        if streamflow:
            metrics[streamflow["key"]] = {
                **streamflow,
                "distance_km": haversine_km(slat, slon, streamflow["station_lat"], streamflow["station_lon"]),
            }
            break

    chlorophyll = CHLOROPHYLL_CANDIDATES[site]
    metrics["chlorophyll_fluorescence"] = {
        "key": "chlorophyll_fluorescence",
        "label": METRIC_DEFS["chlorophyll_fluorescence"]["label"],
        "unit": METRIC_DEFS["chlorophyll_fluorescence"]["unit"],
        "value": None,
        "observed_at": None,
        "source_url": chlorophyll["source_url"],
        "station_id": None,
        "station_name": chlorophyll["station_name"],
        "provider": chlorophyll["provider"],
        "status": "source-matched",
        "note": chlorophyll["note"],
    }

    water = metrics.get("water_temperature_C")
    primary = water or next((m for m in metrics.values() if m.get("value") is not None), None)
    if primary:
        return {
            "site": site,
            "station_id": primary.get("station_id"),
            "station_name": primary.get("station_name"),
            "provider": primary.get("provider"),
            "station_lat": primary.get("station_lat"),
            "station_lon": primary.get("station_lon"),
            "distance_km": primary.get("distance_km"),
            "temperature_C": water["value"] if water else None,
            "observed_at": water["observed_at"] if water else primary.get("observed_at"),
            "source_url": water["source_url"] if water else primary.get("source_url"),
            "metrics": metrics,
            "source_candidates": tried,
        }

    return {
        "site": site, "station_id": None, "station_name": None,
        "provider": None, "station_lat": None, "station_lon": None,
        "distance_km": None, "temperature_C": None, "observed_at": None,
        "source_url": None, "metrics": metrics,
        "source_candidates": tried,
        "note": f"No fresh NOAA reading from candidates: {', '.join(tried)}",
    }


def main():
    observations = [resolve_site(site) for site in SITES]
    got = sum(1 for o in observations if o["temperature_C"] is not None)
    if got == 0 and os.path.exists(OUT):
        with open(OUT) as existing:
            previous = json.load(existing)
        previous_got = sum(
            1 for o in previous.get("observations", [])
            if o.get("temperature_C") is not None
        )
        if previous_got > 0:
            print(
                f"No fresh NOAA readings; preserving existing {OUT} "
                f"with {previous_got}/{len(previous.get('observations', []))} sites."
            )
            return 0

    bundle = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "description": (
            "Near-live environmental observations from matched NOAA NDBC buoys, "
            "NOAA CO-OPS stations, and NANOOS shellfish water-quality sources. "
            "Refreshed on a schedule by scripts/build_live_temperature.py; not "
            "the in-situ HOBO loggers."),
        "maxAgeHours": MAX_AGE_HOURS,
        "metricDefinitions": METRIC_DEFS,
        "sites": list(SITES.keys()),
        "observations": observations,
    }
    # Stable key order; pretty enough to diff cleanly in git.
    with open(OUT, "w") as f:
        json.dump(bundle, f, indent=2)
        f.write("\n")

    print(f"Wrote {OUT} — {got}/{len(observations)} sites with a fresh water temperature")
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
