# CS116Q21 ML Challenge Platform

Complete guide for setup, running, publishing via ngrok HTTPS, and operating the system as a user or admin.

---

## 1. Overview

The platform hosts two prediction tasks:

| Task | Name | Input | Primary Metric |
|------|------|-------|----------------|
| 1 | Personalized Item Recommendation (PIR) | JSON `{customer_id: [item_id]}` | Precision@10 (higher is better) |
| 2 | Sales Forecasting | CSV `location, item_id, prediction` | MAPE Sales (lower is better) |

Core flow: teams log in → upload prediction files → backend validates and scores in the background → leaderboard automatically reflects each team's best result.

---

## 2. Architecture

```
WEBSITE_CS116/
├── main.py                  # Entry point: builds frontend + starts FastAPI
├── backend/
│   ├── main.py              # FastAPI app, all API routes
│   ├── database.py          # SQLAlchemy models + SQLite init
│   ├── tasks.py             # Validation + background scoring
│   ├── evaluation/
│   │   ├── forecast_metrics.py   # MAPE, MAE for Forecast
│   │   └── pir_metrics.py        # Precision@10, MAP, IOU, RR for PIR
│   ├── ground_truth/        # Ground truth files (uploaded via Admin)
│   ├── train_data/          # Train data files (publicly downloadable)
│   └── uploads/             # Team submission files
└── frontend/                # React + Vite (served as static by FastAPI)
```

- **Backend:** FastAPI + SQLAlchemy + SQLite
- **Frontend:** React + Vite (static build, served by FastAPI)
- **Database:** `backend/ml_challenge.db` (auto-created on first run)

---

## 3. Default Accounts

### Team accounts

| Username | Password | Note |
|----------|----------|------|
| NHOM01 → NHOM20 | `12345678` | Change password after first login |

### Admin account

| Username | Password |
|----------|----------|
| `admin` | `admin123` |

---

## 4. Environment Setup

**Requirements:** Python 3.11, Node.js ≥ 18, Conda

```powershell
conda env create -f environment.yml
conda activate cs116q21
pip install -r requirements.txt
```

If you encounter `passlib`/`bcrypt` errors:

```powershell
pip install --upgrade --force-reinstall bcrypt==4.0.1 passlib==1.7.4
```

---

## 5. How to Run

### Option 1 — Local (recommended)

```powershell
conda activate cs116q21
python main.py
```

`main.py` builds the frontend automatically if no build exists. After startup:

| URL | Purpose |
|-----|---------|
| http://localhost:8000 | Main web UI |
| http://localhost:8000/api/docs | Swagger UI (interactive API testing) |
| http://localhost:8000/api/health | Health check |

### Option 2 — Docker Compose

```powershell
docker compose up --build
```

- Backend: http://localhost:8000
- Frontend dev (hot-reload): http://localhost:3000

### Option 3 — Publish via ngrok HTTPS

Update the token in [ngrok.yml](ngrok.yml):

```yaml
authtoken: YOUR_NGROK_AUTHTOKEN
```

Or set the token globally:

```powershell
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

Then run both commands in parallel (two terminals):

```powershell
# Terminal 1
conda activate cs116q21 ; python main.py

# Terminal 2
ngrok start --all --config ngrok.yml
```

Use the HTTPS URL from ngrok to share the system publicly.

---

## 6. Testing Guide

### 6.1 Pre-test Checklist

- [ ] Environment installed successfully (Section 4)
- [ ] Server is running and http://localhost:8000 loads
- [ ] Admin has uploaded ground truth for both tasks (see Section 6.3)

### 6.2 Test Team User Flow (UI)

1. Open http://localhost:8000
2. Log in as `NHOM01` / `12345678`
3. **Team page** → update member profiles, optionally change password
4. **Submit page** → select a task, upload a prediction file (see Section 7 for formats)
5. **History page** → monitor submission status: `pending` → `processing` → `done` or `error`
6. **Dashboard page** → check the leaderboard and verify scores update correctly

### 6.3 Test Admin Flow (UI)

1. Log in as `admin` / `admin123`
2. **Upload ground truth** (required before testing submissions):
   - Go to Admin → Ground Truth
   - Upload PIR file: `.json` or `.parquet`
   - Upload Forecast file: `.csv` or `.parquet`
3. **Upload train data** (for teams to download):
   - Go to Admin → Train Data
   - Upload the corresponding file for each task
4. **Team management:** view team list, reset passwords
5. **Submission limit:** configure the maximum number of submissions per day

### 6.4 Test API via Swagger UI

Open http://localhost:8000/api/docs and follow these steps:

1. `POST /api/auth/login` → enter credentials → copy the `access_token`
2. Click **Authorize** (lock icon, top right) → paste `Bearer <token>`
3. Call any endpoint you want to test

### 6.5 Test API via PowerShell

**Log in (get token):**

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"username":"NHOM01","password":"12345678"}'
$token = $response.access_token
```

