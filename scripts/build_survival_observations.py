#!/usr/bin/env python3
"""
Build SHIELD survival observations from RobertsLab survival CSV outputs.

Companion to build_growth_observations.py. Each source row is one bag/replicate
percent-survival value. The dashboard keeps those rows as observation records so
treatment/site means and error bars are computed from the underlying replicates.

Survival files use the same treatment identifiers as the growth files:
  - Westcott reports survival at each assessment date (per-timepoint rows).
  - Baywater and Goose Point report a single total (end-of-period) survival per
    bag; those sites are stamped with their assessment date below.

All source files carry survival as a 0-1 proportion, stored here as a 0-100
percent to match the rest of the dashboard.

Run: python3 scripts/build_survival_observations.py
"""
import csv
import json
import math
import os
from datetime import datetime
from urllib.request import urlopen


HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
OUT = os.path.join(REPO, "src", "data", "survivalObservations.json")

MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

# Survival value column varies by source; checked in this order per row.
SURVIVAL_KEYS = ("survival", "percent_survival", "proportion_remaining")

SOURCES = [
    {
        "site": "Baywater",
        "repo": "RobertsLab/10K-seed-Cgigas",
        "url": "https://raw.githubusercontent.com/RobertsLab/10K-seed-Cgigas/main/output/baywater_survival.csv",
        # Total survival; assessment date is embedded in the source column names.
        "default_date": "2025-08-20",
    },
    {
        "site": "Goose Point",
        "repo": "RobertsLab/project-gigas-conditioning",
        "url": "https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/goosepoint_survival.csv",
        # Total survival, no date column; stamped with the latest program assessment.
        "default_date": "2026-05-22",
    },
    {
        "site": "Westcott",
        "repo": "RobertsLab/project-gigas-conditioning",
        "url": "https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/westcott_survival.csv",
        # Per-timepoint survival; date comes from the row.
    },
]


def parse_date(value):
    text = str(value).strip()
    if "-" in text:
        return text[:10]
    return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"


def date_fields(dstr):
    dt = datetime.strptime(dstr, "%Y-%m-%d")
    return {
        "date": dstr,
        "year": str(dt.year),
        "month": MONTHS[dt.month - 1],
        "quarter": f"Q{(dt.month - 1) // 3 + 1}",
    }


def read_csv(url):
    with urlopen(url) as response:
        text = response.read().decode("utf-8-sig")
    return list(csv.DictReader(text.splitlines()))


def number(value):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def normal_treatment(raw_treatment, experiment=""):
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


def tag_for(row):
    for key in ("purple.tag", "corrected_tag", "bag_tag_num", "tag", "bag"):
        if row.get(key):
            return row[key]
    return None


def survival_for(row):
    for key in SURVIVAL_KEYS:
        if key in row:
            value = number(row.get(key))
            if value is not None:
                return round(value * 100, 1), key
    return None, None


records = []
source_rows = {}
record_counts = {}

for source in SOURCES:
    rows = read_csv(source["url"])
    source_rows[source["site"]] = source_rows.get(source["site"], 0) + len(rows)

    for idx, row in enumerate(rows):
        survival, survival_key = survival_for(row)
        if survival is None:
            continue

        raw_date = row.get("date") or source.get("default_date")
        dstr = parse_date(raw_date)
        experiment = row.get("experiment") or ""
        treatment = normal_treatment(row.get("treatment"), experiment)
        tag = tag_for(row)
        fields = date_fields(dstr)

        records.append({
            "id": f"SURV-{source['site'].upper().replace(' ', '-')}-{dstr}-{idx}",
            **fields,
            "site": source["site"],
            "treatment": treatment,
            "raw_treatment": row.get("treatment"),
            "effort": experiment or "Survival assay",
            "tag": tag,
            "oyster_number": None,
            "growth_mm": None,
            "growth_volume": None,
            "growth_metric": None,
            "temperature_C": None,
            "survival_percent": survival,
            "survival_metric": survival_key,
            "survival_source": "measured",
            "growth_source": "none",
            "temperature_source": "none",
            "source_repo": source["repo"],
            "source_url": source["url"],
        })
        record_counts[source["site"]] = record_counts.get(source["site"], 0) + 1

records.sort(key=lambda r: (r["site"], r["treatment"], r["date"], str(r["tag"])))
for i, record in enumerate(records):
    record["id"] = f"{record['id']}-{i}"

sites = sorted({r["site"] for r in records})
treatment_order = [
    "Control",
    "Heat primed",
    "Freshwater primed",
    "Immune primed",
    "Combined stress primed",
    "Treated",
]
treatments = [t for t in treatment_order if any(r["treatment"] == t for r in records)]
years = sorted({r["year"] for r in records})

bundle = {
    "meta": {
        "generatedAt": datetime.utcnow().strftime("%Y-%m-%d"),
        "source": "RobertsLab survival CSV outputs",
        "studyTitle": "Crassostrea gigas outplant percent survival by bag",
        "recordCount": len(records),
        "sourceRows": source_rows,
        "recordCounts": record_counts,
        "survivalMetric": "Percent survival per bag/replicate (0-100)",
        "notes": "Westcott has survival at each time point; Baywater and Goose Point report total (end-of-period) survival.",
        "sourceUrls": [source["url"] for source in SOURCES],
    },
    "sites": sites,
    "treatments": treatments,
    "years": years,
    "observations": records,
}

with open(OUT, "w") as f:
    json.dump(bundle, f, indent=0)

print(f"Wrote {len(records)} survival records to {OUT}")
print("Sites:", sites)
print("Treatments:", treatments)
print("Years:", years)
