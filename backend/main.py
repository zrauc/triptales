from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import secrets
import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "triptales.db"

app = FastAPI(title="TripTales API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso() -> str:
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split("$", 1)
    except ValueError:
        return False
    check = hash_password(password, salt)
    return hmac.compare_digest(check, stored)


def issue_token() -> str:
    return secrets.token_urlsafe(32)


def init_db() -> None:
    conn = db_conn()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin','user')),
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS itineraries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            region TEXT NOT NULL,
            duration_days INTEGER NOT NULL,
            budget_min INTEGER NOT NULL,
            budget_max INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            details TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
            created_by INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
        );
        """
    )

    cur.execute("SELECT COUNT(*) AS c FROM users")
    if cur.fetchone()["c"] == 0:
        created_at = now_iso()
        users = [
            ("Admin", "admin@triptales.local", hash_password("admin123"), "admin", created_at),
            ("Demo User", "user@triptales.local", hash_password("user123"), "user", created_at),
        ]
        cur.executemany(
            "INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)",
            users,
        )

        cur.execute("SELECT id FROM users WHERE email='user@triptales.local'")
        demo_user_id = cur.fetchone()["id"]

        seed = [
            (
                "Dal Lake Serenity Escape",
                "Kashmir",
                3,
                8000,
                12000,
                "../images/dal-lake.jpg",
                "Best Season: April to October. Ideal For: Couples, first-time visitors. "
                "A peaceful Dal Lake experience with shikara rides, Mughal gardens, and old Srinagar charm. "
                "Day 1: Check-in houseboat, evening shikara ride, Boulevard Road sunset walk. "
                "Day 2: Shalimar Bagh, Nishat Bagh, Hazratbal Shrine, local Kashmiri cuisine. "
                "Day 3: Jamia Masjid, Lal Chowk market, departure.",
                "approved",
                demo_user_id,
                created_at,
                created_at,
            ),
            (
                "Gulmarg Winter Adventure",
                "Kashmir",
                4,
                12000,
                18000,
                "../images/gulmarg-winter.jpg",
                "Best Season: December to February. Ideal For: Adventure lovers. "
                "Snow-covered landscapes, gondola rides, and skiing experiences in Gulmarg. "
                "Day 1: Srinagar arrival. "
                "Day 2: Transfer to Gulmarg, Gondola Phase 1, snow photography. "
                "Day 3: Beginner ski lessons and snow activities, snow lodge stay. "
                "Day 4: Return to Srinagar.",
                "approved",
                demo_user_id,
                created_at,
                created_at,
            ),
            (
                "Kashmir Valley Budget Explorer",
                "Kashmir",
                6,
                14000,
                20000,
                "../images/kashmir-valley.jpg",
                "Best Season: April to October. Ideal For: Students, backpackers. "
                "Covers Srinagar, Gulmarg, and Pahalgam with balanced valley exploration using public transport and guesthouse stays. "
                "Day 1-2: Srinagar local highlights and Dal Lake. "
                "Day 3-4: Gulmarg sightseeing on budget routes. "
                "Day 5: Pahalgam valleys and local market. "
                "Day 6: Return and departure.",
                "approved",
                demo_user_id,
                created_at,
                created_at,
            ),
            (
                "Rural Kashmir Experience",
                "Kashmir",
                5,
                10000,
                15000,
                "../images/rural_kashmir.png",
                "Best Season: April to November. Ideal For: Slow travelers. "
                "Focus on village homestays, apple orchards, traditional Kashmiri food, and less-touristy areas. "
                "Day 1: Arrival and homestay check-in. "
                "Day 2: Orchard walk and local family meal. "
                "Day 3: Village market and craft interaction. "
                "Day 4: Rural landscape day trip. "
                "Day 5: Departure.",
                "approved",
                demo_user_id,
                created_at,
                created_at,
            ),
            (
                "Ski and Snow Lodge Retreat",
                "Kashmir",
                4,
                15000,
                22000,
                "../images/skiing-kashmir.jpg",
                "Best Season: December to February. Ideal For: Winter sports enthusiasts. "
                "Highlights include professional ski sessions, cozy snow lodge stay, and bonfire evenings. "
                "Day 1: Arrival and equipment setup. "
                "Day 2: Guided ski practice and scenic snow trails. "
                "Day 3: Extended ski session, lodge leisure, evening bonfire. "
                "Day 4: Return to Srinagar.",
                "approved",
                demo_user_id,
                created_at,
                created_at,
            ),
            (
                "Dal Lake Photography Tour",
                "Kashmir",
                3,
                7000,
                11000,
                "../images/dal-lake-2.jpg",
                "Best Season: April to October. Ideal For: Photographers. "
                "Focus on sunrise shikara shots, floating market, reflection photography, and Mughal garden symmetry. "
                "Day 1: Golden hour at Dal Lake and boulevard walk. "
                "Day 2: Floating market dawn shoot and Mughal gardens composition study. "
                "Day 3: Old city street frames and departure.",
                "approved",
                demo_user_id,
                created_at,
                created_at,
            ),
            (
                "Gulmarg Scenic Getaway",
                "Kashmir",
                4,
                11000,
                16000,
                "../images/gulmarg-2.jpg",
                "Best Season: March to June and December to February. Ideal For: Families, honeymooners. "
                "More scenic-focused than adventure-focused, with relaxed mountain viewpoints and cozy stays. "
                "Day 1: Srinagar arrival. "
                "Day 2: Gulmarg transfer and gondola views. "
                "Day 3: Scenic exploration and leisure time. "
                "Day 4: Return to Srinagar.",
                "approved",
                demo_user_id,
                created_at,
                created_at,
            ),
            (
                "Vaishno Devi Spiritual Journey",
                "Jammu",
                3,
                6000,
                9000,
                "../images/vaishno-devi.jpg",
                "Best Season: March to October. Ideal For: Pilgrims. "
                "Includes Katra stay, yatra planning, budget lodging, and temple timing guidance. "
                "Day 1: Jammu to Katra, rest and registration. "
                "Day 2: Vaishno Devi yatra and darshan. "
                "Day 3: Return to Jammu and departure.",
                "approved",
                demo_user_id,
                created_at,
                created_at,
            ),
            (
                "Kashmir Collage Complete Tour",
                "Kashmir",
                7,
                18000,
                25000,
                "../images/kashmir-collage.jpg",
                "Best Season: April to October. Ideal For: First-time Kashmir travelers. "
                "Covers Srinagar, Gulmarg, Pahalgam, local markets, and scenic valleys for a complete first visit. "
                "Day 1-2: Srinagar and Dal Lake. "
                "Day 3-4: Gulmarg highlights. "
                "Day 5-6: Pahalgam and surrounding valleys. "
                "Day 7: Shopping and departure.",
                "approved",
                demo_user_id,
                created_at,
                created_at,
            ),
        ]
        cur.executemany(
            """
            INSERT INTO itineraries(
                title,region,duration_days,budget_min,budget_max,image_url,details,status,created_by,created_at,updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            seed,
        )

    conn.commit()
    conn.close()


