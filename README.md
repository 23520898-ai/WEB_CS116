# CS116Q21 ML Challenge Platform

This document provides a complete guide for setup, running, publishing with ngrok HTTPS, and operating the system for both users and admins.

## 1. Overview

The platform includes two tasks:

- Task 1: Personalized Item Recommendation (PIR)
- Task 2: Sales Forecasting

Main behavior:

- Teams submit prediction files through the web interface
- The backend validates and evaluates submissions in the background
- The leaderboard is updated based on each team's best result

## 2. Architecture

- Backend: FastAPI + SQLAlchemy + SQLite
- Frontend: React + Vite
- Default runtime: one FastAPI server serves both API and frontend static assets
- Entry point: [main.py](main.py)

## 3. Accounts

Team accounts:

- NHOM01 to NHOM20
- Default password: 12345678

Admin account:

- admin / admin123

## 4. Scoring Logic

Task 1 PIR:

- Input: JSON dictionary customer_id -> list item_id
- Train: 2025
- Test blind: 01/2026 (purchased)
- Metrics:
  - total_correct_recommendations
  - iou
  - reciprocal_rank_first_hit
  - precision_at_10 (primary ranking metric)
  - map

Task 2 Forecast:

- Input: CSV with 3 columns: location, item_id, prediction
- Train: 2025
- Test blind: 01/2026 (purchased)
- Only locations with transactions are evaluated
- Rows with sale_status = 0 are excluded
- Metrics:
  - mae_sales
  - mae_revenue
  - mape_sales (primary ranking metric)
  - mape_revenue

## 5. Environment Setup

Requirements:

- Python 3.11
- Node.js + npm
- Conda

Install:

```powershell
conda env create -f environment.yml
conda activate cs116q21
pip install -r requirements.txt
```

If you encounter passlib/bcrypt errors:

```powershell
pip install --upgrade --force-reinstall bcrypt==4.0.1 passlib==1.7.4
```

## 6. Run Method 1: Quick Local Run (Recommended)

From the project root:

```powershell
conda activate cs116q21
python main.py
```

Default URLs:

- App: http://localhost:8000
- User docs page: http://localhost:8000/docs
- Swagger API: http://localhost:8000/api/docs

Notes:

- The launcher in [main.py](main.py) automatically builds the frontend if needed.

## 7. Run Method 2: Docker Compose

From the project root:

```powershell
docker compose up --build
```

In this mode:

- Backend: http://localhost:8000
- Frontend dev: http://localhost:3000

Use this when you need separate backend/frontend runtime environments.

## 8. Run Method 3: Publish with ngrok HTTPS

### 8.1 Configuration

The [ngrok.yml](ngrok.yml) file is configured with one tunnel for port 8000 and HTTPS-only publishing.

Update token in [ngrok.yml](ngrok.yml):

```yaml
authtoken: YOUR_NGROK_AUTHTOKEN
```

Or set a global token once:

```powershell
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

### 8.2 Run Steps

Step 1, run the app:

```powershell
conda activate cs116q21
python main.py
```

Step 2, open the tunnel:

```powershell
ngrok start --all --config ngrok.yml
```

Step 3, use the ngrok HTTPS URL to access/share the system.

## 9. User Workflow

1. Log in with an NHOMxx account
2. Open Team to update member profiles and change password
3. Open Submit to upload prediction files
4. Open History to track status and metrics
5. Open Dashboard to view rankings

## 10. Admin Workflow

Admin can:

- View active teams and member information
- View system-wide submission history
- Reset team account passwords
- Configure maximum submissions per day
- Upload ground truth
- Upload train data
- Preview schema/sample data after train data upload

Supported upload formats:

- Ground truth PIR: .json, .parquet
- Ground truth Forecast: .csv, .parquet
- Train data PIR: .json, .parquet
- Train data Forecast: .csv, .parquet

## 11. Main APIs

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
- GET /api/admin/settings/submission-limit
- PUT /api/admin/settings/submission-limit
- POST /api/admin/ground-truth/{task}
- POST /api/admin/train-data/{task}

Data and health:

- GET /api/download/train/pir
- GET /api/download/train/forecast
- GET /api/health

## 12. Quick Troubleshooting

1. ModuleNotFoundError (fastapi/uvicorn)

```powershell
conda activate cs116q21
pip install -r requirements.txt
```

2. npm is not recognized

- Install Node.js and open a new terminal.

3. No module named backend

- Run commands from the project root, not inside the frontend folder.

4. ngrok auth token error

- Check authtoken in [ngrok.yml](ngrok.yml)
- Or run ngrok config add-authtoken

5. Frontend UI does not update

```powershell
cd frontend
npm run build
```

## 13. Important Data Paths

- Ground truth: [backend/ground_truth](backend/ground_truth)
- Train data: [backend/train_data](backend/train_data)
- Submission uploads: [backend/uploads](backend/uploads)
- Database SQLite: [backend/ml_challenge.db](backend/ml_challenge.db)
