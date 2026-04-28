# CS116Q21 ML Challenge Platform

This document describes how to install, run, configure, and operate the current version of the project.

The platform is designed so you can:

- Launch the full website (frontend + backend) with one Python command
- Change network settings (host, port, reload) in one place only

## Overview

The system supports two machine learning competition tasks:

- Task 1: Personalized Item Recommendation (PIR)
- Task 2: Sales Forecasting

Main behavior:

- Teams submit prediction files through the web UI
- Backend validates and evaluates submissions against hidden January 2026 ground truth
- Public leaderboards are updated automatically
- Each team is limited to 3 submissions per day

## Architecture (Current Version)

- Backend: FastAPI + SQLAlchemy + SQLite
- Frontend: React + Vite (built static assets)
- Runtime model: one FastAPI server serves API and frontend static files on the same host/port
- Entry point: [main.py](main.py)

## Repository Structure

```text
WEBSITE_CS116/
├── main.py                        # Single launcher (edit host/port here)
├── backend/
│   ├── main.py                    # FastAPI app, API routes, static serving fallback
│   ├── database.py                # Models, SQLite setup, seed logic
│   ├── auth.py                    # JWT auth helpers
│   ├── security.py                # Password hashing helpers
│   ├── tasks.py                   # Background evaluation pipeline
│   ├── schemas.py                 # Pydantic response/request schemas
│   ├── evaluation/
│   │   ├── pir_metrics.py
│   │   └── forecast_metrics.py
│   ├── ground_truth/              # Hidden scoring data
│   ├── train_data/                # Public downloadable training data
│   └── uploads/                   # Uploaded submission files
├── frontend/
│   ├── src/
│   ├── package.json
│   └── dist/                      # Generated build assets (auto-created)
├── requirements.txt
├── environment.yml
└── README.md
```

## Prerequisites

- Python 3.11
- Node.js + npm
- Conda (recommended)

## Setup (Conda)

Run from the repository root:

```powershell
conda env create -f environment.yml
conda activate cs116q21
pip install -r requirements.txt
```

Optional compatibility fix (only if you hit passlib/bcrypt issues):

```powershell
pip install --upgrade --force-reinstall bcrypt==4.0.1 passlib==1.7.4
```

Important:

- Use `cs116q21`, not `base`
# CS116Q21 ML Challenge Platform

This document provides a complete guide for both participants and admins.

## 1) Project Scope

The platform supports two tasks:

- Task 1: Personalized Item Recommendation (PIR)
- Task 2: Sale Forecasting

Teams upload prediction files, the system evaluates in background, and leaderboard updates automatically.

## 2) Runtime Architecture

- Backend: FastAPI + SQLAlchemy + SQLite
- Frontend: React + Vite
- Single-host runtime: one backend process serves both API and frontend static assets
- Main launcher: [main.py](main.py)

## 3) Account Model

### Group accounts

- Pre-seeded groups: NHOM01 to NHOM20
- Each group uses one shared account
- Username: same as group name (example: NHOM01)
- Default password: 12345678

### Admin account

- Username: admin
- Password: admin123
- Admin can view all active teams, view all submissions, and reset team passwords

## 4) Task Logic and Evaluation Rules

### Task 1 - PIR

- Submission format: JSON dictionary from customer_id to ordered list of item_id
- Train data period: year 2025
- Blind test period: January 2026
- Evaluation population: customers with purchased transactions in test period, including cold-start users created in January 2026
- Metrics:
  - total_correct_recommendations
  - iou
  - reciprocal_rank_first_hit
  - precision_at_10 (primary leaderboard score)
  - map

Scoring notes:

- precision_at_10 = hits in top-10 / min(10, number of actual purchased items for that customer)
- map = mean average precision across eligible customers
- iou = |predicted set intersection actual set| / |predicted set union actual set|
- reciprocal_rank_first_hit = 1 / rank of first correct predicted item

### Task 2 - Sale Forecasting

- Submission format: CSV with columns location, item_id, prediction
- Train data period: year 2025
- Blind test period: January 2026
- Evaluation population: only locations with transactions
- Exclusion rule: items with sale_status = 0 are excluded
- Metrics:
  - mae_sales
  - mae_revenue
  - mape_sales (primary leaderboard score)
  - mape_revenue

Scoring notes:

- mae_sales = mean absolute error on quantity
- pred_revenue is estimated by unit_price * prediction where unit_price = revenue / actual_qty for rows with actual_qty > 0
- mae_revenue = mean absolute error on revenue
- mape_sales is the primary leaderboard objective

### Leaderboard policy

- Leaderboard compares only active competition groups (NHOM01..NHOM20)
- Ground-truth files are not exposed in public UI
- Metrics for every submission are visible in history for transparent review

## 5) Setup

Prerequisites:

- Python 3.11
- Node.js + npm
- Conda recommended

Install:

```powershell
conda env create -f environment.yml
conda activate cs116q21
pip install -r requirements.txt
```

## 6) Run

From repository root:

```powershell
conda activate cs116q21
python main.py
```

Default URLs:

- App: http://localhost:8000
- App user docs page: http://localhost:8000/docs
- Backend API docs (Swagger): http://localhost:8000/api/docs

## 7) User Workflow

1. Login using NHOMxx account
2. Open Team page and update member profiles
3. Change shared password immediately
4. Upload submissions in Submit page
5. Track status and metrics in History page
6. Compare scores in Dashboard

## 8) Admin Workflow

1. Login with admin account
2. Open Admin page from sidebar
3. Review all active teams and member profiles
4. Review recent submissions from all teams
5. Reset a group password when required

## 9) API Summary

Authentication and profile:

- POST /api/auth/login
- POST /api/auth/change-password
- GET /api/teams/me
- PUT /api/teams/me/profile

Leaderboard and submissions:

- GET /api/leaderboard/pir
- GET /api/leaderboard/forecast
- POST /api/submit/pir
- POST /api/submit/forecast
- GET /api/submissions
- GET /api/submissions/{submission_id}/file

Admin:

- GET /api/admin/teams
- GET /api/admin/submissions
- POST /api/admin/teams/{team_id}/reset-password
- POST /api/admin/ground-truth/{task}

Data and health:

- GET /api/download/train/pir
- GET /api/download/train/forecast
- GET /api/health

## 10) Notes

- Hidden scoring data is stored in [backend/ground_truth](backend/ground_truth)
- Submission files are stored in [backend/uploads](backend/uploads)
- Public training data is in [backend/train_data](backend/train_data)
- Database is auto-created and auto-migrated on startup
- Ground truth upload formats:
  - PIR: .json or .parquet
  - Forecast: .csv or .parquet
The standard mode is `python main.py` only.
