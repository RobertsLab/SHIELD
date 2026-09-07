#!/usr/bin/env python3
"""
Build SHIELD growth observations from RobertsLab growth CSV outputs.

Each source row is an individual oyster volume estimate. The dashboard keeps
those rows as observation records so treatment/site means and error bars are
computed from the underlying measurements.

Output: public/data/growthObservations.json in the compact bundle format
described in shield_data.py.

Run: python3 scripts/build_growth_observations.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shield_data import (  # noqa: E402
    compact_bundle,
    data_path,
    normal_treatment,
    number,
    parse_date,
    read_csv_url,
    report,
    utc_today,
    write_bundle,
)

OUT = data_path("growthObservations.json")

SOURCES = [
    {
        "site": "Thorndyke Bay",
        "repo": "RobertsLab/10K-seed-Cgigas",
        "url": "https://raw.githubusercontent.com/RobertsLab/10K-seed-Cgigas/main/output/baywater_growth.csv",
    },
    {
        "site": "Palix River/Willapa Bay",
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

COLUMNS = [
    "date", "site", "treatment", "raw_treatment", "effort", "tag",
    "oyster_number", "growth_volume", "growth_metric", "source_repo", "source_url",
]
LOOKUP_COLUMNS = [
    "site", "treatment", "raw_treatment", "effort", "growth_metric",
    "source_repo", "source_url",
]
CONSTANTS = {
    "growth_mm": None,
    "temperature_C": None,
    "survival_percent": None,
    "survival_source": "none",
    "growth_source": "measured-volume",
    "temperature_source": "none",
}


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


def build_records():
    records = []
    source_rows = {}
    record_counts = {}

    for source in SOURCES:
        rows = read_csv_url(source["url"])
        source_rows[source["site"]] = source_rows.get(source["site"], 0) + len(rows)

        for row in rows:
            volume = volume_for(row)
            if volume is None:
                continue

            experiment = row.get("experiment") or source.get("default_experiment") or ""
            records.append({
                "date": parse_date(row["date"]),
                "site": source["site"],
                "treatment": normal_treatment(row.get("treatment"), experiment),
                "raw_treatment": row.get("treatment"),
                "effort": experiment or "Growth assay",
                "tag": tag_for(row),
                "oyster_number": oyster_for(row),
                "growth_volume": round(volume, 1),
                "growth_metric": "Predicted_Volume_Poly" if "Predicted_Volume_Poly" in row else "vol",
                "source_repo": source["repo"],
                "source_url": source["url"],
            })
            record_counts[source["site"]] = record_counts.get(source["site"], 0) + 1

    records.sort(key=lambda r: (r["site"], r["treatment"], r["date"], str(r["tag"]), str(r["oyster_number"])))
    return records, source_rows, record_counts


def main():
    records, source_rows, record_counts = build_records()
    meta = {
        "generatedAt": utc_today(),
        "source": "RobertsLab growth CSV outputs",
        "studyTitle": "Crassostrea gigas individual oyster growth volume",
        "sourceRows": source_rows,
        "recordCounts": record_counts,
        "growthMetric": "Predicted oyster volume from image-derived models",
        "sourceUrls": [source["url"] for source in SOURCES],
    }
    write_bundle(OUT, compact_bundle(records, COLUMNS, LOOKUP_COLUMNS, CONSTANTS, meta))
    report(records, OUT, "growth")


if __name__ == "__main__":
    main()
