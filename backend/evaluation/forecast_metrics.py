from typing import Dict
import pandas as pd


def _safe_mape(actual: pd.Series, pred: pd.Series) -> float:
    errors = []
    for a, p in zip(actual.tolist(), pred.tolist()):
        if a == 0 and p == 0:
            continue
        if a == 0:
            # Smoothing for zero denominator: (numerator + 1) / (denominator + 1)
            errors.append(((abs(a - p) + 1.0) / (abs(a) + 1.0)) * 100.0)
        else:
            errors.append(abs((a - p) / a) * 100.0)

    if not errors:
        return 0.0
    return float(sum(errors) / len(errors))


def compute_forecast_metrics(pred_df: pd.DataFrame, gt_df: pd.DataFrame) -> Dict[str, float]:
    gt_df = gt_df.copy()
    pred_df = pred_df.copy()

    # Normalise join keys to string so int/str mismatch doesn't cause empty merge
    gt_df["location"] = gt_df["location"].astype(str)
    gt_df["item_id"] = gt_df["item_id"].astype(str)
    pred_df["location"] = pred_df["location"].astype(str)
    pred_df["item_id"] = pred_df["item_id"].astype(str)

    # Sản phẩm ngừng bán (sale_status == 0): actual_quantity phải là 0
    # Không lọc bỏ chúng — nếu team dự đoán số lượng > 0 cho sản phẩm ngừng bán thì phải bị phạt
    gt_df.loc[gt_df["sale_status"] == 0, "actual_quantity"] = 0

    # Outer join: bắt cả trường hợp team dự đoán (location, item_id) không có trong GT
    # → actual_quantity = 0, price = 0 cho các hàng không có trong GT
    merged = gt_df.merge(
        pred_df[["location", "item_id", "prediction"]],
        on=["location", "item_id"],
        how="outer",
    )

    merged["actual_quantity"] = merged["actual_quantity"].fillna(0.0)
    merged["price"] = merged["price"].fillna(0.0)
    merged["prediction"] = merged["prediction"].fillna(0.0)

    # SALES METRICS
    mae_sales = (merged["actual_quantity"] - merged["prediction"]).abs().mean()
    mape_sales = _safe_mape(merged["actual_quantity"], merged["prediction"])

    # REVENUE METRICS — use price column directly from ground truth
    merged["actual_revenue"] = merged["actual_quantity"] * merged["price"]
    merged["pred_revenue"] = merged["prediction"] * merged["price"]

    mae_revenue = (merged["actual_revenue"] - merged["pred_revenue"]).abs().mean()
    mape_revenue = _safe_mape(merged["actual_revenue"], merged["pred_revenue"])

    return {
        "mape_sales": round(float(mape_sales), 6),
        "mae_sales": round(float(mae_sales), 6),
        "mae_revenue": round(float(mae_revenue), 6),
        "mape_revenue": round(float(mape_revenue), 6),
    }
