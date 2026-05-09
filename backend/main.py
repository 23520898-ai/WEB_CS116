import json
import os
import shutil
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from backend.auth import create_access_token, get_current_user, get_db, verify_password
from backend.database import AppSetting, DailyLimit, Leaderboard, Submission, Team, User, init_db
from backend.security import hash_password
from backend.schemas import (
    AdminResetPasswordRequest,
    AdminSubmissionResponse,
    ChangePasswordRequest,
    LeaderboardEntry,
    LoginRequest,
    LoginResponse,
    SubmissionResponse,
    SubmitResponse,
    TeamSummaryResponse,
    TeamMeResponse,
    TeamMemberResponse,
    TeamProfileMember,
    SubmissionLimitResponse,
    UpdateSubmissionLimitRequest,
    UpdateTeamProfileRequest,
)
from backend.tasks import evaluate_submission_task, validate_ground_truth_file, validate_submission_file, _is_better, _primary_score

VN_TZ = timezone(timedelta(hours=7))


def _now_vn() -> datetime:
    return datetime.now(VN_TZ).replace(tzinfo=None)


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
TRAIN_DIR = BASE_DIR / "train_data"
FRONTEND_DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SUBMISSION_LIMIT_PER_DAY = 3
ALLOWED_TASKS = {"pir", "forecast"}

