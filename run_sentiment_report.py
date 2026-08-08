"""Run VADER sentiment on sentiment-analysis.csv and print accuracy report."""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from pipeline.step2_vader import classify_sentiment  # noqa: E402


def parse_rows(path: Path) -> list[dict]:
    raw_lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    rows: list[dict] = []
    for i, line in enumerate(raw_lines):
        line = line.strip()
        if not line:
            continue
        if line.startswith('"') and line.endswith('"'):
            line = line[1:-1]
        if i == 0:
            continue  # header

        m = re.match(r'^""(?P<text>.*?)""\s*,\s*(?P<rest>.+)$', line)
        if not m:
            m = re.match(r'^"+?(?P<text>.*?)"+\s*,\s*(?P<rest>.+)$', line)
        if not m:
            print("SKIP unparsed:", line[:90])
            continue

        text = m.group("text").replace('""', '"').strip()
        parts = next(csv.reader([m.group("rest")]))
        if len(parts) < 6:
            print("SHORT", parts)
            continue

        try:
            conf = float(parts[5].strip())
        except Exception:
            conf = None

        rows.append(
            {
                "text": text,
                "label": parts[0].strip().lower(),
                "source": parts[1].strip(),
                "datetime": parts[2].strip(),
                "user": parts[3].strip(),
                "location": parts[4].strip(),
                "confidence": conf,
            }
        )
    return rows


def main() -> None:
    csv_path = ROOT / "sentiment-analysis.csv"
    rows = parse_rows(csv_path)
    print(f"Parsed rows: {len(rows)}")
    print("Label distribution:", dict(Counter(r["label"] for r in rows)))

    results = []
    for r in rows:
        pred = classify_sentiment(r["text"])
        results.append(
            {
                **r,
                "pred": pred["sentiment_label"],
                "compound": float(pred["compound"]),
                "pos": float(pred["pos"]),
                "neu": float(pred["neu"]),
                "neg": float(pred["neg"]),
            }
        )

    classes = ["positive", "negative", "neutral"]
    correct = sum(1 for r in results if r["label"] == r["pred"])
    total = len(results)
    acc = correct / total if total else 0.0

    cm: dict[str, Counter] = defaultdict(Counter)
    for r in results:
        cm[r["label"]][r["pred"]] += 1

    metrics = {}
    for c in classes:
        tp = cm[c][c]
        fp = sum(cm[o][c] for o in classes if o != c)
        fn = sum(cm[c][o] for o in classes if o != c)
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        metrics[c] = {
            "precision": prec,
            "recall": rec,
            "f1": f1,
            "support": sum(cm[c].values()),
            "tp": tp,
        }

    label_dist = Counter(r["label"] for r in results)
    pred_dist = Counter(r["pred"] for r in results)
    disagree = [r for r in results if r["label"] != r["pred"]]

    bands: Counter = Counter()
    for r in results:
        c = r["compound"]
        if c >= 0.5:
            bands["strong_pos (>=0.5)"] += 1
        elif c > 0.35:
            bands["pos (0.35-0.5)"] += 1
        elif c >= -0.05:
            bands["neutral (-0.05..0.35)"] += 1
        elif c >= -0.5:
            bands["neg (-0.5..-0.05)"] += 1
        else:
            bands["strong_neg (<-0.5)"] += 1

    print("\n" + "=" * 64)
    print(" SENTIMENT ANALYSIS REPORT — sentiment-analysis.csv")
    print(" Engine: VADER (backend/pipeline/step2_vader.py)")
    print("=" * 64)
    print(f"\nRows analyzed: {total}")
    print(f"Overall accuracy (label vs VADER): {correct}/{total} = {acc * 100:.1f}%")
    print(f"\nLabeled distribution: {dict(label_dist)}")
    print(f"VADER prediction dist: {dict(pred_dist)}")
    print("\nCompound score bands:")
    for k, v in bands.items():
        print(f"  {k}: {v}")

    print("\nConfusion matrix (rows=label, cols=pred):")
    print(f"{'':12}" + "".join(f"{c:>10}" for c in classes))
    for actual in classes:
        print(f"{actual:12}" + "".join(f"{cm[actual][c]:10d}" for c in classes))

    print("\nPer-class metrics:")
    print(f"{'class':12} {'prec':>8} {'recall':>8} {'f1':>8} {'support':>8}")
    for c in classes:
        m = metrics[c]
        print(
            f"{c:12} {m['precision'] * 100:7.1f}% {m['recall'] * 100:7.1f}% "
            f"{m['f1'] * 100:7.1f}% {m['support']:8d}"
        )

    macro_f1 = sum(metrics[c]["f1"] for c in classes) / 3
    print(f"\nMacro F1: {macro_f1 * 100:.1f}%")
    print(f"Mismatches: {len(disagree)}")
    for r in disagree[:20]:
        print(
            f"  [{r['label']}->{r['pred']}] compound={r['compound']:+.3f} | {r['text'][:72]}"
        )

    print("\nAccuracy by source:")
    src_stats: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for r in results:
        src_stats[r["source"]][1] += 1
        if r["label"] == r["pred"]:
            src_stats[r["source"]][0] += 1
    for src, (ok, n) in sorted(src_stats.items(), key=lambda x: -x[1][1]):
        print(f"  {src:28} {ok}/{n} ({ok / n * 100:.0f}%)")

    # Top strongest positive / negative by compound
    ranked = sorted(results, key=lambda r: r["compound"], reverse=True)
    print("\nTop 5 most positive (VADER compound):")
    for r in ranked[:5]:
        print(f"  {r['compound']:+.3f} | {r['text'][:70]}")
    print("\nTop 5 most negative (VADER compound):")
    for r in ranked[-5:][::-1]:
        print(f"  {r['compound']:+.3f} | {r['text'][:70]}")

    out = {
        "file": "sentiment-analysis.csv",
        "engine": "VADER",
        "thresholds": {"positive": "> 0.35", "negative": "< -0.05", "neutral": "else"},
        "rows": total,
        "accuracy": round(acc, 4),
        "correct": correct,
        "label_distribution": dict(label_dist),
        "prediction_distribution": dict(pred_dist),
        "compound_bands": dict(bands),
        "confusion_matrix": {a: dict(cm[a]) for a in classes},
        "per_class": {
            c: {
                k: (round(v, 4) if isinstance(v, float) else v)
                for k, v in metrics[c].items()
            }
            for c in classes
        },
        "macro_f1": round(macro_f1, 4),
        "mismatches": [
            {
                "text": r["text"],
                "label": r["label"],
                "pred": r["pred"],
                "compound": round(r["compound"], 4),
                "source": r["source"],
            }
            for r in disagree
        ],
    }
    out_path = ROOT / "sentiment-analysis-report.json"
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nSaved: {out_path.name}")


if __name__ == "__main__":
    main()
