#!/usr/bin/env python3
"""
Build real observation records for the Shellfish Farm Outplant Dashboard from
the RobertsLab `project-gigas-conditioning` repo (+ Baywater 10K-Seed survival
anchors quoted in the lab notebooks).

Each output record is one site x treatment x assessment-date measurement with
the dashboard schema. A metric is populated ONLY where it was actually measured;
otherwise it is null (the dashboard aggregations are null-safe). Temperature is
the real monthly mean from in-situ HOBO loggers (reused from
src/data/archivalTemperatureData.json).

Hybrid treatment mapping (per user choice): real groups are normalized onto the
dashboard's treatment axis, and the original experiment is preserved in `effort`.

  Control (any)                  -> Control
  Temperature / thermal treated  -> Heat primed
  Fresh water treated            -> Freshwater primed
  polyIC / immune                -> Immune primed        (Baywater 10K-Seed only)
  FW + temperature               -> Combined stress primed (Baywater 10K-Seed only)

Run:  python3 scripts/build_real_observations.py
"""
import json
import os
from collections import defaultdict
from datetime import datetime

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
PGC = "/Users/sr320/Documents/GitHub/project-gigas-conditioning"
OUT = os.path.join(REPO, "src", "data", "realObservations.json")
ARCHIVAL = os.path.join(REPO, "src", "data", "archivalTemperatureData.json")

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def parse_ymd(v):
    """Accept '20240624', '2024-06-24', or a Timestamp -> date string YYYY-MM-DD."""
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    if "-" in s:
        return s[:10]
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"


def date_fields(dstr):
    dt = datetime.strptime(dstr, "%Y-%m-%d")
    return {
        "date": dstr,
        "year": str(dt.year),
        "month": MONTHS[dt.month - 1],
        "quarter": f"Q{(dt.month - 1) // 3 + 1}",
    }


def round1(x):
    if x is None:
        return None
    try:
        if pd.isna(x):
            return None
    except (TypeError, ValueError):
        pass
    return round(float(x) * 10) / 10


# ---------------------------------------------------------------------------
# Real monthly mean temperature per site (from already-real logger archival)
# ---------------------------------------------------------------------------
def monthly_temps():
    arch = json.load(open(ARCHIVAL))
    # site -> "YYYY-MM" -> [values]
    acc = defaultdict(lambda: defaultdict(list))
    for row in arch["series"]:
        ym = row["date"][:7]
        for site in arch["sites"]:
            if site in row and row[site] is not None:
                acc[site][ym].append(row[site])
    out = {}
    for site, months in acc.items():
        out[site] = {ym: sum(v) / len(v) for ym, v in months.items()}
    return out


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
    f = date_fields(dstr)
    records.append({
        "id": f"{site[:2].upper()}-{treatment.split()[0][:4].upper()}-{dstr}",
        **f,
        "site": site,
        "treatment": treatment,
        "effort": effort,
        "growth_mm": round1(growth),
        "temperature_C": temp_for(site, dstr),
        "survival_percent": round1(survival),
        "survival_source": survival_src if survival is not None else "none",
        "growth_source": growth_src if growth is not None else "none",
        "temperature_source": "logger-monthly-mean",
    })


# ---------------------------------------------------------------------------
# GOOSE POINT  (Effort E: weekly temperature / weekly fresh water, control/treated)
# ---------------------------------------------------------------------------
def goose_point():
    surv = pd.read_csv(os.path.join(PGC, "data/outplanting/GoosePoint/survival_GoosePoint.csv"))
    grow = pd.read_csv(os.path.join(PGC, "data/outplanting/GoosePoint/growth_GoosePoint.csv"))
    bags = pd.read_csv(os.path.join(PGC, "data/outplanting/GoosePoint/bag_list_GoosePoint.csv"))

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
        emit("Goose Point", trt, v.get("eff", "Effort E"), dstr,
             survival=v.get("surv"), growth=v.get("grow"),
             survival_src="measured", growth_src="measured")
    notes["Goose Point"] = "Effort E (2023 POGS), weekly temperature + fresh water hardening; control/treated. Real survival (live/total) and image-derived shell length."


# ---------------------------------------------------------------------------
# SEQUIM  (Effort A: daily thermal hardening, control/treated)
# ---------------------------------------------------------------------------
def sequim():
    surv = pd.read_csv(os.path.join(PGC, "data/outplanting/Sequim/survival_Sequim.csv"))
    size = pd.read_excel(os.path.join(PGC, "data/outplanting/Sequim/size_Sequim.xlsx"))
    bags = pd.read_csv(os.path.join(PGC, "data/outplanting/Sequim/bag_list_Sequim.csv"))

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
    for bag, g in surv.sort_values("dstr").groupby("bag"):
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
    notes["Sequim Bay"] = "Effort A (2 weeks daily 25°C thermal hardening), control/treated. Real survival from cumulative mortality; image-derived shell length."


