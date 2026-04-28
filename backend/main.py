import json
import os
import shutil
from datetime import date, datetime
from pathlib import Path
from typing import List

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from backend.auth import create_access_token, get_current_user, get_db, verify_password
from backend.database import DailyLimit, Leaderboard, Submission, Team, User, init_db
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
    UpdateTeamProfileRequest,
)
from backend.tasks import evaluate_submission_task, validate_submission_file

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
TRAIN_DIR = BASE_DIR / "train_data"
FRONTEND_DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

SUBMISSION_LIMIT_PER_DAY = 3
ALLOWED_TASKS = {"pir", "forecast"}

app = FastAPI(
    title="CS116 ML Challenge",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

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


def _today_limit_row(db: Session, team_id: int) -> DailyLimit:
    today = date.today()
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


def _require_admin(current_user: User) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permission required")
    try:
        return json.loads(metrics_json)
    except json.JSONDecodeError:
        return None


def _store_upload(file: UploadFile, task: str, team_id: int) -> Path:
    safe_filename = Path(file.filename or "submission").name
    suffix = Path(safe_filename).suffix
    task_dir = UPLOAD_DIR / task
    task_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"team{team_id}_{int(datetime.utcnow().timestamp())}_{Path(safe_filename).stem}{suffix}"
    path = task_dir / stored_name

    with path.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    return path


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(subject=user.username)
    return LoginResponse(access_token=token)


@app.get("/api/teams/me", response_model=TeamMeResponse)
def get_team_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == current_user.team_id).first()
    members = db.query(User).filter(User.team_id == current_user.team_id).all()
    limit_row = _today_limit_row(db, current_user.team_id)

    return TeamMeResponse(
        id=team.id,
        name=team.name,
        invite_code=team.invite_code,
        current_user_role=current_user.role,
        members=[TeamMemberResponse(username=m.username, role=m.role) for m in members],
        member_profiles=_parse_member_profiles(team.member_profiles_json),
        notes=team.notes or "",
        submission_limit_per_day=SUBMISSION_LIMIT_PER_DAY,
        submissions_today=limit_row.count,
        remaining_submissions_today=max(0, SUBMISSION_LIMIT_PER_DAY - limit_row.count),
    )


@app.post("/api/auth/change-password")
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


@app.put("/api/teams/me/profile", response_model=TeamMeResponse)
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

    return TeamMeResponse(
        id=team.id,
        name=team.name,
        invite_code=team.invite_code,
        current_user_role=current_user.role,
        members=[TeamMemberResponse(username=m.username, role=m.role) for m in members],
        member_profiles=_parse_member_profiles(team.member_profiles_json),
        notes=team.notes or "",
        submission_limit_per_day=SUBMISSION_LIMIT_PER_DAY,
        submissions_today=limit_row.count,
        remaining_submissions_today=max(0, SUBMISSION_LIMIT_PER_DAY - limit_row.count),
    )


def _leaderboard_response(task: str, db: Session) -> List[LeaderboardEntry]:
    rows = (
        db.query(Leaderboard, Team, Submission)
        .join(Team, Team.id == Leaderboard.team_id)
        .outerjoin(Submission, Submission.id == Leaderboard.best_submission_id)
        .filter(Leaderboard.task == task, Team.is_active.is_(True))
        .all()
    )

    if task == "pir":
        rows.sort(key=lambda x: x[0].primary_score, reverse=True)
        primary_label = "Precision@10"
    else:
        rows.sort(key=lambda x: x[0].primary_score)
        primary_label = "MAPE Sales"

    result = []
    for idx, (lb, team, sub) in enumerate(rows, start=1):
        result.append(
            LeaderboardEntry(
                rank=idx,
                team_name=team.name,
                primary_score=lb.primary_score,
                primary_label=primary_label,
                secondary_metrics=_parse_metrics(lb.best_metrics_json) or {},
                last_submission_at=sub.evaluated_at if sub else None,
            )
        )
    return result


@app.get("/api/leaderboard/pir", response_model=List[LeaderboardEntry])
def leaderboard_pir(db: Session = Depends(get_db)):
    return _leaderboard_response("pir", db)


@app.get("/api/leaderboard/forecast", response_model=List[LeaderboardEntry])
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

    limit_row = _today_limit_row(db, current_user.team_id)
    if limit_row.count >= SUBMISSION_LIMIT_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail=f"Daily submission limit reached ({SUBMISSION_LIMIT_PER_DAY}/day).",
        )

    if task == "pir" and not (file.filename or "").lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="PIR submission must be a .json file")
    if task == "forecast" and not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Forecast submission must be a .csv file")

    stored_path = _store_upload(file, task=task, team_id=current_user.team_id)

    try:
        validate_submission_file(task, str(stored_path))
    except Exception as exc:
        if stored_path.exists():
            stored_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid submission format: {exc}") from exc

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

    limit_row.count += 1
    db.commit()
    db.refresh(submission)

    background_tasks.add_task(evaluate_submission_task, submission.id)

    return SubmitResponse(
        submission_id=submission.id,
        task=task,
        status=submission.status,
        submission_number=submission.submission_number,
        submissions_today=limit_row.count,
        remaining_submissions_today=max(0, SUBMISSION_LIMIT_PER_DAY - limit_row.count),
    )


@app.post("/api/submit/pir", response_model=SubmitResponse)
def submit_pir(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create_submission("pir", file, background_tasks, current_user, db)


@app.post("/api/submit/forecast", response_model=SubmitResponse)
def submit_forecast(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create_submission("forecast", file, background_tasks, current_user, db)


@app.get("/api/submissions", response_model=List[SubmissionResponse])
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


@app.get("/api/admin/teams", response_model=List[TeamSummaryResponse])
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


@app.post("/api/admin/teams/{team_id}/reset-password")
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


@app.get("/api/admin/submissions", response_model=List[AdminSubmissionResponse])
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


@app.get("/api/submissions/{submission_id}/file")
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


@app.get("/api/download/train/{task}")
def download_train_data(task: str):
    if task not in ALLOWED_TASKS:
        raise HTTPException(status_code=400, detail="Invalid task")

    if task == "pir":
        path = TRAIN_DIR / "pir_train_2025.json"
    else:
        path = TRAIN_DIR / "forecast_train_2025.csv"

    if not path.exists():
        raise HTTPException(status_code=404, detail="Training file not found")
    return FileResponse(str(path), filename=path.name)


@app.get("/api/health")
def health():
    return {"status": "ok"}


if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/", include_in_schema=False)
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


@app.get("/{full_path:path}", include_in_schema=False)
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