app = FastAPI(
    title="CS116 ML Challenge",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# --- Prefix Configuration ---
BASE_PATH = "/grader/cs116.q21/WEB_CS116"
api_router = APIRouter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/", include_in_schema=False)
def root_redirect():
    return RedirectResponse(url=f"{BASE_PATH}/")


def _today_limit_row(db: Session, team_id: int) -> DailyLimit:
    today = _now_vn().date()
    limit_row = (
        db.query(DailyLimit)
        .filter(DailyLimit.team_id == team_id, DailyLimit.date == today)
        .first()
    )
    if not limit_row:
        limit_row = DailyLimit(team_id=team_id, date=today, count=0)
        db.add(limit_row)
        db.commit()
        db.refresh(limit_row)
    return limit_row


def _get_submission_limit(db: Session) -> int:
    setting = db.query(AppSetting).filter(AppSetting.key == "submission_limit_per_day").first()
    if not setting:
        setting = AppSetting(key="submission_limit_per_day", value=str(DEFAULT_SUBMISSION_LIMIT_PER_DAY))
        db.add(setting)
        db.commit()
        return DEFAULT_SUBMISSION_LIMIT_PER_DAY

    try:
        parsed = int(setting.value)
        return parsed if parsed > 0 else DEFAULT_SUBMISSION_LIMIT_PER_DAY
    except (TypeError, ValueError):
        return DEFAULT_SUBMISSION_LIMIT_PER_DAY


def _set_submission_limit(db: Session, value: int) -> int:
    setting = db.query(AppSetting).filter(AppSetting.key == "submission_limit_per_day").first()
    if not setting:
        setting = AppSetting(key="submission_limit_per_day", value=str(value))
        db.add(setting)
    else:
        setting.value = str(value)
        setting.updated_at = _now_vn()
    db.commit()
    return value


def _current_submission_number(db: Session, team_id: int, task: str) -> int:
    last_submission = (
        db.query(Submission)
        .filter(Submission.team_id == team_id, Submission.task == task)
        .order_by(Submission.submission_number.desc())
        .first()
    )
    return 1 if not last_submission else last_submission.submission_number + 1


def _parse_metrics(metrics_json: str | None):
    if not metrics_json:
        return None
    try:
        return json.loads(metrics_json)
    except json.JSONDecodeError:
        return None


def _parse_member_profiles(member_profiles_json: str | None) -> List[TeamProfileMember]:
    if not member_profiles_json:
        return []
    try:
        data = json.loads(member_profiles_json)
        if not isinstance(data, list):
            return []
        return [TeamProfileMember(**item) for item in data if isinstance(item, dict)]
    except Exception:
        return []


def _metric_vector(task: str, metrics: dict) -> tuple:
    if task == "pir":
        return (
            float(metrics.get("precision_at_10", 0.0)),
            float(metrics.get("map", 0.0)),
            float(metrics.get("iou", 0.0)),
            float(metrics.get("reciprocal_rank_first_hit", 0.0)),
            float(metrics.get("total_correct_recommendations", 0.0)),
        )

    return (
        float(metrics.get("mape_sales", 999999.0)),
        float(metrics.get("mae_sales", 999999.0)),
        float(metrics.get("mape_revenue", 999999.0)),
        float(metrics.get("mae_revenue", 999999.0)),
    )


def _leaderboard_sort_key(task: str, row: tuple) -> tuple:
    lb, _, _ = row
    metrics = _parse_metrics(lb.best_metrics_json) or {}
    vector = _metric_vector(task, metrics)
    if task == "pir":
        # Use ascending sort while effectively ranking higher metric values first.
        return tuple(-v for v in vector)
    return vector


def _require_admin(current_user: User) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permission required")


def _store_upload(file: UploadFile, task: str, team_id: int) -> Path:
    safe_filename = Path(file.filename or "submission").name
    suffix = Path(safe_filename).suffix
    task_dir = UPLOAD_DIR / task
    task_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"team{team_id}_{int(_now_vn().timestamp())}_{Path(safe_filename).stem}{suffix}"
    path = task_dir / stored_name

    with path.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    return path


def _validate_dataset_file_content(path: Path) -> None:
    suffix = path.suffix.lower()
    if suffix == ".json":
        with path.open("r", encoding="utf-8") as f:
            json.load(f)
        return
    if suffix == ".csv":
        # Quick parse check for csv format validity.
        with path.open("r", encoding="utf-8") as f:
            _ = f.readline()
        return
    if suffix == ".parquet":
        # Ensure parquet file is readable.
        import pandas as pd

        pd.read_parquet(path)
        return
    raise ValueError("Unsupported file format")


def _build_dataset_preview(path: Path) -> dict:
    suffix = path.suffix.lower()

    if suffix in {".csv", ".parquet"}:
        import pandas as pd

        if suffix == ".csv":
            df = pd.read_csv(path)
        else:
            df = pd.read_parquet(path)

        preview_rows = df.head(5).fillna("").to_dict(orient="records")
        dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}
        return {
            "format": suffix.lstrip("."),
            "row_count": int(len(df.index)),
            "columns": list(df.columns),
            "dtypes": dtypes,
            "sample_rows": preview_rows,
        }

    if suffix == ".json":
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            keys = list(data.keys())
            first_key = keys[0] if keys else None
            first_value = data[first_key] if first_key is not None else None
            return {
                "format": "json",
                "top_level_type": "object",
                "entry_count": len(keys),
                "sample_key": first_key,
                "sample_value_type": type(first_value).__name__ if first_value is not None else None,
            }

        if isinstance(data, list):
            first_value = data[0] if data else None
            return {
                "format": "json",
                "top_level_type": "array",
                "entry_count": len(data),
                "sample_value_type": type(first_value).__name__ if first_value is not None else None,
            }

        return {
            "format": "json",
            "top_level_type": type(data).__name__,
        }

    return {"format": suffix.lstrip(".")}


def _resolve_train_data_path(task: str) -> Path:
    if task == "pir":
        candidates = [
            TRAIN_DIR / "pir_train_2025.json",
            TRAIN_DIR / "pir_train_2025.parquet",
        ]
    else:
        candidates = [
            TRAIN_DIR / "forecast_train_2025.csv",
            TRAIN_DIR / "forecast_train_2025.parquet",
        ]

    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError("Training file not found")


@api_router.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(subject=user.username)
    return LoginResponse(access_token=token)


@api_router.get("/api/teams/me", response_model=TeamMeResponse)
def get_team_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == current_user.team_id).first()
    members = db.query(User).filter(User.team_id == current_user.team_id).all()
    limit_row = _today_limit_row(db, current_user.team_id)
    submission_limit_per_day = _get_submission_limit(db)

    return TeamMeResponse(
        id=team.id,
        name=team.name,
        invite_code=team.invite_code,
        current_user_role=current_user.role,
        members=[TeamMemberResponse(username=m.username, role=m.role) for m in members],
        member_profiles=_parse_member_profiles(team.member_profiles_json),
        notes=team.notes or "",
        submission_limit_per_day=submission_limit_per_day,
        submissions_today=limit_row.count,
        remaining_submissions_today=max(0, submission_limit_per_day - limit_row.count),
    )


