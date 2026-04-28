from typing import Dict

import pandas as pd


def _safe_mape(actual: pd.Series, pred: pd.Series, cap: float = 500.0) -> float:
    errors = []
    for a, p in zip(actual.tolist(), pred.tolist()):
        if a == 0 and p == 0:
            continue
        if a == 0 and p > 0:
            errors.append(min(abs(p) * 100.0, cap))
        else:
            errors.append(min(abs((a - p) / a) * 100.0, cap))

    if not errors:
        return 0.0
    return float(sum(errors) / len(errors))


def compute_forecast_metrics(pred_df: pd.DataFrame, gt_df: pd.DataFrame) -> Dict[str, float]:
    gt_df = gt_df.copy()
    gt_df = gt_df[gt_df["sale_status"] != 0]

    sales_per_store = gt_df.groupby("location")["actual_qty"].sum()
    active_stores = sales_per_store[sales_per_store > 0].index.tolist()
    gt_df = gt_df[gt_df["location"].isin(active_stores)]

    merged = gt_df.merge(
        pred_df[["location", "item_id", "prediction"]],
        on=["location", "item_id"],
        how="left",
    )
    merged["prediction"] = merged["prediction"].fillna(0.0)

    mae_sales = (merged["actual_qty"] - merged["prediction"]).abs().mean()
    mape_sales = _safe_mape(merged["actual_qty"], merged["prediction"])

    merged["unit_price"] = 0.0
    non_zero_qty = merged["actual_qty"] > 0
    merged.loc[non_zero_qty, "unit_price"] = (
        merged.loc[non_zero_qty, "revenue"] / merged.loc[non_zero_qty, "actual_qty"]
    )
    merged["pred_revenue"] = merged["prediction"] * merged["unit_price"]

    mae_revenue = (merged["revenue"] - merged["pred_revenue"]).abs().mean()
    mape_revenue = _safe_mape(merged["revenue"], merged["pred_revenue"])

    return {
        "mape_sales": round(float(mape_sales), 6),
        "mae_sales": round(float(mae_sales), 6),
        "mae_revenue": round(float(mae_revenue), 6),
        "mape_revenue": round(float(mape_revenue), 6),
    }
