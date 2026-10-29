import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test.sqlite3")
    monkeypatch.setattr(main, "ADMIN_TOKEN", "test-admin-token")
    main.LIMITS.clear()
    main.init_db()
    with TestClient(main.app) as test_client:
        yield test_client


def register(client, **overrides):
    body = {
        "name": "Student Example",
        "email": "Student@example.test",
        "phone": "9876543210",
        "college": "Example Engineering College",
        "branch": "CSE (AI/ML)",
        "year": 2027,
        "consent": True,
        "source": "clubs",
    }
    body.update(overrides)
    return client.post("/api/register", json=body)


def test_registration_and_case_insensitive_duplicate(client):
    created = register(client)
    assert created.status_code == 200
    assert len(created.json()["code"]) >= 5
    duplicate = register(client, email="  STUDENT@EXAMPLE.TEST ")
    assert duplicate.status_code == 409
    assert client.get("/api/stats").json()["total"] == 1


def test_referral_attribution_and_public_privacy(client):
    inviter = register(client, email="inviter@example.test")
    invited = register(
        client,
        name="Second Student",
        email="second@example.test",
        referral_code=inviter.json()["code"].lower(),
        source="ambassadors",
    )
    assert invited.status_code == 200
    assert client.get(f"/api/me/{inviter.json()['code']}").json()["referrals"] == 1
    public = client.get("/api/stats").json()
    assert public["total"] == 2
    assert public["leaderboard"][0]["first_name"] == "Student"
    assert "email" not in str(public).lower()


def test_leaderboard_orders_referral_counts_and_breaks_ties_by_code(client):
    first = register(client, email="first-inviter@example.test").json()["code"]
    second = register(client, email="second-inviter@example.test").json()["code"]
    for index, code in enumerate((first, second, first, second)):
        response = register(
            client,
            name=f"Referred Student {index}",
            email=f"referred-{index}@example.test",
            referral_code=code,
        )
        assert response.status_code == 200
    leaders = client.get("/api/stats").json()["leaderboard"]
    assert [row["referrals"] for row in leaders] == [2, 2]
    assert [row["code"] for row in leaders] == sorted((first, second))


def test_bad_referral_and_missing_consent_are_rejected(client):
    assert register(client, referral_code="NOTREAL").status_code == 400
    assert register(client, email="no-consent@example.test", consent=False).status_code == 400


def test_required_fields_email_phone_and_year_validation(client):
    assert client.post("/api/register", json={}).status_code == 422
    assert register(client, email="not-an-email").status_code == 422
    assert register(client, phone="12345").status_code == 422
    assert register(client, year=2035).status_code == 400
    assert register(client, email="eligible-2027@example.test", year=2027).status_code == 200


def test_self_referral_is_rejected(client):
    student = register(client, email="self@example.test")
    response = register(client, email="SELF@example.test", referral_code=student.json()["code"])
    assert response.status_code == 400
    assert "own referral code" in response.json()["detail"]
    assert client.get(f"/api/me/{student.json()['code']}").json()["referrals"] == 0


def test_admin_auth_metrics_demo_and_export(client):
    assert client.get("/api/admin/data").status_code == 401
    headers = {"X-Admin-Token": "test-admin-token"}
    assert client.get("/api/admin/data", headers={"X-Admin-Token": "wrong"}).status_code == 401
    assert register(client).status_code == 200
    assert client.post("/api/admin/demo", headers=headers).json()["demo_records"] == 40
    data = client.get("/api/admin/data", headers=headers).json()
    assert data["real_total"] == 1
    assert data["demo"] == 40
    assert sum(data["by_source"].values()) == 1
    assert data["by_source"]["clubs"] == 1
    assert len(data["registrations"]) == 41
    public = client.get("/api/stats").json()
    assert public["total"] == 1
    assert len(public["leaderboard"]) == 0
    export = client.get("/api/admin/export.csv", headers=headers)
    assert export.status_code == 200
    assert "student@example.test" in export.text
    assert client.delete("/api/admin/demo", headers=headers).status_code == 200
    assert client.get("/api/admin/data", headers=headers).json()["total"] == 1


def test_referral_and_daily_metrics_match_stored_rows(client):
    inviter = register(client, email="metric-inviter@example.test", source="clubs")
    register(
        client,
        name="Metric Invitee",
        email="metric-invitee@example.test",
        referral_code=inviter.json()["code"],
        source="ambassadors",
    )
    headers = {"X-Admin-Token": "test-admin-token"}
    data = client.get("/api/admin/data", headers=headers).json()
    assert data["by_referral_code"] == {inviter.json()["code"]: 1}
    assert sum(data["daily"].values()) == data["real_total"] == 2
    assert data["by_source"] == {"clubs": 1, "ambassadors": 1}


