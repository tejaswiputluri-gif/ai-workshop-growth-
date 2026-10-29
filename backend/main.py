import csv
import io
import os
import re
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager, contextmanager
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv("DATABASE_PATH", str(ROOT / "growth.sqlite3")))
FRONTEND_DIR = ROOT / "dist"
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
STORAGE_MODE = os.getenv("STORAGE_MODE", "local")
TARGET = 500
BRANCHES = {"CSE", "CSE (AI/ML)", "IT", "ECE", "EEE", "Mechanical", "Civil", "Other"}
LIMITS: dict[str, list[float]] = {}

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="AI Workshop Growth System", version="1.0.0", lifespan=lifespan)
origins = [item.strip() for item in os.getenv("FRONTEND_ORIGIN", "http://127.0.0.1:5173").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-Admin-Token"],
)


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                phone TEXT NOT NULL,
                college TEXT NOT NULL,
                branch TEXT NOT NULL,
                year INTEGER NOT NULL,
                code TEXT NOT NULL UNIQUE,
                referral_code TEXT,
                source TEXT NOT NULL,
                visitor_id TEXT,
                utm_source TEXT NOT NULL DEFAULT '',
                utm_medium TEXT NOT NULL DEFAULT '',
                utm_campaign TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                is_demo INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (referral_code) REFERENCES registrations(code)
            );
            CREATE TABLE IF NOT EXISTS visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                created_at TEXT NOT NULL,
                visitor_id TEXT,
                utm_source TEXT NOT NULL DEFAULT '',
                utm_medium TEXT NOT NULL DEFAULT '',
                utm_campaign TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_registrations_created ON registrations(created_at);
            CREATE INDEX IF NOT EXISTS idx_registrations_source ON registrations(source);
            CREATE INDEX IF NOT EXISTS idx_registrations_referral ON registrations(referral_code);
            """
        )
        registration_columns = {row["name"] for row in db.execute("PRAGMA table_info(registrations)")}
        visit_columns = {row["name"] for row in db.execute("PRAGMA table_info(visits)")}
        for column, definition in (
            ("visitor_id", "TEXT"),
            ("utm_source", "TEXT NOT NULL DEFAULT ''"),
            ("utm_medium", "TEXT NOT NULL DEFAULT ''"),
            ("utm_campaign", "TEXT NOT NULL DEFAULT ''"),
        ):
            if column not in registration_columns:
                db.execute(f"ALTER TABLE registrations ADD COLUMN {column} {definition}")
            if column not in visit_columns:
                db.execute(f"ALTER TABLE visits ADD COLUMN {column} {definition}")
        db.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor_id) WHERE visitor_id IS NOT NULL"
        )


class VisitInput(BaseModel):
    source: str = Field(default="direct", max_length=80)
    visitor_id: str | None = Field(default=None, max_length=64)
    utm_source: str = Field(default="", max_length=80)
    utm_medium: str = Field(default="", max_length=80)
    utm_campaign: str = Field(default="", max_length=120)

    @field_validator("source", "utm_source", "utm_medium", "utm_campaign")
    @classmethod
    def safe_attribution_text(cls, value: str) -> str:
        if any(ord(char) < 32 for char in value):
            raise ValueError("Text contains invalid control characters.")
        return value


class RegistrationInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    phone: str = Field(min_length=10, max_length=18)
    college: str = Field(min_length=2, max_length=120)
    branch: str = Field(min_length=1, max_length=40)
    year: int
    referral_code: str = Field(default="", max_length=24)
    source: str = Field(default="direct", max_length=80)
    visitor_id: str | None = Field(default=None, max_length=64)
    utm_source: str = Field(default="", max_length=80)
    utm_medium: str = Field(default="", max_length=80)
    utm_campaign: str = Field(default="", max_length=120)
    consent: bool
    website: str = Field(default="", max_length=200)

    @field_validator(
        "name", "college", "branch", "referral_code", "source",
        "utm_source", "utm_medium", "utm_campaign",
    )
    @classmethod
    def safe_text(cls, value: str) -> str:
        if any(ord(char) < 32 for char in value):
            raise ValueError("Text contains invalid control characters.")
        return value

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("phone")
    @classmethod
    def normalise_phone(cls, value: str) -> str:
        phone = re.sub(r"[\s()-]", "", value)
        if phone.startswith("+91"):
            phone = phone[3:]
        elif phone.startswith("91") and len(phone) == 12:
            phone = phone[2:]
        if not re.fullmatch(r"[6-9]\d{9}", phone):
            raise ValueError("Enter a valid 10-digit Indian mobile number.")
        return phone


def client_limit(request: Request, key: str, max_requests: int, window: int = 60) -> None:
    now = time.time()
    address = request.client.host if request.client else "unknown"
    bucket = f"{address}:{key}"
    recent = [item for item in LIMITS.get(bucket, []) if now - item < window]
    if len(recent) >= max_requests:
        raise HTTPException(status_code=429, detail="Too many requests. Try again in a minute.")
    recent.append(now)
    LIMITS[bucket] = recent


def make_code(name: str, db: sqlite3.Connection) -> str:
    prefix = re.sub(r"[^A-Z]", "", name.upper().split()[0])[:4] or "STU"
    while True:
        code = f"{prefix}{secrets.randbelow(900_000) + 100_000}"
        if not db.execute("SELECT 1 FROM registrations WHERE code = ?", (code,)).fetchone():
            return code


def first_name(name: str) -> str:
    return name.split()[0][:24] if name else ""


def referral_counts(db: sqlite3.Connection) -> Counter:
    return Counter(row["referral_code"] for row in db.execute(
        "SELECT referral_code FROM registrations WHERE is_demo = 0 AND referral_code IS NOT NULL"
    ))


def leaderboard(db: sqlite3.Connection, limit: int = 10) -> list[dict]:
    rows = db.execute(
        """
        SELECT inviter.code, inviter.name, COUNT(*) AS referrals
        FROM registrations AS invitee
        JOIN registrations AS inviter ON inviter.code = invitee.referral_code
        WHERE invitee.is_demo = 0 AND inviter.is_demo = 0
        GROUP BY inviter.code, inviter.name
        ORDER BY referrals DESC, inviter.code ASC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [{"code": row["code"], "first_name": first_name(row["name"]), "referrals": row["referrals"]} for row in rows]


