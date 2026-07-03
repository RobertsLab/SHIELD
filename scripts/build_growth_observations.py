#!/usr/bin/env python3
"""
Build SHIELD growth observations from RobertsLab growth CSV outputs.

Each source row is an individual oyster volume estimate. The dashboard keeps
those rows as observation records so treatment/site means and error bars are
computed from the underlying measurements.

Run: python3 scripts/build_growth_observations.py
"""
import csv
import json
import math
import os
from datetime import datetime
from urllib.request import urlopen


HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
OUT = os.path.join(REPO, "src", "data", "growthObservations.json")

MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]
SOURCES = [
    {
        "site": "Baywater",
        "repo": "RobertsLab/10K-seed-Cgigas",
        "url": "https://raw.githubusercontent.com/RobertsLab/10K-seed-Cgigas/main/output/baywater_growth.csv",
    },
    {
        "site": "Goose Point",
        "repo": "RobertsLab/project-gigas-conditioning",
        "url": "https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/goosepoint_growth.csv",
    },
    {
        "site": "Sequim Bay",
        "repo": "RobertsLab/project-gigas-conditioning",
        "url": "https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/sequim_growth.csv",
    },
    {
        "site": "Sequim Bay",
        "repo": "RobertsLab/polyIC-larvae",
        "url": "https://raw.githubusercontent.com/RobertsLab/polyIC-larvae/main/output/sequim_polyic_growth.csv",
        "default_experiment": "PolyIC",
    },
    {
        "site": "Westcott",
        "repo": "RobertsLab/project-gigas-conditioning",
        "url": "https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/westcott_growth.csv",
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
    for key in ("purple.tag", "field_cattle_tag", "bag", "tag", "bag_tag_num"):
        if row.get(key):
            return row[key]
    return None


def oyster_for(row):
    for key in ("oyster", "oyster_no"):
        if row.get(key):
            return row[key]
    return None


def volume_for(row):
    return number(row.get("Predicted_Volume_Poly", row.get("vol")))


records = []
source_rows = {}
record_counts = {}

for source in SOURCES:
    rows = read_csv(source["url"])
    source_rows[source["site"]] = source_rows.get(source["site"], 0) + len(rows)

    for idx, row in enumerate(rows):
        volume = volume_for(row)
        if volume is None:
            continue

        dstr = parse_date(row["date"])
        experiment = row.get("experiment") or source.get("default_experiment") or ""
        treatment = normal_treatment(row.get("treatment"), experiment)
        tag = tag_for(row)
        oyster = oyster_for(row)
        fields = date_fields(dstr)

        records.append({
            "id": f"GROW-{source['site'].upper().replace(' ', '-')}-{dstr}-{idx}",
            **fields,
            "site": source["site"],
            "treatment": treatment,
            "raw_treatment": row.get("treatment"),
            "effort": experiment or "Growth assay",
            "tag": tag,
            "oyster_number": oyster,
            "growth_mm": None,
            "growth_volume": round(volume, 1),
            "growth_metric": "Predicted_Volume_Poly" if "Predicted_Volume_Poly" in row else "vol",
            "temperature_C": None,
            "survival_percent": None,
            "survival_source": "none",
            "growth_source": "measured-volume",
            "temperature_source": "none",
            "source_repo": source["repo"],
            "source_url": source["url"],
        })
        record_counts[source["site"]] = record_counts.get(source["site"], 0) + 1

records.sort(key=lambda r: (r["site"], r["treatment"], r["date"], str(r["tag"]), str(r["oyster_number"])))
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
        "source": "RobertsLab growth CSV outputs",
        "studyTitle": "Crassostrea gigas individual oyster growth volume",
        "recordCount": len(records),
        "sourceRows": source_rows,
        "recordCounts": record_counts,
        "growthMetric": "Predicted oyster volume from image-derived models",
        "sourceUrls": [source["url"] for source in SOURCES],
    },
    "sites": sites,
    "treatments": treatments,
    "years": years,
    "observations": records,
}

with open(OUT, "w") as f:
    json.dump(bundle, f, indent=0)

print(f"Wrote {len(records)} growth records to {OUT}")
print("Sites:", sites)
print("Treatments:", treatments)
print("Years:", years)
