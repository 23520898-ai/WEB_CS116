import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import pandas as pd
from sqlalchemy.orm import Session

from backend.database import Leaderboard, SessionLocal, Submission
from backend.evaluation.forecast_metrics import compute_forecast_metrics
from backend.evaluation.pir_metrics import compute_pir_metrics

VN_TZ = timezone(timedelta(hours=7))


def _now_vn() -> datetime:
    return datetime.now(VN_TZ).replace(tzinfo=None)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GROUND_TRUTH_DIR = os.path.join(BASE_DIR, "ground_truth")


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _unique_keep_order(values: List[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def _find_ground_truth_path(task: str) -> str:
    if task == "pir":
        candidates = [
            os.path.join(GROUND_TRUTH_DIR, "pir_ground_truth_jan_2026.json"),
            os.path.join(GROUND_TRUTH_DIR, "pir_ground_truth_jan_2026.parquet"),
        ]
    elif task == "forecast":
        candidates = [
            os.path.join(GROUND_TRUTH_DIR, "forecast_ground_truth_jan_2026.csv"),
            os.path.join(GROUND_TRUTH_DIR, "forecast_ground_truth_jan_2026.parquet"),
        ]
    else:
        raise ValueError("Unsupported task.")

    for path in candidates:
        if os.path.exists(path):
            return path
    raise FileNotFoundError(f"Ground truth not found for task '{task}'.")


def _load_pir_ground_truth(path: str) -> Dict[str, List[str]]:
    if path.lower().endswith(".json"):
        data = _load_json(path)
        if not isinstance(data, dict):
            raise ValueError("PIR ground truth JSON must be a dictionary.")

        normalized: Dict[str, List[str]] = {}
        for customer_id, items in data.items():
            if not isinstance(customer_id, str):
                raise ValueError("PIR ground truth customer_id keys must be strings.")
            if not isinstance(items, list):
                raise ValueError("Each PIR ground truth value must be an array of item_id strings.")
            cleaned = [str(item) for item in items if str(item).strip()]
            normalized[customer_id] = _unique_keep_order(cleaned)
        return normalized

    if path.lower().endswith(".parquet"):
        df = pd.read_parquet(path)
        cols = set(df.columns)

        if {"customer_id", "item_id"}.issubset(cols):
            grouped: Dict[str, List[str]] = {}
            for _, row in df[["customer_id", "item_id"]].iterrows():
                customer_id = str(row["customer_id"])
                item_id = str(row["item_id"])
                if customer_id not in grouped:
                    grouped[customer_id] = []
                grouped[customer_id].append(item_id)
            return {cid: _unique_keep_order(items) for cid, items in grouped.items()}

        if {"customer_id", "items"}.issubset(cols):
            normalized: Dict[str, List[str]] = {}
            for _, row in df[["customer_id", "items"]].iterrows():
                customer_id = str(row["customer_id"])
                raw_items = row["items"]

                if isinstance(raw_items, list):
                    items = [str(item) for item in raw_items if str(item).strip()]
                elif isinstance(raw_items, str):
                    text_value = raw_items.strip()
                    if text_value.startswith("[") and text_value.endswith("]"):
                        parsed = json.loads(text_value)
                        if not isinstance(parsed, list):
                            raise ValueError("PIR parquet 'items' JSON strings must decode to arrays.")
                        items = [str(item) for item in parsed if str(item).strip()]
                    else:
                        items = [part.strip() for part in text_value.split(",") if part.strip()]
                else:
                    raise ValueError("PIR parquet 'items' must be a list or string.")

                normalized[customer_id] = _unique_keep_order(items)
            return normalized

        raise ValueError(
            "PIR parquet ground truth must include either columns ['customer_id','item_id'] or ['customer_id','items']."
        )

    raise ValueError("Unsupported PIR ground truth format.")


def _load_forecast_ground_truth(path: str) -> pd.DataFrame:
    if path.lower().endswith(".csv"):
        df = pd.read_csv(path)
    elif path.lower().endswith(".parquet"):
        df = pd.read_parquet(path)
    else:
        raise ValueError("Unsupported forecast ground truth format.")

    required_cols = {"location", "item_id", "actual_quantity", "price", "sale_status"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"Forecast ground truth missing columns: {sorted(missing)}")

    normalized = df[["location", "item_id", "actual_quantity", "price", "sale_status"]].copy()
    normalized["location"] = pd.to_numeric(normalized["location"], errors="coerce").fillna(0).astype(int)
    normalized["item_id"] = normalized["item_id"].astype(str)
    normalized["actual_quantity"] = pd.to_numeric(normalized["actual_quantity"], errors="coerce").fillna(0).astype(int)
    normalized["price"] = pd.to_numeric(normalized["price"], errors="coerce").fillna(0.0)
    normalized["sale_status"] = pd.to_numeric(
        normalized["sale_status"], errors="coerce"
    ).fillna(0)
    return normalized


def _validate_pir_submission(path: str) -> Dict[str, Any]:
    data = _load_json(path)
    if not isinstance(data, dict):
        raise ValueError("PIR submission must be a JSON object {customer_id: [item_id,...]}.")

    for key, value in data.items():
        if not isinstance(key, str):
            raise ValueError("PIR customer_id keys must be strings.")
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            raise ValueError("Each customer_id value must be an array of item_id strings.")
    return data


def _validate_forecast_submission(path: str) -> pd.DataFrame:
    if path.lower().endswith(".parquet"):
        df = pd.read_parquet(path)
    else:
        df = pd.read_csv(path)
    required_cols = {"location", "item_id", "prediction"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"Forecast CSV is missing required columns: {sorted(missing)}")

    df = df[["location", "item_id", "prediction"]].copy()
    df["location"] = df["location"].astype(str)
    df["item_id"] = df["item_id"].astype(str)
    df["prediction"] = pd.to_numeric(df["prediction"], errors="coerce").fillna(0.0)
    return df


def validate_submission_file(task: str, path: str) -> None:
    if task == "pir":
        _validate_pir_submission(path)
    elif task == "forecast":
        _validate_forecast_submission(path)
    else:
        raise ValueError("Unsupported task.")


def validate_ground_truth_file(task: str, path: str) -> None:
    if task == "pir":
        _load_pir_ground_truth(path)
        return
    if task == "forecast":
        _load_forecast_ground_truth(path)
        return
    raise ValueError("Unsupported task.")


def _is_better(task: str, new_metrics: Dict[str, Any], old_metrics: Dict[str, Any]) -> bool:
    if task == "pir":
        # Higher is better for PIR metrics.
        new_vector = (
            float(new_metrics.get("precision_at_10", 0.0)),
            float(new_metrics.get("map", 0.0)),
            float(new_metrics.get("iou", 0.0)),
            float(new_metrics.get("reciprocal_rank_first_hit", 0.0)),
            float(new_metrics.get("total_correct_recommendations", 0.0)),
        )
        old_vector = (
            float(old_metrics.get("precision_at_10", -1.0)),
            float(old_metrics.get("map", -1.0)),
            float(old_metrics.get("iou", -1.0)),
            float(old_metrics.get("reciprocal_rank_first_hit", -1.0)),
            float(old_metrics.get("total_correct_recommendations", -1.0)),
        )
        return new_vector > old_vector

    # Lower is better for forecast metrics.
    new_vector = (
        float(new_metrics.get("mape_sales", 999999.0)),
        float(new_metrics.get("mae_sales", 999999.0)),
        float(new_metrics.get("mape_revenue", 999999.0)),
        float(new_metrics.get("mae_revenue", 999999.0)),
    )
    old_vector = (
        float(old_metrics.get("mape_sales", 999999.0)),
        float(old_metrics.get("mae_sales", 999999.0)),
        float(old_metrics.get("mape_revenue", 999999.0)),
        float(old_metrics.get("mae_revenue", 999999.0)),
    )
    return new_vector < old_vector


def _primary_score(task: str, metrics: Dict[str, Any]) -> float:
    if task == "pir":
        return float(metrics.get("precision_at_10", 0.0))
    return float(metrics.get("mape_sales", 999999.0))


def _evaluate_submission(db: Session, submission: Submission) -> Dict[str, Any]:
    if submission.task == "pir":
        pred = _validate_pir_submission(submission.file_path)
        gt = _load_pir_ground_truth(_find_ground_truth_path("pir"))
        return compute_pir_metrics(pred, gt)

    pred_df = _validate_forecast_submission(submission.file_path)
    gt_df = _load_forecast_ground_truth(_find_ground_truth_path("forecast"))
    return compute_forecast_metrics(pred_df, gt_df)


def evaluate_submission_task(submission_id: int) -> None:
    db = SessionLocal()
    try:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            return

        submission.status = "processing"
        db.commit()

        metrics = _evaluate_submission(db, submission)

        submission.status = "completed"
        submission.metrics_json = json.dumps(metrics)
        submission.evaluated_at = _now_vn()
        db.commit()

        existing_lb = (
            db.query(Leaderboard)
            .filter(Leaderboard.team_id == submission.team_id, Leaderboard.task == submission.task)
            .first()
        )

        if existing_lb is None:
            lb = Leaderboard(
                team_id=submission.team_id,
                task=submission.task,
                primary_score=_primary_score(submission.task, metrics),
                best_metrics_json=json.dumps(metrics),
                best_submission_id=submission.id,
                updated_at=_now_vn(),
            )
            db.add(lb)
            db.commit()
            return

        old_metrics = json.loads(existing_lb.best_metrics_json or "{}")
        if _is_better(submission.task, metrics, old_metrics):
            existing_lb.primary_score = _primary_score(submission.task, metrics)
            existing_lb.best_metrics_json = json.dumps(metrics)
            existing_lb.best_submission_id = submission.id
            existing_lb.updated_at = _now_vn()
            db.commit()
    except Exception as exc:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if submission:
            submission.status = "failed"
            submission.error_message = str(exc)
            submission.evaluated_at = _now_vn()
            db.commit()
    finally:
        db.close()
