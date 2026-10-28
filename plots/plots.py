"""Quick matplotlib plots from data/lots.sqlite → plots/out/*.png

    python plots/plots.py
"""
import sqlite3
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "plots" / "out"
OUT.mkdir(parents=True, exist_ok=True)

COLORS = {"birkin": "#2a78d6", "kelly": "#eb6834"}  # dataviz reference palette, slots 1-2
plt.rcParams.update({
    "figure.facecolor": "#fcfcfb", "axes.facecolor": "#fcfcfb",
    "axes.edgecolor": "#c3c2b7", "axes.labelcolor": "#52514e",
    "xtick.color": "#52514e", "ytick.color": "#52514e", "text.color": "#0b0b0b",
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "axes.axisbelow": True, "grid.color": "#e8e7e3", "grid.linewidth": 0.8,
    "axes.titleweight": "bold", "axes.titlelocation": "left", "lines.linewidth": 2,
    "legend.frameon": False, "figure.dpi": 120, "savefig.bbox": "tight",
})

df = pd.read_sql("select * from lots", sqlite3.connect(ROOT / "data" / "lots.sqlite"))
df["year"] = pd.to_datetime(df["date_vente"], errors="coerce").dt.year
df["famille"] = df["modele"].str.extract(r"^(birkin|kelly)")
sold = df[(df["vendu"] == 1) & df["famille"].notna()]


def save(fig, name):
    fig.savefig(OUT / name)
    plt.close(fig)
    print(OUT / name)


# 1. Volume: sold lots per year
counts = sold.groupby(["year", "famille"]).size().unstack(fill_value=0)
fig, ax = plt.subplots(figsize=(9, 4.5))
for fam in COLORS:
    ax.plot(counts.index, counts[fam], color=COLORS[fam], label=fam.capitalize())
    ax.annotate(fam.capitalize(), (counts.index[-1], counts[fam].iloc[-1]),
                xytext=(6, 0), textcoords="offset points", va="center", color="#52514e")
ax.set_title("Sold lots per year (Christie's)")
ax.set_ylabel("Lots")
ax.legend(loc="upper left")
save(fig, "lots_per_year.png")

# 2. Median price incl. fees per year, one panel per currency (no FX conversion)
cur = ["HKD", "USD", "EUR", "GBP"]
recent = sold[(sold["year"] >= 2010) & sold["devise"].isin(cur)]
fig, axes = plt.subplots(2, 2, figsize=(11, 7), sharex=True)
for ax, c in zip(axes.flat, cur):
    g = recent[recent["devise"] == c].groupby(["year", "famille"])["prix_frais_inclus"]
    med = g.median().where(g.size() >= 10).unstack()  # single-lot years made fake spikes
    for fam in COLORS:
        if fam in med:
            ax.plot(med.index, med[fam], color=COLORS[fam], marker="o", markersize=4, label=fam.capitalize())
    ax.set_title(c)
    ax.yaxis.set_major_formatter(lambda v, _: f"{v / 1000:,.0f}k")
axes.flat[0].legend(loc="upper left")
fig.suptitle("Median price incl. fees, sold lots since 2010 (years with ≥10 lots)",x=0.01, ha="left", fontweight="bold")
fig.tight_layout()
save(fig, "median_price_by_currency.png")

# 3. Result vs high estimate (currency-free)
r = (sold["prix_frais_inclus"] / sold["estimation_haute"]).dropna()
r = r[(r > 0) & (r < 5)]  # ponytail: drops a handful of outliers / bad estimates, widen if needed
fig, ax = plt.subplots(figsize=(9, 4.5))
ax.hist(r, bins=60, color=COLORS["birkin"], edgecolor="#fcfcfb", linewidth=1)
ax.axvline(1, color="#52514e", linestyle="--", linewidth=1)
ax.annotate(f"{(r > 1).mean():.0%} above high estimate", (1, ax.get_ylim()[1] * 0.92),
            xytext=(6, 0), textcoords="offset points", color="#52514e")
ax.set_title("Price incl. fees ÷ high estimate, sold lots")
ax.set_xlabel("Ratio")
ax.set_ylabel("Lots")
save(fig, "price_vs_estimate.png")

# 4. Birkin price by size, HKD, since 2018
b = sold[(sold["famille"] == "birkin") & (sold["devise"] == "HKD") & (sold["year"] >= 2018)]
sizes = [s for s in ["25", "30", "35", "40"] if (b["taille"] == s).any()]
data = [b.loc[b["taille"] == s, "prix_frais_inclus"] for s in sizes]
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.boxplot(data, tick_labels=[f"{s} cm\n(n={len(d)})" for s, d in zip(sizes, data)],
           patch_artist=True, showfliers=False, widths=0.5,
           boxprops={"facecolor": COLORS["birkin"], "edgecolor": COLORS["birkin"]},
           medianprops={"color": "#fcfcfb", "linewidth": 2},
           whiskerprops={"color": "#52514e"}, capprops={"color": "#52514e"})
ax.yaxis.set_major_formatter(lambda v, _: f"{v / 1000:,.0f}k")
ax.set_title("Birkin price incl. fees by size, HKD, 2018+")
ax.set_ylabel("HKD")
save(fig, "birkin_price_by_size.png")