**Submit a PIR file:**

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/submit/pir" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -Form @{ file = Get-Item ".\pir_submission.json" }
```

**Submit a Forecast file:**

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/submit/forecast" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -Form @{ file = Get-Item ".\forecast_submission.csv" }
```

**View submission history:**

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/submissions" `
  -Headers @{ Authorization = "Bearer $token" }
```

**View leaderboard (no login required):**

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/leaderboard/pir"
Invoke-RestMethod -Uri "http://localhost:8000/api/leaderboard/forecast"
```

---

## 7. Submission File Formats

### Task 1 — PIR (`.json`)

A JSON object where each key is a `customer_id` (string) and each value is an ordered array of `item_id` strings. Order matters — it is used for Reciprocal Rank and MAP.

```json
{
  "C001": ["I005", "I003", "I001", "I007"],
  "C002": ["I002", "I006", "I004"],
  "C003": ["I008", "I001", "I009", "I002", "I010"]
}
```

> **Notes:**
> - Only `customer_id` values that appear in the ground truth (i.e. have purchases in Jan 2026) are scored.
> - Extra `customer_id` keys not present in the ground truth are silently ignored.

### Task 2 — Forecast (`.csv`)

CSV with exactly 3 required columns: `location`, `item_id`, `prediction`.

```
location,item_id,prediction
S001,P001,120
S001,P002,80
S001,P004,50
S002,P001,90
S002,P002,110
```

> **Notes:**
> - `prediction` must be a non-negative integer or float.
> - Ground truth rows with `sale_status = 0` have `actual_quantity` forced to 0 (discontinued items). Predicting > 0 for discontinued items incurs a penalty.
> - `(location, item_id)` pairs you predict but that are absent from the ground truth are scored with `actual_quantity = 0`.
> - `(location, item_id)` pairs in the ground truth that you omit are scored with `prediction = 0`.

---

## 8. Scoring Formulas

### Task 1 — PIR

Computed over `eligible_customers` — only customers with at least one purchase in the ground truth:

| Metric | Formula | Direction |
|--------|---------|-----------|
| **Precision@10** *(primary)* | $\frac{\|top10 \cap actual\|}{\min(10,\|actual\|)}$ | Higher is better |
| MAP | $\frac{1}{N}\sum_{c} AP_c$ | Higher is better |
| IOU | $\frac{\|pred \cap actual\|}{\|pred \cup actual\|}$ | Higher is better |
| Reciprocal Rank | $\frac{1}{\text{rank of first hit}}$ | Higher is better |
| Total Correct | $\sum_c \|pred_c \cap actual_c\|$ | Info only |

Tiebreak order: Precision@10 → MAP → IOU → RR → Total Correct.

### Task 2 — Forecast

| Metric | Formula | Direction |
|--------|---------|-----------|
| **MAPE Sales** *(primary)* | $\frac{1}{N}\sum \text{ape}_i$ | Lower is better |
| MAE Sales | $\frac{1}{N}\sum \|actual_i - pred_i\|$ | Lower is better |
| MAPE Revenue | Same formula on `actual_qty × price` | Lower is better |
| MAE Revenue | Same formula on `actual_qty × price` | Lower is better |

**Per-row APE formula:**

$$\text{ape}_i = \begin{cases} \text{skipped} & \text{if } actual_i = 0 \text{ and } pred_i = 0 \\ \dfrac{|actual_i - pred_i| + 1}{|actual_i| + 1} \times 100 & \text{if } actual_i = 0 \text{ and } pred_i \ne 0 \;\text{(smoothing)} \\ \dfrac{|actual_i - pred_i|}{|actual_i|} \times 100 & \text{if } actual_i \ne 0 \end{cases}$$

Tiebreak order: MAPE Sales → MAE Sales → MAPE Revenue → MAE Revenue.

