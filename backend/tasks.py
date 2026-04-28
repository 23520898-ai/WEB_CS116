import json
import os
from datetime import datetime
from typing import Any, Dict

import pandas as pd
from sqlalchemy.orm import Session

from backend.database import Leaderboard, SessionLocal, Submission
from backend.evaluation.forecast_metrics import compute_forecast_metrics
from backend.evaluation.pir_metrics import compute_pir_metrics

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GROUND_TRUTH_DIR = os.path.join(BASE_DIR, "ground_truth")


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


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


def _is_better(task: str, new_metrics: Dict[str, Any], old_metrics: Dict[str, Any]) -> bool:
    if task == "pir":
        return float(new_metrics.get("precision_at_10", 0.0)) > float(
            old_metrics.get("precision_at_10", -1.0)
        )
    return float(new_metrics.get("mape_sales", 999999.0)) < float(
        old_metrics.get("mape_sales", 999999.0)
    )


def _primary_score(task: str, metrics: Dict[str, Any]) -> float:
    if task == "pir":
        return float(metrics.get("precision_at_10", 0.0))
    return float(metrics.get("mape_sales", 999999.0))


def _evaluate_submission(db: Session, submission: Submission) -> Dict[str, Any]:
    if submission.task == "pir":
        pred = _validate_pir_submission(submission.file_path)
        gt = _load_json(os.path.join(GROUND_TRUTH_DIR, "pir_ground_truth_jan_2026.json"))
        return compute_pir_metrics(pred, gt)

    pred_df = _validate_forecast_submission(submission.file_path)
    gt_df = pd.read_csv(os.path.join(GROUND_TRUTH_DIR, "forecast_ground_truth_jan_2026.csv"))
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
        submission.evaluated_at = datetime.utcnow()
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
                updated_at=datetime.utcnow(),
            )
            db.add(lb)
            db.commit()
            return

        old_metrics = json.loads(existing_lb.best_metrics_json or "{}")
        if _is_better(submission.task, metrics, old_metrics):
            existing_lb.primary_score = _primary_score(submission.task, metrics)
            existing_lb.best_metrics_json = json.dumps(metrics)
            existing_lb.best_submission_id = submission.id
            existing_lb.updated_at = datetime.utcnow()
            db.commit()
    except Exception as exc:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if submission:
            submission.status = "failed"
            submission.error_message = str(exc)
            submission.evaluated_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()
