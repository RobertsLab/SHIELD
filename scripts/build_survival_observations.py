#!/usr/bin/env python3
"""
Build SHIELD survival observations from RobertsLab survival CSV outputs.

Companion to build_growth_observations.py. Each source row is one bag/replicate
percent-survival value. The dashboard keeps those rows as observation records so
treatment/site means and error bars are computed from the underlying replicates.

Survival files use the same treatment identifiers as the growth files:
  - Westcott and Sequim Bay PolyIC report survival at each assessment date.
  - Thorndyke Bay and Palix River/Willapa Bay report a single total
    (end-of-period) survival per bag; those sites are stamped with their
    assessment date below.

All source files carry survival as a 0-1 proportion, stored here as a 0-100
percent to match the rest of the dashboard.

Output: public/data/survivalObservations.json in the compact bundle format
described in shield_data.py.

Run: python3 scripts/build_survival_observations.py
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

OUT = data_path("survivalObservations.json")

# Survival value column varies by source; checked in this order per row.
SURVIVAL_KEYS = (
    "survival",
    "percent_survival",
    "proportion_remaining",
    "prop_survival",
)

SOURCES = [
    {
        "site": "Thorndyke Bay",
        "repo": "RobertsLab/10K-seed-Cgigas",
        "url": "https://raw.githubusercontent.com/RobertsLab/10K-seed-Cgigas/main/output/baywater_survival.csv",
        # Total survival; assessment date is embedded in the source column names.
        "default_date": "2025-08-20",
    },
    {
        "site": "Palix River/Willapa Bay",
        "repo": "RobertsLab/project-gigas-conditioning",
        "url": "https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/goosepoint_survival.csv",
        # Total survival, no date column; stamped with the latest program assessment.
        "default_date": "2026-05-22",
    },
    {
        "site": "Sequim Bay",
        "repo": "RobertsLab/polyIC-larvae",
        "url": "https://raw.githubusercontent.com/RobertsLab/polyIC-larvae/main/output/sequim_polyic_survival.csv",
        "default_experiment": "PolyIC",
    },
    {
        "site": "Westcott",
        "repo": "RobertsLab/project-gigas-conditioning",
        "url": "https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main/output/westcott_survival.csv",
        # Per-timepoint survival; date comes from the row.
    },
]

COLUMNS = [
    "date", "site", "treatment", "raw_treatment", "effort", "tag",
    "survival_percent", "survival_metric", "source_repo", "source_url",
]
LOOKUP_COLUMNS = [
    "site", "treatment", "raw_treatment", "effort", "survival_metric",
    "source_repo", "source_url",
]
CONSTANTS = {
    "oyster_number": None,
    "growth_mm": None,
    "growth_volume": None,
    "growth_metric": None,
    "temperature_C": None,
    "survival_source": "measured",
    "growth_source": "none",
    "temperature_source": "none",
}


def tag_for(row):
    for key in ("purple.tag", "corrected_tag", "bag_tag_num", "outplant_tag", "tag", "bag"):
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


def build_records():
    records = []
    source_rows = {}
    record_counts = {}

    for source in SOURCES:
        rows = read_csv_url(source["url"])
        source_rows[source["site"]] = source_rows.get(source["site"], 0) + len(rows)

        for row in rows:
            survival, survival_key = survival_for(row)
            if survival is None:
                continue

            experiment = row.get("experiment") or source.get("default_experiment") or ""
            records.append({
                "date": parse_date(row.get("date") or source.get("default_date")),
                "site": source["site"],
                "treatment": normal_treatment(row.get("treatment"), experiment),
                "raw_treatment": row.get("treatment"),
                "effort": experiment or "Survival assay",
                "tag": tag_for(row),
                "survival_percent": survival,
                "survival_metric": survival_key,
                "source_repo": source["repo"],
                "source_url": source["url"],
            })
            record_counts[source["site"]] = record_counts.get(source["site"], 0) + 1

    records.sort(key=lambda r: (r["site"], r["treatment"], r["date"], str(r["tag"])))
    return records, source_rows, record_counts


def main():
    records, source_rows, record_counts = build_records()
    meta = {
        "generatedAt": utc_today(),
        "source": "RobertsLab survival CSV outputs",
        "studyTitle": "Crassostrea gigas outplant percent survival by bag",
        "sourceRows": source_rows,
        "recordCounts": record_counts,
        "survivalMetric": "Percent survival per bag/replicate (0-100)",
        "notes": "Westcott and Sequim Bay PolyIC have survival at each time point; Thorndyke Bay and Palix River/Willapa Bay report total (end-of-period) survival.",
        "sourceUrls": [source["url"] for source in SOURCES],
    }
    write_bundle(OUT, compact_bundle(records, COLUMNS, LOOKUP_COLUMNS, CONSTANTS, meta))
    report(records, OUT, "survival")


if __name__ == "__main__":
    main()
