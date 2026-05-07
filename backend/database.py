import json
import os
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from backend.security import hash_password

VN_TZ = timezone(timedelta(hours=7))


def _now_vn() -> datetime:
    """Return current datetime in Vietnam timezone stored as naive datetime."""
    return datetime.now(VN_TZ).replace(tzinfo=None)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "ml_challenge.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    invite_code = Column(String, unique=True, nullable=False)
    member_profiles_json = Column(Text, nullable=False, default="[]")
    notes = Column(Text, nullable=False, default="")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_now_vn, nullable=False)

    users = relationship("User", back_populates="team")
    submissions = relationship("Submission", back_populates="team")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    # Token + expiry for password reset flow
    reset_token = Column(String, nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)
    role = Column(String, default="member", nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)

    team = relationship("Team", back_populates="users")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    task = Column(String, nullable=False)
    submission_number = Column(Integer, nullable=False)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)
    metrics_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=_now_vn, nullable=False)
    evaluated_at = Column(DateTime, nullable=True)

    team = relationship("Team", back_populates="submissions")


class DailyLimit(Base):
    __tablename__ = "daily_limits"

    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    date = Column(Date, nullable=False)
    count = Column(Integer, default=0, nullable=False)

    __table_args__ = (UniqueConstraint("team_id", "date", name="uix_team_date"),)


class Leaderboard(Base):
    __tablename__ = "leaderboard"

    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    task = Column(String, nullable=False)
    primary_score = Column(Float, nullable=False)
    best_metrics_json = Column(Text, nullable=False)
    best_submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=True)
    updated_at = Column(DateTime, default=_now_vn, nullable=False)

    __table_args__ = (UniqueConstraint("team_id", "task", name="uix_team_task"),)


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=_now_vn, nullable=False)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_schema_migrations()
    seed_data()


def _ensure_schema_migrations() -> None:
    inspector = inspect(engine)
    team_columns = {col["name"] for col in inspector.get_columns("teams")}

    with engine.begin() as conn:
        if "member_profiles_json" not in team_columns:
            conn.execute(
                text("ALTER TABLE teams ADD COLUMN member_profiles_json TEXT NOT NULL DEFAULT '[]'")
            )
        if "notes" not in team_columns:
            conn.execute(text("ALTER TABLE teams ADD COLUMN notes TEXT NOT NULL DEFAULT ''"))
        if "is_active" not in team_columns:
            conn.execute(text("ALTER TABLE teams ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))
        # Ensure users table has reset token columns for password recovery
        user_columns = {col["name"] for col in inspector.get_columns("users")}
        if "reset_token" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN reset_token TEXT NULL"))
        if "reset_token_expires_at" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN reset_token_expires_at DATETIME NULL"))


def seed_data() -> None:
    db = SessionLocal()
    try:
        team_names = [f"NHOM{idx:02d}" for idx in range(1, 21)]
        teams = []
        for name in team_names:
            team = db.query(Team).filter(Team.name == name).first()
            if not team:
                team = Team(
                    name=name,
                    invite_code=secrets.token_hex(4).upper(),
                    member_profiles_json="[]",
                    notes="",
                    is_active=True,
                )
                db.add(team)
            else:
                team.is_active = True
            teams.append(team)

        # Keep legacy teams for historical data but exclude them from active ranking.
        legacy_teams = db.query(Team).filter(~Team.name.in_(team_names)).all()
        for legacy_team in legacy_teams:
            legacy_team.is_active = False

        db.commit()

        for team in teams:
            db.refresh(team)
            username = team.name
            user = db.query(User).filter(User.username == username).first()
            if not user:
                user = User(
                    username=username,
                    password_hash=hash_password("12345678"),
                    role="member",
                    team_id=team.id,
                )
                db.add(user)
            else:
                user.team_id = team.id
                user.role = "member"

        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                password_hash=hash_password("admin123"),
                role="admin",
                team_id=teams[0].id,
            )
            db.add(admin)
        else:
            admin.role = "admin"
            admin.team_id = teams[0].id
        db.commit()

        for team in teams:
            db.refresh(team)
            pir_row = (
                db.query(Leaderboard)
                .filter(Leaderboard.team_id == team.id, Leaderboard.task == "pir")
                .first()
            )
            if not pir_row:
                db.add(
                    Leaderboard(
                        team_id=team.id,
                        task="pir",
                        primary_score=0.0,
                        best_metrics_json=json.dumps({}),
                        best_submission_id=None,
                    )
                )

            forecast_row = (
                db.query(Leaderboard)
                .filter(Leaderboard.team_id == team.id, Leaderboard.task == "forecast")
                .first()
            )
            if not forecast_row:
                db.add(
                    Leaderboard(
                        team_id=team.id,
                        task="forecast",
                        primary_score=999999.0,
                        best_metrics_json=json.dumps({}),
                        best_submission_id=None,
                    )
                )
        db.commit()

        submission_limit_setting = (
            db.query(AppSetting).filter(AppSetting.key == "submission_limit_per_day").first()
        )
        if not submission_limit_setting:
            db.add(AppSetting(key="submission_limit_per_day", value="3"))
            db.commit()
    except Exception:
        db.rollback()
        raise

    finally:
        db.close()