# ---------------------------------------------------------------------------
# WESTCOTT  (Effort B daily / Effort D weekly thermal hardening, control/treated)
# ---------------------------------------------------------------------------
def westcott():
    frames = []
    for eff_file, eff_label in [
        ("B_survival_12022025.xlsx", "Effort B — daily thermal"),
        ("D_survival_12022025.xlsx", "Effort D — weekly thermal"),
    ]:
        p = os.path.join(PGC, "data/survival/Westcott", eff_file)
        if not os.path.exists(p):
            continue
        df = pd.read_excel(p)
        df = df.copy()
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
    for (bag, eff), g in surv.sort_values("dstr").groupby(["bag_num", "eff_label"]):
        g = g.dropna(subset=["alive_num"])
        if g.empty:
            continue
        n0 = g.iloc[0]["alive_num"]
        if not n0:
            continue
        for _, r in g.iterrows():
            # cap at 100% — later counts can exceed the first due to recount noise
            rows.append({"trt": r["trt"], "eff": eff, "dstr": r["dstr"],
                         "surv": min(100.0, r["alive_num"] / n0 * 100)})
    sdf = pd.DataFrame(rows).groupby(["trt", "dstr"]).agg(
        surv=("surv", "mean"),
        eff=("eff", lambda s: "; ".join(sorted(set(s))))).reset_index()

    for _, r in sdf.sort_values(["dstr", "trt"]).iterrows():
        emit("Westcott", r["trt"], r["eff"], r["dstr"],
             survival=r["surv"], survival_src="measured")
    notes["Westcott"] = "Efforts B (daily) & D (weekly) thermal hardening, control/treated. Real survival (alive/initial per bag). Image growth not yet calibrated to mm."


# ---------------------------------------------------------------------------
# BAYWATER  (10K-Seed, 5 treatments) — survival anchors quoted in lab notebooks
# (raw data lives in RobertsLab/10K-seed-Cgigas, not in project-gigas-conditioning)
# ---------------------------------------------------------------------------
def baywater():
    # Measured survival %, Baywater 10K-Seed assessment 2025-08-20 (n=150/bag)
    anchor = {
        "Control": 43.1,
        "Heat primed": 41.6,
        "Freshwater primed": 40.1,
        "Immune primed": 11.7,
        "Combined stress primed": 50.1,
    }
    for trt, pct in anchor.items():
        emit("Baywater", trt, "10K-Seed (hardening)", "2025-08-20",
             survival=pct, survival_src="measured")
    notes["Baywater"] = "10K-Seed hardening (Control / 35C / FW / polyIC / FW+35C). Survival measured 2025-08-20 (n=150/bag); source repo RobertsLab/10K-seed-Cgigas. Growth not published numerically."


goose_point()
sequim()
westcott()
baywater()

records.sort(key=lambda r: (r["site"], r["treatment"], r["date"]))
for i, r in enumerate(records):
    r["id"] = f"{r['id']}-{i}"  # ensure uniqueness

sites = sorted({r["site"] for r in records})
treatments_present = {r["treatment"] for r in records}
TREATMENT_ORDER = ["Control", "Heat primed", "Freshwater primed",
                   "Immune primed", "Combined stress primed"]
treatments = [t for t in TREATMENT_ORDER if t in treatments_present]
years = sorted({r["year"] for r in records})

bundle = {
    "meta": {
        "generatedAt": datetime.utcnow().strftime("%Y-%m-%d"),
        "source": "RobertsLab/project-gigas-conditioning (+ 10K-Seed survival anchors)",
        "studyTitle": "Crassostrea gigas stress-hardening outplant program",
        "recordCount": len(records),
        "siteNotes": notes,
        "treatmentMapping": {
            "Control": "untreated control (any effort)",
            "Heat primed": "temperature / thermal hardening (treated)",
            "Freshwater primed": "fresh water / low-salinity hardening (treated)",
            "Immune primed": "polyIC / immune challenge (Baywater 10K-Seed)",
            "Combined stress primed": "fresh water + temperature (Baywater 10K-Seed)",
        },
    },
    "sites": sites,
    "treatments": treatments,
    "years": years,
    "observations": records,
}

json.dump(bundle, open(OUT, "w"), indent=0)
print(f"Wrote {len(records)} records to {OUT}")
print("Sites:", sites)
print("Treatments:", treatments)
print("Years:", years)
for s in sites:
    srv = [r for r in records if r["site"] == s and r["survival_percent"] is not None]
    grw = [r for r in records if r["site"] == s and r["growth_mm"] is not None]
    print(f"  {s:12} records={sum(1 for r in records if r['site']==s):3}  "
          f"survival_pts={len(srv):3}  growth_pts={len(grw):3}  "
          f"dates={len(sorted({r['date'] for r in records if r['site']==s}))}")