@api_router.post("/api/auth/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password updated successfully"}


@api_router.put("/api/teams/me/profile", response_model=TeamMeResponse)
def update_team_profile(
    payload: UpdateTeamProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = db.query(Team).filter(Team.id == current_user.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    members_payload = [m.dict() for m in payload.members]
    team.member_profiles_json = json.dumps(members_payload, ensure_ascii=True)
    team.notes = (payload.notes or "").strip()
    db.commit()

    members = db.query(User).filter(User.team_id == current_user.team_id).all()
    limit_row = _today_limit_row(db, current_user.team_id)
    submission_limit_per_day = _get_submission_limit(db)

    return TeamMeResponse(
        id=team.id,
        name=team.name,
        invite_code=team.invite_code,
        current_user_role=current_user.role,
        members=[TeamMemberResponse(username=m.username, role=m.role) for m in members],
        member_profiles=_parse_member_profiles(team.member_profiles_json),
        notes=team.notes or "",
        submission_limit_per_day=submission_limit_per_day,
        submissions_today=limit_row.count,
        remaining_submissions_today=max(0, submission_limit_per_day - limit_row.count),
    )


def _leaderboard_response(task: str, db: Session) -> List[LeaderboardEntry]:
    rows = (
        db.query(Leaderboard, Team, Submission)
        .join(Team, Team.id == Leaderboard.team_id)
        .outerjoin(Submission, Submission.id == Leaderboard.best_submission_id)
        .filter(
            Leaderboard.task == task,
            Team.is_active.is_(True),
            Leaderboard.best_submission_id.is_not(None),
        )
        .all()
    )

    # ✅ SORT lại leaderboard
    rows.sort(key=lambda row: _leaderboard_sort_key(task, row))

    primary_label = "Precision@10" if task == "pir" else "MAPE Sales"

    result = []
    current_rank = 0
    previous_vector = None

    for idx, (lb, team, sub) in enumerate(rows, start=1):
        metrics = _parse_metrics(lb.best_metrics_json) or {}
        vector = _metric_vector(task, metrics)

        if previous_vector is None or vector != previous_vector:
            current_rank = idx
            previous_vector = vector

        result.append(
            LeaderboardEntry(
                submission_id=sub.id if sub else None,
                rank=current_rank,
                team_name=team.name,
                primary_score=lb.primary_score,
                primary_label=primary_label,
                secondary_metrics=metrics,
                last_submission_at=sub.evaluated_at if sub else None,
            )
        )

    return result


@api_router.get("/api/leaderboard/pir", response_model=List[LeaderboardEntry])
def leaderboard_pir(db: Session = Depends(get_db)):
    return _leaderboard_response("pir", db)


@api_router.get("/api/leaderboard/forecast", response_model=List[LeaderboardEntry])
def leaderboard_forecast(db: Session = Depends(get_db)):
    return _leaderboard_response("forecast", db)


def _create_submission(
    task: str,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    current_user: User,
    db: Session,
) -> SubmitResponse:
    if task not in ALLOWED_TASKS:
        raise HTTPException(status_code=400, detail="Unsupported task")

    submission_limit_per_day = _get_submission_limit(db)
    limit_row = _today_limit_row(db, current_user.team_id)
    if limit_row.count >= submission_limit_per_day:
        raise HTTPException(
            status_code=429,
            detail=f"Daily submission limit reached ({submission_limit_per_day}/day).",
        )

    if task == "pir" and not (file.filename or "").lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="PIR submission must be a .json file")
    if task == "forecast" and not (file.filename or "").lower().endswith((".csv", ".parquet")):
        raise HTTPException(status_code=400, detail="Forecast submission must be a .csv or .parquet file")

    stored_path = _store_upload(file, task=task, team_id=current_user.team_id)

    try:
        validate_submission_file(task, str(stored_path))
    except Exception as exc:
        if stored_path.exists():
            stored_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid submission format: {exc}") from exc

    from sqlalchemy import text
    result = db.execute(
        text("UPDATE daily_limits SET count = count + 1 WHERE id = :id AND count < :limit"),
        {"id": limit_row.id, "limit": submission_limit_per_day}
    )
    if result.rowcount == 0:
        if stored_path.exists():
            stored_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=429,
            detail=f"Daily submission limit reached ({submission_limit_per_day}/day).",
        )

    submission_number = _current_submission_number(db, current_user.team_id, task)
    submission = Submission(
        team_id=current_user.team_id,
        task=task,
        submission_number=submission_number,
        file_path=str(stored_path),
        original_filename=file.filename or "submission",
        status="pending",
    )
    db.add(submission)

    db.commit()
    db.refresh(submission)
    db.refresh(limit_row)

    background_tasks.add_task(evaluate_submission_task, submission.id)

    return SubmitResponse(
        submission_id=submission.id,
        task=task,
        status=submission.status,
        submission_number=submission.submission_number,
        submissions_today=limit_row.count,
        remaining_submissions_today=max(0, submission_limit_per_day - limit_row.count),
    )