@app.on_event("startup")
def on_startup() -> None:
    init_db()


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=200)
    password: str = Field(min_length=6, max_length=100)


class LoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=200)
    password: str = Field(min_length=6, max_length=100)


class ItineraryIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    region: str = Field(min_length=2, max_length=100)
    duration_days: int = Field(ge=1, le=30)
    budget_min: int = Field(ge=0)
    budget_max: int = Field(ge=0)
    image_url: str = Field(min_length=3, max_length=300)
    details: str = Field(min_length=10, max_length=5000)


class StatusIn(BaseModel):
    status: str


def parse_bearer(auth: Optional[str]) -> str:
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    prefix = "Bearer "
    if not auth.startswith(prefix):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    return auth[len(prefix) :]


def get_current_user(authorization: Optional[str] = Header(default=None)) -> sqlite3.Row:
    token = parse_bearer(authorization)
    conn = db_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.* FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token = ?
        """,
        (token,),
    )
    user = cur.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def get_optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[sqlite3.Row]:
    if not authorization:
        return None
    token = parse_bearer(authorization)
    conn = db_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.* FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token = ?
        """,
        (token,),
    )
    user = cur.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def require_admin(user: sqlite3.Row = Depends(get_current_user)) -> sqlite3.Row:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn):
    conn = db_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE email = ?", (payload.email.lower(),))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="Email already registered")

    cur.execute(
        "INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)",
        (
            payload.name.strip(),
            payload.email.lower(),
            hash_password(payload.password),
            "user",
            now_iso(),
        ),
    )
    conn.commit()
    conn.close()
    return {"message": "Registration successful"}


@app.post("/api/auth/login")
def login(payload: LoginIn):
    conn = db_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (payload.email.lower(),))
    user = cur.fetchone()
    if not user or not verify_password(payload.password, user["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = issue_token()
    cur.execute(
        "INSERT INTO sessions(user_id,token,created_at) VALUES (?,?,?)",
        (user["id"], token, now_iso()),
    )
    conn.commit()
    conn.close()
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
        },
    }


@app.post("/api/auth/logout")
def logout(user: sqlite3.Row = Depends(get_current_user), authorization: Optional[str] = Header(default=None)):
    token = parse_bearer(authorization)
    conn = db_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    return {"message": "Logged out"}


@app.get("/api/auth/me")
def me(user: sqlite3.Row = Depends(get_current_user)):
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
    }


def itinerary_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "region": row["region"],
        "duration_days": row["duration_days"],
        "budget_min": row["budget_min"],
        "budget_max": row["budget_max"],
        "image_url": row["image_url"],
        "details": row["details"],
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "created_by": {
            "id": row["created_by"],
            "name": row["creator_name"],
            "email": row["creator_email"],
        },
    }


