"""GitHub OAuth router (SPEC §6.3, AC1.8, AC1.9, AC5.7, AC5.10).

Endpoints:
- GET /api/auth/github/login    → 302 to GitHub authorize
- GET /api/auth/github/callback → exchange code, allowlist check, set session
- POST /api/auth/logout         → clears session cookie
- GET /api/auth/me              → current admin info

Session cookie semantics: HttpOnly + SameSite=Lax + Secure (set in main.py
via Starlette SessionMiddleware).
"""

from __future__ import annotations

import logging
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse, RedirectResponse

from aglaea.config import HTTPX_DEFAULT_TIMEOUT_SECONDS, get_settings
from aglaea.db import get_session
from aglaea.security.auth import enforce_admin_allowlist, find_active_admin

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger(__name__)

GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN = "https://github.com/login/oauth/access_token"  # noqa: S105 — OAuth endpoint URL, not a secret
GITHUB_USER = "https://api.github.com/user"
OAUTH_STATE_KEY = "oauth_state"
SESSION_USER_KEY = "admin_user"


@router.get("/github/login")
async def github_login(request: Request) -> RedirectResponse:
    settings = get_settings()
    if not settings.github_oauth_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OAuth not configured",
        )
    state = secrets.token_urlsafe(32)
    request.session[OAUTH_STATE_KEY] = state
    params = {
        "client_id": settings.github_oauth_client_id,
        "redirect_uri": settings.github_oauth_redirect_uri,
        "scope": "read:user",
        "state": state,
    }
    qs = urlencode(params)
    return RedirectResponse(url=f"{GITHUB_AUTHORIZE}?{qs}")


@router.get("/github/callback")
async def github_callback(
    request: Request,
    code: str,
    state: str,
    session: AsyncSession = Depends(get_session),
) -> RedirectResponse:
    settings = get_settings()
    expected = request.session.get(OAUTH_STATE_KEY)
    if not expected or not secrets.compare_digest(expected, state):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid state")
    request.session.pop(OAUTH_STATE_KEY, None)

    async with httpx.AsyncClient(timeout=HTTPX_DEFAULT_TIMEOUT_SECONDS) as client:
        token_response = await client.post(
            GITHUB_TOKEN,
            data={
                "client_id": settings.github_oauth_client_id,
                "client_secret": settings.github_oauth_client_secret,
                "code": code,
                "redirect_uri": settings.github_oauth_redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        if token_response.status_code >= 400:
            log.warning(
                "auth.github.token_exchange_failed",
                extra={"status": token_response.status_code},
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="token exchange failed"
            )
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="no access_token")

        user_response = await client.get(
            GITHUB_USER,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        if user_response.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="user fetch failed")
        user_data = user_response.json()

    github_login_value = str(user_data.get("login", "")).strip()
    github_id_raw = user_data.get("id")
    if not github_login_value or not isinstance(github_id_raw, int):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="invalid user payload")

    ip = request.client.host if request.client else None
    admin = await enforce_admin_allowlist(
        session,
        github_login=github_login_value,
        github_id=github_id_raw,
        ip=ip,
    )
    await session.commit()

    request.session[SESSION_USER_KEY] = {
        "id": admin.id,
        "github_login": admin.github_login,
    }
    return RedirectResponse(url="/admin")


@router.post("/logout")
async def logout(request: Request) -> JSONResponse:
    request.session.pop(SESSION_USER_KEY, None)
    return JSONResponse({"ok": True})


@router.get("/me")
async def me(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> JSONResponse:
    payload = request.session.get(SESSION_USER_KEY)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not signed in")
    login = payload.get("github_login")
    admin = await find_active_admin(session, github_login=login) if login else None
    if admin is None:
        request.session.pop(SESSION_USER_KEY, None)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not authorized")
    return JSONResponse(
        {
            "id": admin.id,
            "github_login": admin.github_login,
            "last_login_at": admin.last_login_at.isoformat() if admin.last_login_at else None,
        }
    )