@api_router.post("/api/submit/pir", response_model=SubmitResponse)
def submit_pir(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create_submission("pir", file, background_tasks, current_user, db)


@api_router.post("/api/submit/forecast", response_model=SubmitResponse)
def submit_forecast(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create_submission("forecast", file, background_tasks, current_user, db)


@api_router.get("/api/submissions", response_model=List[SubmissionResponse])
def list_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Submission)
        .filter(Submission.team_id == current_user.team_id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    return [
        SubmissionResponse(
            id=row.id,
            task=row.task,
            status=row.status,
            submission_number=row.submission_number,
            original_filename=row.original_filename,
            submitted_at=row.submitted_at,
            evaluated_at=row.evaluated_at,
            metrics=_parse_metrics(row.metrics_json),
            error_message=row.error_message,
        )
        for row in rows
    ]


@api_router.get("/api/admin/teams", response_model=List[TeamSummaryResponse])
def admin_list_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    teams = db.query(Team).filter(Team.is_active.is_(True)).order_by(Team.name.asc()).all()
    result: List[TeamSummaryResponse] = []
    for team in teams:
        member_account = (
            db.query(User)
            .filter(User.team_id == team.id, User.role == "member")
            .order_by(User.id.asc())
            .first()
        )
        limit_row = _today_limit_row(db, team.id)
        result.append(
            TeamSummaryResponse(
                id=team.id,
                name=team.name,
                is_active=bool(team.is_active),
                member_account=member_account.username if member_account else "",
                member_profiles=_parse_member_profiles(team.member_profiles_json),
                submissions_today=limit_row.count,
            )
        )
    return result


@api_router.get("/api/admin/settings/submission-limit", response_model=SubmissionLimitResponse)
def admin_get_submission_limit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    return SubmissionLimitResponse(submission_limit_per_day=_get_submission_limit(db))


@api_router.put("/api/admin/settings/submission-limit", response_model=SubmissionLimitResponse)
def admin_update_submission_limit(
    payload: UpdateSubmissionLimitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    if payload.submission_limit_per_day < 1:
        raise HTTPException(status_code=400, detail="submission_limit_per_day must be >= 1")
    if payload.submission_limit_per_day > 100:
        raise HTTPException(status_code=400, detail="submission_limit_per_day must be <= 100")

    updated = _set_submission_limit(db, payload.submission_limit_per_day)
    return SubmissionLimitResponse(submission_limit_per_day=updated)


@api_router.post("/api/admin/teams/{team_id}/reset-password")
def admin_reset_team_password(
    team_id: int,
    payload: AdminResetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    member_account = (
        db.query(User)
        .filter(User.team_id == team_id, User.role == "member")
        .order_by(User.id.asc())
        .first()
    )
    if not member_account:
        raise HTTPException(status_code=404, detail="Team account not found")

    member_account.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"detail": f"Password for {member_account.username} has been reset"}


@api_router.get("/api/admin/submissions", response_model=List[AdminSubmissionResponse])
def admin_list_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    rows = (
        db.query(Submission, Team)
        .join(Team, Team.id == Submission.team_id)
        .filter(Team.is_active.is_(True))
        .order_by(Submission.submitted_at.desc())
        .all()
    )

    return [
        AdminSubmissionResponse(
            id=submission.id,
            team_name=team.name,
            task=submission.task,
            status=submission.status,
            submission_number=submission.submission_number,
            submitted_at=submission.submitted_at,
            evaluated_at=submission.evaluated_at,
            metrics=_parse_metrics(submission.metrics_json),
            error_message=submission.error_message,
        )
        for submission, team in rows
    ]


@api_router.post("/api/admin/ground-truth/{task}")
def admin_upload_ground_truth(
    task: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    if task not in ALLOWED_TASKS:
        raise HTTPException(status_code=400, detail="Invalid task")

    ext = Path(file.filename or "").suffix.lower()
    allowed_ext = {".parquet"}
    if task == "pir":
        allowed_ext.add(".json")
    if task == "forecast":
        allowed_ext.add(".csv")

    if ext not in allowed_ext:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported ground truth format for task '{task}'. Allowed: {sorted(allowed_ext)}",
        )

    ground_truth_dir = BASE_DIR / "ground_truth"
    ground_truth_dir.mkdir(parents=True, exist_ok=True)

    if task == "pir":
        target_stem = "pir_ground_truth_jan_2026"
        removable = [".json", ".parquet"]
    else:
        target_stem = "forecast_ground_truth_jan_2026"
        removable = [".csv", ".parquet"]

    temp_path = ground_truth_dir / f"{target_stem}.uploading{ext}"
    with temp_path.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    try:
        validate_ground_truth_file(task, str(temp_path))
    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid ground truth file: {exc}") from exc

    target_path = ground_truth_dir / f"{target_stem}{ext}"
    for old_ext in removable:
        old_path = ground_truth_dir / f"{target_stem}{old_ext}"
        if old_path.exists() and old_path != target_path:
            old_path.unlink(missing_ok=True)

    if target_path.exists():
        target_path.unlink(missing_ok=True)
    temp_path.replace(target_path)

    return {
        "detail": "Ground truth uploaded successfully",
        "task": task,
        "file": target_path.name,
    }


@api_router.post("/api/admin/train-data/{task}")
def admin_upload_train_data(
    task: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    if task not in ALLOWED_TASKS:
        raise HTTPException(status_code=400, detail="Invalid task")

    ext = Path(file.filename or "").suffix.lower()
    allowed_ext = {".parquet"}
    if task == "pir":
        allowed_ext.add(".json")
    if task == "forecast":
        allowed_ext.add(".csv")

    if ext not in allowed_ext:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported train data format for task '{task}'. Allowed: {sorted(allowed_ext)}",
        )

    TRAIN_DIR.mkdir(parents=True, exist_ok=True)

    if task == "pir":
        target_stem = "pir_train_2025"
        removable = [".json", ".parquet"]
    else:
        target_stem = "forecast_train_2025"
        removable = [".csv", ".parquet"]

    temp_path = TRAIN_DIR / f"{target_stem}.uploading{ext}"
    with temp_path.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    try:
        _validate_dataset_file_content(temp_path)
    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid train data file: {exc}") from exc

    target_path = TRAIN_DIR / f"{target_stem}{ext}"
    for old_ext in removable:
        old_path = TRAIN_DIR / f"{target_stem}{old_ext}"
        if old_path.exists() and old_path != target_path:
            old_path.unlink(missing_ok=True)

    if target_path.exists():
        target_path.unlink(missing_ok=True)
    temp_path.replace(target_path)

    preview = _build_dataset_preview(target_path)

    return {
        "detail": "Train data uploaded successfully",
        "task": task,
        "file": target_path.name,
        "preview": preview,
    }


@api_router.get("/api/submissions/{submission_id}/file")
def download_submission_file(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.team_id != current_user.team_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot access other team submissions")

    return FileResponse(submission.file_path, filename=submission.original_filename)


@api_router.get("/api/download/train/{task}")
def download_train_data(task: str):
    if task not in ALLOWED_TASKS:
        raise HTTPException(status_code=400, detail="Invalid task")

    try:
        path = _resolve_train_data_path(task)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Training file not found") from exc
    return FileResponse(str(path), filename=path.name)


@api_router.get("/api/health")
def health():
    return {"status": "ok"}


@api_router.get("/api/admin/ground-truth/{task}")
def admin_get_ground_truth(task: str, current_user: User = Depends(get_current_user)):
    _require_admin(current_user)

    if task not in ALLOWED_TASKS:
        raise HTTPException(status_code=400, detail="Invalid task")

    ground_truth_dir = BASE_DIR / "ground_truth"

    if task == "pir":
        stem = "pir_ground_truth_jan_2026"
        exts = [".json", ".parquet"]
    else:
        stem = "forecast_ground_truth_jan_2026"
        exts = [".csv", ".parquet"]

    for ext in exts:
        path = ground_truth_dir / f"{stem}{ext}"
        if path.exists():
            return {
                "exists": True,
                "filename": path.name
            }

    return {
        "exists": False,
        "filename": None
    }


app.include_router(api_router, prefix=BASE_PATH)

if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/grader/cs116.q21/WEB_CS116/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/grader/cs116.q21/WEB_CS116", include_in_schema=False)
@app.get("/grader/cs116.q21/WEB_CS116/", include_in_schema=False)
def frontend_index():
    index_path = FRONTEND_DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Frontend build not found. Run the root launcher to auto-build, or run 'npm run build' in the frontend directory.",
        },
    )


@app.get("/grader/cs116.q21/WEB_CS116/{full_path:path}", include_in_schema=False)
def frontend_fallback(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")

    file_path = FRONTEND_DIST_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))

    index_path = FRONTEND_DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))

    raise HTTPException(status_code=404, detail="Frontend build not found")