@app.get("/api/health")
def health() -> dict:
    with connect() as db:
        db.execute("SELECT 1").fetchone()
    persistence = STORAGE_MODE
    if STORAGE_MODE == "persistent" and not DB_PATH.parent.is_mount():
        persistence = "unverified"
    return {
        "ok": True,
        "storage": "SQLite",
        "persistence": persistence,
    }


@app.post("/api/visit")
def visit(body: VisitInput, request: Request) -> dict:
    client_limit(request, "visit", 60)
    source = re.sub(r"[^a-zA-Z0-9._-]", "", body.utm_source or body.source).lower()[:80] or "direct"
    with connect() as db:
        db.execute(
            """
            INSERT OR IGNORE INTO visits(source, created_at, visitor_id, utm_source, utm_medium, utm_campaign)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                source,
                datetime.now(timezone.utc).isoformat(),
                body.visitor_id,
                body.utm_source.strip().lower(),
                body.utm_medium.strip().lower(),
                body.utm_campaign.strip().lower(),
            ),
        )
    return {"ok": True}


@app.post("/api/register")
def register(body: RegistrationInput, request: Request) -> dict:
    client_limit(request, "register", 8)
    if body.website:
        raise HTTPException(status_code=400, detail="Registration could not be verified.")
    if not body.consent:
        raise HTTPException(status_code=400, detail="Please consent to workshop updates to register.")
    if body.branch not in BRANCHES:
        raise HTTPException(status_code=400, detail="Choose a valid engineering branch.")
    if body.year < datetime.now().year - 1 or body.year > datetime.now().year + 4:
        raise HTTPException(status_code=400, detail="Choose a graduation year from the available options.")
    referral = body.referral_code.strip().upper() or None
    utm_source = re.sub(r"[^a-zA-Z0-9._-]", "", body.utm_source).lower()[:80]
    source = re.sub(
        r"[^a-zA-Z0-9._-]",
        "",
        utm_source or (body.source if body.source != "direct" or not referral else "referral"),
    ).lower()[:80] or "direct"
    try:
        with connect() as db:
            if referral and not db.execute(
                "SELECT 1 FROM registrations WHERE code = ? AND is_demo = 0", (referral,)
            ).fetchone():
                raise HTTPException(status_code=400, detail="That referral code was not found. Check the code or remove it.")
            inviter = db.execute(
                "SELECT email FROM registrations WHERE code = ? AND is_demo = 0", (referral,)
            ).fetchone() if referral else None
            if inviter and inviter["email"].lower() == body.email:
                raise HTTPException(status_code=400, detail="You cannot use your own referral code.")
            code = make_code(body.name, db)
            db.execute(
                """
                INSERT INTO registrations(
                    name,email,phone,college,branch,year,code,referral_code,source,
                    visitor_id,utm_source,utm_medium,utm_campaign,created_at
                )
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (body.name, body.email, body.phone, body.college, body.branch, body.year,
                 code, referral, source, body.visitor_id, utm_source,
                 body.utm_medium.strip().lower(), body.utm_campaign.strip().lower(),
                 datetime.now(timezone.utc).isoformat()),
            )
    except HTTPException:
        raise
    except sqlite3.IntegrityError as exc:
        if "email" in str(exc).lower():
            raise HTTPException(status_code=409, detail="This email is already registered.") from exc
        raise HTTPException(status_code=500, detail="Could not save your registration. Please retry.") from exc
    return {"ok": True, "code": code, "first_name": first_name(body.name)}


