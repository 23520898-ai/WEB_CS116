from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class TeamMemberResponse(BaseModel):
    username: str
    role: str


class TeamProfileMember(BaseModel):
    full_name: str
    student_id: Optional[str] = None
    email: Optional[str] = None


class UpdateTeamProfileRequest(BaseModel):
    members: List[TeamProfileMember] = Field(default_factory=list)
    notes: Optional[str] = ""


class TeamMeResponse(BaseModel):
    id: int
    name: str
    invite_code: str
    current_user_role: str
    members: List[TeamMemberResponse]
    member_profiles: List[TeamProfileMember]
    notes: str
    submission_limit_per_day: int
    submissions_today: int
    remaining_submissions_today: int
    pir_submissions_today: int = 0
    forecast_submissions_today: int = 0
    pir_remaining_today: int = 0
    forecast_remaining_today: int = 0


class LeaderboardEntry(BaseModel):
    submission_id: int | None
    rank: int
    team_name: str
    primary_score: float
    primary_label: str
    secondary_metrics: dict | None = None
    last_submission_at: datetime | None = None


class SubmissionResponse(BaseModel):
    id: int
    task: str
    status: str
    submission_number: int
    original_filename: str
    submitted_at: datetime
    evaluated_at: Optional[datetime]
    metrics: Optional[Dict[str, Any]]
    error_message: Optional[str]


class SubmitResponse(BaseModel):
    submission_id: int
    task: str
    status: str
    submission_number: int
    submissions_today: int
    remaining_submissions_today: int


class TeamSummaryResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    member_account: str
    member_profiles: List[TeamProfileMember]
    submissions_today: int


class AdminSubmissionResponse(BaseModel):
    id: int
    team_name: str
    task: str
    status: str
    submission_number: int
    submitted_at: datetime
    evaluated_at: Optional[datetime]
    metrics: Optional[Dict[str, Any]]
    error_message: Optional[str]


class AdminResetPasswordRequest(BaseModel):
    new_password: str = "12345678"


class SubmissionLimitResponse(BaseModel):
    submission_limit_per_day: int


class UpdateSubmissionLimitRequest(BaseModel):
    submission_limit_per_day: int
