# TripTales Backend (FastAPI + SQLite)

## Run backend

### PowerShell (Windows)

```powershell
cd C:\TripTales\backend
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### Bash (macOS/Linux/Git Bash)

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  # Git Bash on Windows
# source .venv/bin/activate    # macOS/Linux
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## Demo accounts (seeded automatically)

- Admin: `admin@triptales.local` / `admin123`
- User: `user@triptales.local` / `user123`

## API base

- `http://127.0.0.1:8000/api`