@app.get("/api/stats")
def stats() -> dict:
    with connect() as db:
        total = db.execute("SELECT COUNT(*) AS n FROM registrations WHERE is_demo = 0").fetchone()["n"]
        return {"total": total, "target": TARGET, "leaderboard": leaderboard(db, 10)}


@app.get("/api/me/{code}")
def my_referrals(code: str) -> dict:
    with connect() as db:
        valid = db.execute("SELECT 1 FROM registrations WHERE code = ? AND is_demo = 0", (code.upper(),)).fetchone()
        if not valid:
            raise HTTPException(status_code=404, detail="Referral code not found.")
        count = db.execute(
            "SELECT COUNT(*) AS n FROM registrations WHERE referral_code = ? AND is_demo = 0", (code.upper(),)
        ).fetchone()["n"]
        return {"referrals": count}


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    if not ADMIN_TOKEN:
        raise HTTPException(status_code=503, detail="Admin dashboard is disabled until ADMIN_TOKEN is configured.")
    if not x_admin_token or not secrets.compare_digest(x_admin_token, ADMIN_TOKEN):
        raise HTTPException(status_code=401, detail="Admin token is invalid.")


@app.get("/api/admin/data", dependencies=[Depends(require_admin)])
def admin_data() -> dict:
    with connect() as db:
        rows = db.execute(
            "SELECT * FROM registrations ORDER BY created_at DESC, id DESC"
        ).fetchall()
        visit_rows = db.execute("SELECT source, visitor_id FROM visits").fetchall()
        all_rows = [dict(row) for row in rows]
        real = [row for row in all_rows if not row["is_demo"]]
        sources = Counter(row["source"] for row in real)
        utm_sources = Counter(row["utm_source"] for row in real if row["utm_source"])
        utm_mediums = Counter(row["utm_medium"] for row in real if row["utm_medium"])
        utm_campaigns = Counter(row["utm_campaign"] for row in real if row["utm_campaign"])
        daily = Counter(row["created_at"][:10] for row in real)
        tracked_visitors = {row["visitor_id"] for row in visit_rows if row["visitor_id"]}
        converted_visitors = {
            row["visitor_id"] for row in real
            if row["visitor_id"] and row["visitor_id"] in tracked_visitors
        }
        visit_source = Counter(row["source"] for row in visit_rows)
        registration_records = []
        for row in all_rows:
            record = {**row, "first_name": first_name(row["name"]), "is_demo": bool(row["is_demo"])}
            record.pop("visitor_id", None)
            registration_records.append(record)
        return {
            "total": len(all_rows),
            "real_total": len(real),
            "demo": sum(bool(row["is_demo"]) for row in all_rows),
            "target": TARGET,
            "by_source": dict(sources),
            "by_utm_source": dict(utm_sources),
            "by_utm_medium": dict(utm_mediums),
            "by_utm_campaign": dict(utm_campaigns),
            "visits_by_source": dict(visit_source),
            "by_referral_code": dict(referral_counts(db)),
            "leaderboard": leaderboard(db, 20),
            "daily": dict(sorted(daily.items())),
            "visits": len(tracked_visitors),
            "converted_visitors": len(converted_visitors),
            "conversion_percent": round(len(converted_visitors) / len(tracked_visitors) * 100, 1)
            if tracked_visitors else None,
            "registrations": registration_records,
        }