---

## 9. Ground Truth Format (Admin Upload)

### PIR ground truth (`.json` or `.parquet`)

**JSON format:**

```json
{
  "C001": ["I001", "I003", "I005"],
  "C002": ["I002", "I004", "I006"]
}
```

**Parquet format:** columns `customer_id` + `item_id` (long/row-per-item format), or `customer_id` + `items` (list or comma-separated string).

**Required filename:** `pir_ground_truth_jan_2026.json`

### Forecast ground truth (`.csv` or `.parquet`)

Must contain exactly these 5 columns:

```
location,item_id,actual_quantity,price,sale_status
S001,P001,120,20000,1
S001,P002,80,20000,1
S001,P003,0,0,0
```

| Column | Type | Description |
|--------|------|-------------|
| `location` | int/string | Store ID |
| `item_id` | string | Product ID |
| `actual_quantity` | int | Actual units sold |
| `price` | float | Unit price (used for revenue metrics) |
| `sale_status` | int | 1 = active, 0 = discontinued |

**Required filename:** `forecast_ground_truth_jan_2026.csv`

---

## 10. API Reference

### Auth & Profile

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Log in, returns JWT | None |
| POST | `/api/auth/change-password` | Change password | Bearer |
| GET | `/api/teams/me` | Current team info | Bearer |
| PUT | `/api/teams/me/profile` | Update members / notes | Bearer |

### Leaderboard & Submissions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/leaderboard/pir` | PIR leaderboard | None |
| GET | `/api/leaderboard/forecast` | Forecast leaderboard | None |
| POST | `/api/submit/pir` | Submit PIR file | Bearer |
| POST | `/api/submit/forecast` | Submit Forecast file | Bearer |
| GET | `/api/submissions` | Team's submission history | Bearer |
| GET | `/api/submissions/{id}/file` | Download submitted file | Bearer |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/teams` | List all teams | Admin |
| GET | `/api/admin/submissions` | All submissions system-wide | Admin |
| POST | `/api/admin/teams/{team_id}/reset-password` | Reset a team's password | Admin |
| GET | `/api/admin/settings/submission-limit` | Get daily submission limit | Admin |
| PUT | `/api/admin/settings/submission-limit` | Set daily submission limit | Admin |
| POST | `/api/admin/ground-truth/{task}` | Upload ground truth | Admin |
| POST | `/api/admin/train-data/{task}` | Upload train data | Admin |

### Data & Health

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/download/train/pir` | Download PIR train data | Bearer |
| GET | `/api/download/train/forecast` | Download Forecast train data | Bearer |
| GET | `/api/health` | Health check | None |

---

## 11. Submission Statuses

| Status | Meaning |
|--------|---------|
| `pending` | File received, waiting to be scored |
| `processing` | Scoring in progress |
| `done` | Scoring complete, metrics available |
| `error` | Validation or scoring failed — check `error_message` |

---

## 12. Troubleshooting

**1. `ModuleNotFoundError` (fastapi / uvicorn / ...)**

```powershell
conda activate cs116q21
pip install -r requirements.txt
```

**2. `npm is not recognized`**

Install Node.js from https://nodejs.org and open a new terminal after installation.

**3. `No module named backend`**

Run all commands from the project root, not from inside the `frontend/` folder.

**4. Submissions always fail with "Ground truth not found"**

The admin has not uploaded ground truth yet. Log in as admin → Admin page → upload the correct file with the correct filename.

**5. Swagger returns `401 Unauthorized`**

Click **Authorize** in Swagger UI and enter `Bearer <token>` — include the `Bearer ` prefix.

**6. Frontend does not reflect code changes**

```powershell
cd frontend
npm run build
```

**7. `passlib`/`bcrypt` error on startup**

```powershell
pip install --upgrade --force-reinstall bcrypt==4.0.1 passlib==1.7.4
```

**8. Reset the database to a clean state**

```powershell
Remove-Item backend\ml_challenge.db
python main.py   # recreates the DB with default data
```

---

## 13. Key Data Paths

| Purpose | Path |
|---------|------|
| Ground truth | [backend/ground_truth/](backend/ground_truth/) |
| Train data | [backend/train_data/](backend/train_data/) |
| Team uploads | [backend/uploads/](backend/uploads/) |
| SQLite database | `backend/ml_challenge.db` |
| Frontend build | `frontend/dist/` |