@app.get("/api/itineraries")
def list_itineraries(
    q: str = Query(default=""),
    region: str = Query(default=""),
    status_filter: str = Query(default="", alias="status"),
    mine: bool = Query(default=False),
    user: Optional[sqlite3.Row] = Depends(get_optional_user),
):
    conn = db_conn()
    cur = conn.cursor()

    clauses = []
    params: list[object] = []

    if q:
        clauses.append("(i.title LIKE ? OR i.details LIKE ?)")
        like = f"%{q.strip()}%"
        params.extend([like, like])

    if region:
        clauses.append("i.region = ?")
        params.append(region.strip())

    if mine:
        if not user:
            conn.close()
            raise HTTPException(status_code=401, detail="Login required for mine=true")
        clauses.append("i.created_by = ?")
        params.append(user["id"])

    is_admin = bool(user and user["role"] == "admin")

    if status_filter:
        if not is_admin and status_filter.strip().lower() != "approved" and not mine:
            conn.close()
            raise HTTPException(status_code=403, detail="Only admin can query non-approved status")
        clauses.append("i.status = ?")
        params.append(status_filter.strip().lower())
    else:
        if not is_admin and not mine:
            clauses.append("i.status = 'approved'")

    where = " WHERE " + " AND ".join(clauses) if clauses else ""

    cur.execute(
        f"""
        SELECT i.*, u.name AS creator_name, u.email AS creator_email
        FROM itineraries i
        JOIN users u ON u.id = i.created_by
        {where}
        ORDER BY i.updated_at DESC
        """,
        params,
    )
    items = [itinerary_row_to_dict(r) for r in cur.fetchall()]
    conn.close()
    return {"items": items}


@app.post("/api/itineraries", status_code=status.HTTP_201_CREATED)
def create_itinerary(payload: ItineraryIn, user: sqlite3.Row = Depends(get_current_user)):
    if payload.budget_max < payload.budget_min:
        raise HTTPException(status_code=400, detail="budget_max must be >= budget_min")

    now = now_iso()
    conn = db_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO itineraries(
            title,region,duration_days,budget_min,budget_max,image_url,details,status,created_by,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            payload.title.strip(),
            payload.region.strip(),
            payload.duration_days,
            payload.budget_min,
            payload.budget_max,
            payload.image_url.strip(),
            payload.details.strip(),
            "pending",
            user["id"],
            now,
            now,
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {"id": new_id, "message": "Itinerary submitted for review"}


@app.put("/api/itineraries/{itinerary_id}")
def update_itinerary(itinerary_id: int, payload: ItineraryIn, user: sqlite3.Row = Depends(get_current_user)):
    if payload.budget_max < payload.budget_min:
        raise HTTPException(status_code=400, detail="budget_max must be >= budget_min")

    conn = db_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM itineraries WHERE id = ?", (itinerary_id,))
    item = cur.fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Itinerary not found")

    if user["role"] != "admin" and item["created_by"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="You can only edit your own itineraries")

    next_status = item["status"] if user["role"] == "admin" else "pending"

    cur.execute(
        """
        UPDATE itineraries
        SET title=?, region=?, duration_days=?, budget_min=?, budget_max=?, image_url=?, details=?, status=?, updated_at=?
        WHERE id=?
        """,
        (
            payload.title.strip(),
            payload.region.strip(),
            payload.duration_days,
            payload.budget_min,
            payload.budget_max,
            payload.image_url.strip(),
            payload.details.strip(),
            next_status,
            now_iso(),
            itinerary_id,
        ),
    )
    conn.commit()
    conn.close()
    return {"message": "Itinerary updated"}


@app.delete("/api/itineraries/{itinerary_id}")
def delete_itinerary(itinerary_id: int, user: sqlite3.Row = Depends(get_current_user)):
    conn = db_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM itineraries WHERE id = ?", (itinerary_id,))
    item = cur.fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Itinerary not found")

    if user["role"] != "admin" and item["created_by"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="You can only delete your own itineraries")

    cur.execute("DELETE FROM itineraries WHERE id = ?", (itinerary_id,))
    conn.commit()
    conn.close()
    return {"message": "Itinerary deleted"}


@app.patch("/api/itineraries/{itinerary_id}/status")
def set_status(itinerary_id: int, payload: StatusIn, admin: sqlite3.Row = Depends(require_admin)):
    wanted = payload.status.strip().lower()
    if wanted not in {"approved", "rejected", "pending"}:
        raise HTTPException(status_code=400, detail="status must be approved, rejected, or pending")

    conn = db_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM itineraries WHERE id = ?", (itinerary_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Itinerary not found")

    cur.execute(
        "UPDATE itineraries SET status = ?, updated_at = ? WHERE id = ?",
        (wanted, now_iso(), itinerary_id),
    )
    conn.commit()
    conn.close()
    return {"message": f"Itinerary marked as {wanted}", "by": admin["email"]}
