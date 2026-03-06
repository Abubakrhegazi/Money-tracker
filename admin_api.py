"""
Admin API — All admin endpoints for the Aura admin dashboard.
Mounted on the main FastAPI app at /admin.
"""
import os
import hashlib
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from time import time

import bcrypt
from fastapi import APIRouter, HTTPException, Request, Response, Depends, Cookie, Query
from fastapi.responses import StreamingResponse
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional
import csv
import io

from database import (
    get_all_users_admin, get_user_detail_admin, get_all_transactions_admin,
    get_global_stats, delete_user_data, log_admin_action, get_audit_log,
    create_admin_session, validate_admin_session, revoke_admin_session,
    get_active_admin_sessions, Session, Expense,
)

router = APIRouter()

ADMIN_JWT_SECRET = os.environ["ADMIN_JWT_SECRET"]  # fail fast if missing
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")
SESSION_EXPIRY = int(os.getenv("ADMIN_SESSION_EXPIRY", "1800"))

# ── Rate limiting for login ──────────────────────────────────────────────
_login_attempts: dict[str, list[float]] = defaultdict(list)
LOGIN_MAX = 5
LOGIN_WINDOW = 900  # 15 minutes

def _check_login_rate(ip: str) -> bool:
    now = time()
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < LOGIN_WINDOW]
    if len(_login_attempts[ip]) >= LOGIN_MAX:
        return True
    _login_attempts[ip].append(now)
    return False

# ── Maintenance mode ─────────────────────────────────────────────────────
_maintenance_mode = False

# ── Auth helpers ─────────────────────────────────────────────────────────

def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def _create_admin_jwt(username: str) -> tuple[str, str]:
    """Create access token (short) + refresh token (7 days)."""
    access = jwt.encode(
        {"sub": username, "type": "admin_access", "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        ADMIN_JWT_SECRET, algorithm="HS256"
    )
    refresh = jwt.encode(
        {"sub": username, "type": "admin_refresh", "exp": datetime.now(timezone.utc) + timedelta(days=7)},
        ADMIN_JWT_SECRET, algorithm="HS256"
    )
    return access, refresh

async def get_current_admin(request: Request) -> str:
    """Validate admin JWT from Authorization header or cookie."""
    token = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    if not token:
        token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") not in ("admin_access",):
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Auth endpoints ───────────────────────────────────────────────────────

class LoginBody(BaseModel):
    username: str
    password: str

@router.post("/login")
async def admin_login(body: LoginBody, request: Request, response: Response):
    ip = _get_client_ip(request)

    if _check_login_rate(ip):
        log_admin_action(body.username, "login_rate_limited", ip=ip)
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 15 minutes.")

    if body.username != ADMIN_USERNAME:
        log_admin_action(body.username, "login_failed", ip=ip, details="wrong username")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=500, detail="Admin password not configured")

    if not bcrypt.checkpw(body.password.encode(), ADMIN_PASSWORD_HASH.encode()):
        log_admin_action(body.username, "login_failed", ip=ip, details="wrong password")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access, refresh = _create_admin_jwt(body.username)
    session_token = create_admin_session(body.username, ip=ip, expiry_seconds=SESSION_EXPIRY)

    log_admin_action(body.username, "login_success", ip=ip)

    response.set_cookie(
        key="admin_token", value=access,
        httponly=True, secure=True, samesite="lax", max_age=1800
    )
    response.set_cookie(
        key="admin_refresh", value=refresh,
        httponly=True, secure=True, samesite="lax", max_age=604800  # 7 days
    )

    return {"status": "ok", "token": access, "username": body.username}


@router.post("/refresh")
async def admin_refresh(request: Request, response: Response):
    token = request.cookies.get("admin_refresh")
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "admin_refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        username = payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    access, refresh = _create_admin_jwt(username)
    response.set_cookie(key="admin_token", value=access, httponly=True, secure=True, samesite="lax", max_age=1800)
    response.set_cookie(key="admin_refresh", value=refresh, httponly=True, secure=True, samesite="lax", max_age=604800)

    return {"status": "ok", "token": access}


@router.post("/logout")
async def admin_logout(request: Request, response: Response):
    # Revoke server-side session (not just client cookies)
    token = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    if not token:
        token = request.cookies.get("admin_token")
    if token:
        try:
            payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=["HS256"])
            username = payload.get("sub", "")
            # Revoke all sessions for this admin
            sessions = get_active_admin_sessions()
            for s in sessions:
                if s.get("username") == username:
                    revoke_admin_session(s["id"])
        except JWTError:
            pass  # token already invalid, just clear cookies
    response.delete_cookie("admin_token")
    response.delete_cookie("admin_refresh")
    ip = _get_client_ip(request)
    log_admin_action("admin", "logout", ip=ip)
    return {"status": "ok"}


@router.get("/me")
async def admin_me(admin: str = Depends(get_current_admin)):
    return {"username": admin}