def test_utm_attribution_and_conversion_use_unique_tracked_visitors(client):
    visitor = "c3144a01-0c1e-49df-a4f5-cc57071a52c9"
    visit = {
        "visitor_id": visitor,
        "source": "direct",
        "utm_source": "clubs",
        "utm_medium": "whatsapp",
        "utm_campaign": "october-workshop",
    }
    assert client.post("/api/visit", json=visit).status_code == 200
    assert client.post("/api/visit", json=visit).status_code == 200
    created = register(
        client,
        email="utm@example.test",
        visitor_id=visitor,
        source="direct",
        utm_source="clubs",
        utm_medium="whatsapp",
        utm_campaign="october-workshop",
    )
    assert created.status_code == 200
    headers = {"X-Admin-Token": "test-admin-token"}
    data = client.get("/api/admin/data", headers=headers).json()
    assert data["visits"] == data["converted_visitors"] == 1
    assert data["conversion_percent"] == 100
    assert data["by_source"] == {"clubs": 1}
    assert data["by_utm_medium"] == {"whatsapp": 1}
    assert data["by_utm_campaign"] == {"october-workshop": 1}
    assert "visitor_id" not in data["registrations"][0]
    export = client.get("/api/admin/export.csv", headers=headers)
    assert "utm_source" in export.text
    assert "october-workshop" in export.text


def test_registration_persists_after_database_reinitialization(client):
    assert register(client, email="persist@example.test").status_code == 200
    main.init_db()
    with main.connect() as db:
        row = db.execute(
            "SELECT email, year, code FROM registrations WHERE email = ?",
            ("persist@example.test",),
        ).fetchone()
    assert row["email"] == "persist@example.test"
    assert row["year"] == 2027
    assert row["code"]


def test_database_migration_adds_attribution_columns(client, tmp_path, monkeypatch):
    legacy_database = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(legacy_database) as db:
        db.executescript(
            """
            CREATE TABLE registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE, phone TEXT NOT NULL,
                college TEXT NOT NULL, branch TEXT NOT NULL, year INTEGER NOT NULL,
                code TEXT NOT NULL UNIQUE, referral_code TEXT, source TEXT NOT NULL,
                created_at TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, created_at TEXT NOT NULL
            );
            """
        )
    monkeypatch.setattr(main, "DB_PATH", legacy_database)
    main.init_db()
    with main.connect() as db:
        registration_columns = {row["name"] for row in db.execute("PRAGMA table_info(registrations)")}
        visit_columns = {row["name"] for row in db.execute("PRAGMA table_info(visits)")}
    assert {"visitor_id", "utm_source", "utm_medium", "utm_campaign"} <= registration_columns
    assert {"visitor_id", "utm_source", "utm_medium", "utm_campaign"} <= visit_columns


def test_rate_limit_blocks_excessive_registration(client, monkeypatch):
    monkeypatch.setattr(main, "client_limit", lambda *args, **kwargs: None)
    assert register(client).status_code == 200
    monkeypatch.setattr(main, "client_limit", lambda *args, **kwargs: (_ for _ in ()).throw(main.HTTPException(429, "Too many requests.")))
    assert register(client, email="other@example.test").status_code == 429


def test_frontend_and_admin_spa_routes_are_served(client):
    homepage = client.get("/")
    admin = client.get("/admin")
    public_pages = [client.get(path) for path in ("/agenda", "/register", "/referrals", "/leaderboard")]
    missing_api = client.get("/api/not-a-route")
    assert homepage.status_code == 200
    assert 'id="root"' in homepage.text
    assert admin.status_code == 200
    assert 'id="root"' in admin.text
    assert all(response.status_code == 200 and 'id="root"' in response.text for response in public_pages)
    assert missing_api.status_code == 404


def test_health_check_verifies_database_and_reports_storage_mode(client, monkeypatch):
    monkeypatch.setattr(main, "STORAGE_MODE", "ephemeral")
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True, "storage": "SQLite", "persistence": "ephemeral"}


def test_health_does_not_claim_unmounted_persistent_storage(client, monkeypatch):
    monkeypatch.setattr(main, "STORAGE_MODE", "persistent")
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["persistence"] == "unverified"
