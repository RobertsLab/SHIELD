#!/usr/bin/env python3
"""
Build SHIELD field observation records from the RobertsLab
`project-gigas-conditioning` repository (plus Thorndyke Bay 10K-Seed survival
anchors quoted in the lab notebooks).

Each output record is one site x treatment x assessment-date measurement. A
metric is populated ONLY where it was actually measured; otherwise it is null
(the dashboard aggregations are null-safe). Temperature is the real monthly
mean from in-situ HOBO loggers, reused from public/data/archivalTemperatureData.json,
so run scripts/buildArchivalTemperature.mjs first (or `npm run build:data`).

Inputs are read from the public GitHub repository by default. Set the
`PGC_SOURCE` environment variable to a local checkout path to build offline:

    PGC_SOURCE=~/GitHub/project-gigas-conditioning python3 scripts/build_real_observations.py

Hybrid treatment mapping: real groups are normalized onto the dashboard's
treatment axis, and the original experiment is preserved in `effort`.

  Control (any)                  -> Control
  Temperature / thermal treated  -> Heat primed
  Fresh water treated            -> Freshwater primed
  polyIC / immune                -> Immune primed        (Thorndyke Bay 10K-Seed only)
  FW + temperature               -> Combined stress primed (Thorndyke Bay 10K-Seed only)

Requires pandas and openpyxl (see requirements.txt).

Output: public/data/realObservations.json in the compact bundle format
described in shield_data.py.
"""
import io
import json
import os
import sys
from collections import defaultdict
from datetime import datetime

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shield_data import (  # noqa: E402
    compact_bundle,
    data_path,
    fetch_bytes,
    report,
    utc_today,
    write_bundle,
)

DEFAULT_SOURCE = "https://raw.githubusercontent.com/RobertsLab/project-gigas-conditioning/main"
SOURCE = os.environ.get("PGC_SOURCE", DEFAULT_SOURCE).rstrip("/")
OUT = data_path("realObservations.json")
ARCHIVAL = data_path("archivalTemperatureData.json")

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

COLUMNS = [
    "date", "site", "treatment", "effort", "growth_mm", "temperature_C",
    "survival_percent", "survival_source", "growth_source",
]
LOOKUP_COLUMNS = ["site", "treatment", "effort", "survival_source", "growth_source"]
CONSTANTS = {"temperature_source": "logger-monthly-mean"}


# ---------------------------------------------------------------------------
# Input access: remote by default, local checkout via PGC_SOURCE
# ---------------------------------------------------------------------------
def source_is_local():
    return os.path.isdir(os.path.expanduser(SOURCE))


def source_exists(relpath):
    if source_is_local():
        return os.path.exists(os.path.join(os.path.expanduser(SOURCE), relpath))
    try:
        fetch_bytes(f"{SOURCE}/{relpath}")
        return True
    except RuntimeError:
        return False


def source_handle(relpath):
    """Binary file-like object for a repository-relative path."""
    if source_is_local():
        return open(os.path.join(os.path.expanduser(SOURCE), relpath), "rb")
    print(f"  fetching {relpath}", file=sys.stderr)
    return io.BytesIO(fetch_bytes(f"{SOURCE}/{relpath}"))


def read_csv(relpath):
    with source_handle(relpath) as handle:
        return pd.read_csv(handle)


def read_excel(relpath):
    with source_handle(relpath) as handle:
        return pd.read_excel(handle)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def parse_ymd(v):
    """Accept '20240624', '2024-06-24', or a Timestamp -> date string YYYY-MM-DD."""
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    if "-" in s:
        return s[:10]
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"


def round1(x):
    if x is None:
        return None
    try:
        if pd.isna(x):
            return None
    except (TypeError, ValueError):
        pass
    return round(float(x) * 10) / 10


# Real monthly mean temperature per site (from the logger archival bundle)
def monthly_temps():
    with open(ARCHIVAL, encoding="utf-8") as handle:
        arch = json.load(handle)
    acc = defaultdict(lambda: defaultdict(list))
    for row in arch["series"]:
        ym = row["date"][:7]
        for site in arch["sites"]:
            if site in row and row[site] is not None:
                acc[site][ym].append(row[site])
    return {site: {ym: sum(v) / len(v) for ym, v in months.items()}
            for site, months in acc.items()}