# ── Users ────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    admin: str = Depends(get_current_admin),
):
    return get_all_users_admin(page=page, per_page=per_page, search=search)


@router.get("/users/export")
async def export_users(admin: str = Depends(get_current_admin)):
    data = get_all_users_admin(page=1, per_page=10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["User ID", "Transactions", "Total Spent", "Total Income", "Joined", "Last Active", "Platforms"])
    for u in data["users"]:
        writer.writerow([u["user_id"], u["total_transactions"], u["total_spent"], u["total_income"],
                         u["joined"], u["last_active"], ", ".join(u["platforms"])])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users_export.csv"}
    )


@router.get("/users/{user_id}")
async def user_detail(user_id: str, admin: str = Depends(get_current_admin)):
    detail = get_user_detail_admin(user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="User not found")
    return detail


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request, admin: str = Depends(get_current_admin)):
    ip = _get_client_ip(request)
    success = delete_user_data(user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete user data")
    log_admin_action(admin, "delete_user", target_type="user", target_id=user_id, ip=ip)
    return {"status": "deleted", "user_id": user_id}


# ── Transactions ─────────────────────────────────────────────────────────

@router.get("/transactions")
async def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    entry_type: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    admin: str = Depends(get_current_admin),
):
    df = datetime.fromisoformat(date_from) if date_from else None
    dt = datetime.fromisoformat(date_to) if date_to else None
    return get_all_transactions_admin(
        page=page, per_page=per_page, entry_type=entry_type,
        category=category, user_id=user_id, search=search,
        date_from=df, date_to=dt
    )


@router.get("/transactions/export")
async def export_transactions(admin: str = Depends(get_current_admin)):
    data = get_all_transactions_admin(page=1, per_page=50000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "User", "Type", "Amount", "Currency", "Category", "Merchant", "Date", "Transcript"])
    for t in data["transactions"]:
        writer.writerow([t["id"], t["user_id"], t["entry_type"], t["amount"], t["currency"],
                         t["category"], t["merchant"], t["created_at"], t["transcript"]])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions_export.csv"}
    )


# ── Stats ────────────────────────────────────────────────────────────────

@router.get("/stats")
async def stats_overview(
    days: int = Query(30, ge=1, le=365),
    admin: str = Depends(get_current_admin),
):
    return get_global_stats(days=days)


# ── Audit Log ────────────────────────────────────────────────────────────

@router.get("/audit-log")
async def audit_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    admin: str = Depends(get_current_admin),
):
    return get_audit_log(page=page, per_page=per_page)


# ── Settings ─────────────────────────────────────────────────────────────

class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str

@router.post("/settings/password")
async def change_password(body: ChangePasswordBody, request: Request, admin: str = Depends(get_current_admin)):
    if not bcrypt.checkpw(body.current_password.encode(), ADMIN_PASSWORD_HASH.encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    ip = _get_client_ip(request)
    log_admin_action(admin, "change_password", ip=ip, details="Password updated")
    # Never return the hash in the response — log it server-side only
    print(f"[ADMIN] New password hash (update ADMIN_PASSWORD_HASH env var): {new_hash}")
    return {"status": "ok", "note": "Password updated. Check server logs for the new hash to update your env var."}


@router.get("/settings/sessions")
async def list_sessions(admin: str = Depends(get_current_admin)):
    return get_active_admin_sessions()


@router.delete("/settings/sessions/{session_id}")
async def revoke_session(session_id: int, request: Request, admin: str = Depends(get_current_admin)):
    ip = _get_client_ip(request)
    success = revoke_admin_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    log_admin_action(admin, "revoke_session", target_type="session", target_id=session_id, ip=ip)
    return {"status": "revoked"}


@router.post("/settings/maintenance")
async def toggle_maintenance(request: Request, admin: str = Depends(get_current_admin)):
    global _maintenance_mode
    _maintenance_mode = not _maintenance_mode
    ip = _get_client_ip(request)
    log_admin_action(admin, "toggle_maintenance", ip=ip, details=f"maintenance={'on' if _maintenance_mode else 'off'}")
    return {"maintenance": _maintenance_mode}


@router.get("/settings/maintenance")
async def get_maintenance(admin: str = Depends(get_current_admin)):
    return {"maintenance": _maintenance_mode}


@router.get("/settings/env")
async def env_config(admin: str = Depends(get_current_admin)):
    """Show which env vars are set — never expose any values."""
    keys = [
        "DATABASE_URL", "GROQ_API_KEY", "TELEGRAM_BOT_TOKEN",
        "META_WHATSAPP_TOKEN", "META_PHONE_NUMBER_ID", "META_VERIFY_TOKEN",
        "JWT_SECRET", "ADMIN_JWT_SECRET", "ADMIN_USERNAME",
        "DASHBOARD_URL", "PORT",
    ]
    return [{
        "key": k,
        "set": bool(os.getenv(k)),
        "value": "✅ set" if os.getenv(k) else "❌ not set",
    } for k in keys]