@app.delete("/api/admin/submissions/{submission_id}")
def admin_delete_submission(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    team_id = submission.team_id
    task = submission.task

    if submission.file_path and os.path.exists(submission.file_path):
        os.remove(submission.file_path)

    db.delete(submission)
    db.commit()

    remaining = (
        db.query(Submission)
        .filter(Submission.team_id == team_id, Submission.task == task, Submission.status == "completed")
        .all()
    )

    lb = (
        db.query(Leaderboard)
        .filter(Leaderboard.team_id == team_id, Leaderboard.task == task)
        .first()
    )

    if not remaining:
        if lb:
            db.delete(lb)
            db.commit()
    else:
        best_sub = None
        best_metrics = None

        for sub in remaining:
            metrics = _parse_metrics(sub.metrics_json) or {}
            if not best_sub:
                best_sub = sub
                best_metrics = metrics
            else:
                if _is_better(task, metrics, best_metrics):
                    best_sub = sub
                    best_metrics = metrics

        if lb:
            lb.primary_score = _primary_score(task, best_metrics)
            lb.best_metrics_json = json.dumps(best_metrics)
            lb.best_submission_id = best_sub.id
            lb.updated_at = _now_vn()
        else:
            lb = Leaderboard(
                team_id=team_id,
                task=task,
                primary_score=_primary_score(task, best_metrics),
                best_metrics_json=json.dumps(best_metrics),
                best_submission_id=best_sub.id,
                updated_at=_now_vn(),
            )
            db.add(lb)

        db.commit()

    return {"detail": "Submission deleted successfully"}

@app.delete("/api/admin/ground-truth/{task}")
def admin_delete_ground_truth(
    task: str,
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    if task not in ALLOWED_TASKS:
        raise HTTPException(status_code=400, detail="Invalid task")

    ground_truth_dir = BASE_DIR / "ground_truth"

    if task == "pir":
        stems = ["pir_ground_truth_jan_2026"]
        exts = [".json", ".parquet"]
    else:
        stems = ["forecast_ground_truth_jan_2026"]
        exts = [".csv", ".parquet"]

    deleted = False

    for stem in stems:
        for ext in exts:
            path = ground_truth_dir / f"{stem}{ext}"
            if path.exists():
                path.unlink()
                deleted = True

    if not deleted:
        raise HTTPException(status_code=404, detail="No ground truth file found")

    return {"detail": f"Ground truth for '{task}' deleted"}