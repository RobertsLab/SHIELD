"""
Shared helpers for the SHIELD data build scripts.

Everything the growth, survival, and field-observation scripts have in common
lives here so the treatment vocabulary, date handling, HTTP fetching, and the
compact bundle format cannot drift between them.

Compact bundle format (read by src/data/bundleFormat.js):

    {
      "format": "shield-observations/1",
      "meta": {...},
      "sites": [...], "treatments": [...], "years": [...],
      "columns": ["date", "site", ...],
      "lookups": {"site": ["Westcott", ...], ...},
      "constants": {"growth_mm": null, ...},
      "rows": [[...], ...]
    }

`columns` names the position of each value in a row. Columns listed in
`lookups` store an index into that column's value list instead of the value.
`constants` are fields identical on every record and are re-attached on load.
`year`, `month`, `quarter`, and `id` are derived from `date` and row position on
the client and are not stored.
"""
import csv
import json
import math
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
DATA_DIR = os.path.join(REPO, "public", "data")

BUNDLE_FORMAT = "shield-observations/1"

MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

# Dashboard treatment axis, in display order. Must match TREATMENT_ORDER in
# src/data/observations.js.
TREATMENT_ORDER = [
    "Control",
    "Heat primed",
    "Freshwater primed",
    "Immune primed",
    "Combined stress primed",
    "Treated",
]

HTTP_TIMEOUT = 60
HTTP_RETRIES = 3
USER_AGENT = "shield-dashboard-data-build"


def data_path(filename):
    """Absolute path of a bundle inside public/data/."""
    return os.path.join(DATA_DIR, filename)


def utc_today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def fetch_bytes(url):
    """GET a URL with a timeout and a few retries. Raises on final failure."""
    last_error = None
    for attempt in range(1, HTTP_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as response:
                return response.read()
        except Exception as error:  # network or HTTP error; retry with backoff
            last_error = error
            if attempt < HTTP_RETRIES:
                wait = 2 ** attempt
                print(f"  ! fetch failed ({error.__class__.__name__}), retrying in {wait}s: {url}",
                      file=sys.stderr)
                time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def fetch_text(url):
    return fetch_bytes(url).decode("utf-8-sig")


def read_csv_url(url):
    """Download a CSV and return a list of dict rows."""
    return list(csv.DictReader(fetch_text(url).splitlines()))


def parse_date(value):
    """Accept '20240624' or '2024-06-24...' and return 'YYYY-MM-DD'."""
    text = str(value).strip()
    if "-" in text:
        return text[:10]
    return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"


def year_of(dstr):
    datetime.strptime(dstr, "%Y-%m-%d")  # validate
    return dstr[:4]


def number(value):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def normal_treatment(raw_treatment, experiment=""):
    """Map a source treatment label (plus experiment hint) onto TREATMENT_ORDER."""
    treatment = str(raw_treatment).strip().lower()
    exp = str(experiment).strip().lower()

    if treatment == "control":
        return "Control"
    if "temperature+salinity" in treatment:
        return "Combined stress primed"
    if "immune" in treatment or "polyic" in treatment:
        return "Immune primed"
    if "salinity" in treatment or "fresh" in exp:
        return "Freshwater primed"
    if "temperature" in treatment or "temperature" in exp:
        return "Heat primed"
    if treatment == "treated":
        return "Treated"
    return str(raw_treatment).strip()


def site_slug(site):
    return re.sub(r"[^A-Z0-9]+", "-", site.upper()).strip("-")


def ordered_treatments(records):
    present = {r["treatment"] for r in records}
    return [t for t in TREATMENT_ORDER if t in present]


def compact_bundle(records, columns, lookup_columns, constants, meta):
    """Encode full records into the compact bundle shape."""
    lookups = {c: [] for c in lookup_columns}
    indexes = {c: {} for c in lookup_columns}
    rows = []
    for record in records:
        row = []
        for column in columns:
            value = record.get(column)
            if column in lookups and value is not None:
                index = indexes[column]
                if value not in index:
                    index[value] = len(lookups[column])
                    lookups[column].append(value)
                value = index[value]
            row.append(value)
        rows.append(row)

    return {
        "format": BUNDLE_FORMAT,
        "meta": {**meta, "recordCount": len(records)},
        "sites": sorted({r["site"] for r in records}),
        "treatments": ordered_treatments(records),
        "years": sorted({year_of(r["date"]) for r in records}),
        "columns": list(columns),
        "lookups": lookups,
        "constants": dict(constants),
        "rows": rows,
    }


def write_bundle(path, bundle):
    """Write a bundle with readable headers and one compact row per line."""
    head = dict(bundle)
    rows = head.pop("rows")
    head_text = json.dumps(head, indent=2, ensure_ascii=False)
    assert head_text.endswith("}")
    body = ",\n".join(
        json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows
    )
    text = head_text[:-1].rstrip() + ',\n  "rows": [\n' + body + "\n  ]\n}\n"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def expand_bundle(bundle):
    """Inverse of compact_bundle, without derived fields. Used for validation."""
    columns = bundle["columns"]
    lookups = bundle.get("lookups", {})
    constants = bundle.get("constants", {})
    records = []
    for row in bundle["rows"]:
        record = dict(constants)
        for column, value in zip(columns, row):
            if column in lookups and value is not None:
                value = lookups[column][value]
            record[column] = value
        records.append(record)
    return records


def report(records, out_path, label):
    print(f"Wrote {len(records)} {label} records to {out_path}")
    print("Sites:", sorted({r['site'] for r in records}))
    print("Treatments:", ordered_treatments(records))
    print("Years:", sorted({year_of(r['date']) for r in records}))