@app.get("/api/admin/export.csv", dependencies=[Depends(require_admin)])
def export_csv() -> PlainTextResponse:
    output = io.StringIO()
    fields = [
        "name", "email", "phone", "college", "branch", "year", "code", "referral_code",
        "source", "utm_source", "utm_medium", "utm_campaign", "created_at", "is_demo",
    ]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    with connect() as db:
        for row in db.execute("SELECT * FROM registrations ORDER BY created_at DESC"):
            safe_row = dict(row)
            for key, value in safe_row.items():
                if key in fields and isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
                    safe_row[key] = "'" + value
            writer.writerow(safe_row)
    return PlainTextResponse(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=registrations.csv"})


@app.post("/api/admin/demo", dependencies=[Depends(require_admin)])
def load_demo() -> dict:
    names = ["Aarav", "Diya", "Kiran", "Sneha", "Rohan"]
    sources = ["clubs", "ambassadors", "whatsapp", "email"]
    now = datetime.now(timezone.utc)
    with connect() as db:
        db.execute("DELETE FROM registrations WHERE is_demo = 1")
        for index in range(40):
            name = f"{names[index % len(names)]} Demo{index}"
            code = f"DEMO{index:03d}"
            referral = f"DEMO{index % 3:03d}" if index >= 10 and index % 3 else None
            created = (now.replace(hour=12, minute=0, second=0, microsecond=0) -
                       timedelta(days=index % 7)).isoformat()
            db.execute(
                """
                INSERT INTO registrations(name,email,phone,college,branch,year,code,referral_code,source,created_at,is_demo)
                VALUES(?,?,?,?,?,?,?,?,?,?,1)
                """,
                (name, f"demo{index}@example.test", "9000000000", "Demo College", "CSE",
                 2026, code, referral, sources[index % len(sources)], created),
            )
    return {"ok": True, "demo_records": 40}


@app.delete("/api/admin/demo", dependencies=[Depends(require_admin)])
def clear_demo() -> dict:
    with connect() as db:
        db.execute(
            """
            UPDATE registrations SET referral_code = NULL
            WHERE referral_code IN (SELECT code FROM registrations WHERE is_demo = 1)
            """
        )
        db.execute("DELETE FROM registrations WHERE is_demo = 1")
    return {"ok": True}


@app.get("/{full_path:path}", include_in_schema=False)
def frontend(full_path: str) -> FileResponse:
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found.")

    requested = (FRONTEND_DIR / full_path).resolve()
    if requested.is_relative_to(FRONTEND_DIR.resolve()) and requested.is_file():
        return FileResponse(requested)

    index = FRONTEND_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404, detail="Frontend assets are not built.")
    return FileResponse(index)