MONTHLY_TEMP = monthly_temps()


def temp_for(site, dstr):
    ym = dstr[:7]
    site_t = MONTHLY_TEMP.get(site, {})
    if ym in site_t:
        return round1(site_t[ym])
    # nearest available month within the same site
    if site_t:
        target = datetime.strptime(ym + "-01", "%Y-%m-%d")
        best = min(site_t, key=lambda m: abs(
            (datetime.strptime(m + "-01", "%Y-%m-%d") - target).days))
        return round1(site_t[best])
    return None


records = []
notes = {}


def emit(site, treatment, effort, dstr, survival=None, growth=None,
         survival_src="estimated", growth_src="estimated"):
    records.append({
        "date": dstr,
        "site": site,
        "treatment": treatment,
        "effort": effort,
        "growth_mm": round1(growth),
        "temperature_C": temp_for(site, dstr),
        "survival_percent": round1(survival),
        "survival_source": survival_src if survival is not None else "none",
        "growth_source": growth_src if growth is not None else "none",
    })


# ---------------------------------------------------------------------------
# PALIX RIVER/WILLAPA BAY  (Effort E: weekly temperature / weekly fresh water)
# ---------------------------------------------------------------------------
def palix_river_willapa_bay():
    surv = read_csv("data/outplanting/GoosePoint/survival_GoosePoint.csv")
    grow = read_csv("data/outplanting/GoosePoint/growth_GoosePoint.csv")
    bags = read_csv("data/outplanting/GoosePoint/bag_list_GoosePoint.csv")

    def norm(group):
        g = str(group).lower()
        if "treated" in g and "temperature" in g:
            return "Heat primed", "Effort E — weekly temperature"
        if "treated" in g and "fresh" in g:
            return "Freshwater primed", "Effort E — weekly fresh water"
        if "fresh" in g:
            return "Control", "Effort E — weekly fresh water"
        return "Control", "Effort E — weekly temperature"

    # survival: live/total per bag -> mean per (treatment, date)
    surv = surv.copy()
    surv["dstr"] = surv["date"].map(parse_ymd)
    surv[["trt", "eff"]] = surv["treatment"].apply(lambda g: pd.Series(norm(g)))
    surv["surv_pct"] = surv["live"] / surv["total"] * 100

    # growth: join tag -> group -> treatment; mean length per (treatment, date)
    tag2grp = dict(zip(bags["field_cattle_tag"], bags["group"]))
    grow = grow.copy()
    grow["dstr"] = grow["date"].map(parse_ymd)
    grow["group"] = grow["field_cattle_tag"].map(tag2grp)
    grow = grow.dropna(subset=["group", "length.mm"])
    grow[["trt", "eff"]] = grow["group"].apply(lambda g: pd.Series(norm(g)))

    survg = surv.groupby(["trt", "dstr"]).agg(
        surv=("surv_pct", "mean"),
        effs=("eff", lambda s: "; ".join(sorted(set(s))))).reset_index()
    growg = grow.groupby(["trt", "dstr"]).agg(
        grow=("length.mm", "mean"),
        effs=("eff", lambda s: "; ".join(sorted(set(s))))).reset_index()

    keys = {}
    for _, r in survg.iterrows():
        keys[(r["trt"], r["dstr"])] = {"surv": r["surv"], "eff": r["effs"]}
    for _, r in growg.iterrows():
        k = (r["trt"], r["dstr"])
        keys.setdefault(k, {"surv": None, "eff": r["effs"]})
        keys[k]["grow"] = r["grow"]

    for (trt, dstr), v in sorted(keys.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        emit("Palix River/Willapa Bay", trt, v.get("eff", "Effort E"), dstr,
             survival=v.get("surv"), growth=v.get("grow"),
             survival_src="measured", growth_src="measured")
    notes["Palix River/Willapa Bay"] = (
        "Effort E (2023 POGS), weekly temperature + fresh water hardening; control/treated. "
        "Real survival (live/total) and image-derived shell length.")


# ---------------------------------------------------------------------------
# SEQUIM  (Effort A: daily thermal hardening, control/treated)
# ---------------------------------------------------------------------------
def sequim():
    surv = read_csv("data/outplanting/Sequim/survival_Sequim.csv")
    size = read_excel("data/outplanting/Sequim/size_Sequim.xlsx")
    bags = read_csv("data/outplanting/Sequim/bag_list_Sequim.csv")

    def norm(t):
        return ("Heat primed" if str(t).strip().lower() == "treated" else "Control",
                "Effort A — daily thermal")

    surv = surv.copy()
    surv["dstr"] = surv["date"].map(parse_ymd)
    surv["alive"] = pd.to_numeric(surv["alive"], errors="coerce")
    surv["dead"] = pd.to_numeric(surv["dead"], errors="coerce").fillna(0)
    surv[["trt", "eff"]] = surv["treatment"].apply(lambda t: pd.Series(norm(t)))

    # Per bag: baseline N0 = first alive + dead that visit; survival = (N0 - cum dead)/N0
    rows = []
    for _, g in surv.sort_values("dstr").groupby("bag"):
        g = g.copy()
        first = g.iloc[0]
        n0 = (first["alive"] if pd.notna(first["alive"]) else 0) + first["dead"]
        if not n0:
            continue
        cum = 0
        for _, r in g.iterrows():
            cum += r["dead"]
            rows.append({"trt": r["trt"], "eff": r["eff"], "dstr": r["dstr"],
                         "surv": (n0 - cum) / n0 * 100})
    sdf = pd.DataFrame(rows).groupby(["trt", "dstr"]).agg(
        surv=("surv", "mean"), eff=("eff", "first")).reset_index()

    # size -> treatment via bag_list
    bag2trt = {b: norm(t)[0] for b, t in zip(bags["bag"], bags["treatment"])}
    size = size.copy()
    size["dstr"] = size["date"].map(parse_ymd)
    size["trt"] = size["bag"].map(bag2trt)
    size = size.dropna(subset=["trt", "length.mm"])
    gdf = size.groupby(["trt", "dstr"]).agg(grow=("length.mm", "mean")).reset_index()

    keys = {}
    for _, r in sdf.iterrows():
        keys[(r["trt"], r["dstr"])] = {"surv": r["surv"], "eff": r["eff"]}
    for _, r in gdf.iterrows():
        k = (r["trt"], r["dstr"])
        keys.setdefault(k, {"surv": None, "eff": "Effort A — daily thermal"})
        keys[k]["grow"] = r["grow"]

    for (trt, dstr), v in sorted(keys.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        emit("Sequim Bay", trt, v.get("eff", "Effort A"), dstr,
             survival=v.get("surv"), growth=v.get("grow"),
             survival_src="measured", growth_src="measured")
    notes["Sequim Bay"] = (
        "Effort A (2 weeks daily 25°C thermal hardening), control/treated. "
        "Real survival from cumulative mortality; image-derived shell length.")


# ---------------------------------------------------------------------------
# WESTCOTT  (Effort B daily / Effort D weekly thermal hardening, control/treated)
# ---------------------------------------------------------------------------
def westcott():
    frames = []
    for eff_file, eff_label in [
        ("B_survival_12022025.xlsx", "Effort B — daily thermal"),
        ("D_survival_12022025.xlsx", "Effort D — weekly thermal"),
    ]:
        relpath = f"data/survival/Westcott/{eff_file}"
        if not source_exists(relpath):
            print(f"  ! missing {relpath}; skipping", file=sys.stderr)
            continue
        df = read_excel(relpath).copy()
        df["eff_label"] = eff_label
        frames.append(df)
    if not frames:
        return
    surv = pd.concat(frames, ignore_index=True)
    surv["dstr"] = surv["date"].map(parse_ymd)
    surv["alive_num"] = pd.to_numeric(surv["alive_num"], errors="coerce")
    # conditioning is 'control' vs the hardened group ('daily'/'weekly'/'treated')
    surv["trt"] = surv["conditioning"].apply(
        lambda c: "Control" if str(c).strip().lower() == "control" else "Heat primed")

    # Per bag baseline = first alive_num; survival = alive_num / N0 * 100
    rows = []
    for (_, eff), g in surv.sort_values("dstr").groupby(["bag_num", "eff_label"]):
        g = g.dropna(subset=["alive_num"])
        if g.empty:
            continue
        n0 = g.iloc[0]["alive_num"]
        if not n0:
            continue
        for _, r in g.iterrows():
            # cap at 100% since later counts can exceed the first due to recount noise
            rows.append({"trt": r["trt"], "eff": eff, "dstr": r["dstr"],
                         "surv": min(100.0, r["alive_num"] / n0 * 100)})
    sdf = pd.DataFrame(rows).groupby(["trt", "dstr"]).agg(
        surv=("surv", "mean"),
        eff=("eff", lambda s: "; ".join(sorted(set(s))))).reset_index()

    for _, r in sdf.sort_values(["dstr", "trt"]).iterrows():
        emit("Westcott", r["trt"], r["eff"], r["dstr"],
             survival=r["surv"], survival_src="measured")
    notes["Westcott"] = (
        "Efforts B (daily) & D (weekly) thermal hardening, control/treated. "
        "Real survival (alive/initial per bag). Image growth not yet calibrated to mm.")


# ---------------------------------------------------------------------------
# THORNDYKE BAY  (10K-Seed, 5 treatments): survival anchors quoted in lab notebooks
# (raw data lives in RobertsLab/10K-seed-Cgigas, not in project-gigas-conditioning)
# ---------------------------------------------------------------------------
def thorndyke_bay():
    # Measured survival %, Thorndyke Bay 10K-Seed assessment 2025-08-20 (n=150/bag)
    anchor = {
        "Control": 43.1,
        "Heat primed": 41.6,
        "Freshwater primed": 40.1,
        "Immune primed": 11.7,
        "Combined stress primed": 50.1,
    }
    for trt, pct in anchor.items():
        emit("Thorndyke Bay", trt, "10K-Seed (hardening)", "2025-08-20",
             survival=pct, survival_src="measured")
    notes["Thorndyke Bay"] = (
        "10K-Seed hardening (Control / 35C / FW / polyIC / FW+35C). Survival measured "
        "2025-08-20 (n=150/bag); source repo RobertsLab/10K-seed-Cgigas. Growth not published numerically.")


def main():
    print(f"Reading project-gigas-conditioning inputs from {SOURCE}", file=sys.stderr)
    palix_river_willapa_bay()
    sequim()
    westcott()
    thorndyke_bay()

    records.sort(key=lambda r: (r["site"], r["treatment"], r["date"]))

    meta = {
        "generatedAt": utc_today(),
        "source": "RobertsLab/project-gigas-conditioning (+ 10K-Seed survival anchors)",
        "inputSource": SOURCE,
        "studyTitle": "Crassostrea gigas stress-hardening outplant program",
        "siteNotes": notes,
        "treatmentMapping": {
            "Control": "untreated control (any effort)",
            "Heat primed": "temperature / thermal hardening (treated)",
            "Freshwater primed": "fresh water / low-salinity hardening (treated)",
            "Immune primed": "polyIC / immune challenge (Thorndyke Bay 10K-Seed)",
            "Combined stress primed": "fresh water + temperature (Thorndyke Bay 10K-Seed)",
        },
    }
    write_bundle(OUT, compact_bundle(records, COLUMNS, LOOKUP_COLUMNS, CONSTANTS, meta))
    report(records, OUT, "field observation")
    sites = sorted({r["site"] for r in records})
    for s in sites:
        srv = [r for r in records if r["site"] == s and r["survival_percent"] is not None]
        grw = [r for r in records if r["site"] == s and r["growth_mm"] is not None]
        print(f"  {s:24} records={sum(1 for r in records if r['site'] == s):3}  "
              f"survival_pts={len(srv):3}  growth_pts={len(grw):3}  "
              f"dates={len({r['date'] for r in records if r['site'] == s})}")


if __name__ == "__main__":
    main()
