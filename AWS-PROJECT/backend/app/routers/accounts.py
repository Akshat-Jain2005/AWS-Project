"""Email/password sign-in: registration, login, and binding a password to an
operator account. Account records live in DynamoDB (see app/accounts.py);
sessions are stateless signed tokens (see app/sessions.py). These endpoints are
the alternative to Google sign-in so the app is usable without a Google account.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .. import accounts, config as C, sessions, totp
from ..auth import account_identity, current_user
from ..schemas import LoginIn, RegisterIn, SetPasswordIn, StaffLoginIn
from ..store import db

router = APIRouter()
log = logging.getLogger("bio.accounts")


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _mint_or_503(email: str) -> str:
    token = sessions.mint(email)
    if not token:  # SESSION_SECRET not configured
        raise HTTPException(503, "Password sign-in is not configured on this server")
    return token


@router.post("/auth/register", status_code=201)
def register(body: RegisterIn, request: Request, response: Response):
    """Create a new member account and sign the user in. Members get the signed-in
    public experience; operator access is never granted by self-registration."""
    if not C.SESSION_SECRET:
        raise HTTPException(503, "Password sign-in is not configured on this server")
    if db.rate_limited(f"register:{_client_ip(request)}", 10, 3600):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    try:
        accounts.create_user(body.email, body.name, body.password)
    except accounts.UserExists:
        raise HTTPException(409, "An account with this email already exists")
    token = _mint_or_503(body.email)
    response.headers["Cache-Control"] = "no-store"
    log.info("account registered")
    return {"token": token, "user": account_identity(accounts.get_user(body.email))}


@router.post("/auth/login")
def login(body: LoginIn, request: Request, response: Response):
    """Verify email + password and return a session token. The error is identical
    for an unknown email and a wrong password so accounts cannot be enumerated."""
    ip = _client_ip(request)
    if db.rate_limited(f"login-ip:{ip}", 20, 900) or db.rate_limited(f"login:{body.email}", 10, 900):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    record = accounts.get_user(body.email)
    if not record or not accounts.verify_password(record, body.password):
        raise HTTPException(401, "Incorrect email or password")
    if record.get("role") in ("operator", "reporter"):
        # Staff accounts must use the MFA sign-in; never issue them a session here.
        raise HTTPException(403, "This account uses the operator & reporter sign-in with an authenticator code")
    token = _mint_or_503(body.email)
    response.headers["Cache-Control"] = "no-store"
    return {"token": token, "user": account_identity(record)}


@router.post("/auth/staff-login")
def staff_login(body: StaffLoginIn, request: Request, response: Response):
    """Invite-only sign-in for operators and verified reporters: work email +
    password + a 6-digit TOTP authenticator code. The error is identical for a
    wrong email, password, role, or code so nothing can be probed. Accounts are
    provisioned out of band (see provision_staff.py); there is no self-service."""
    if not C.SESSION_SECRET:
        raise HTTPException(503, "Sign-in is not configured on this server")
    ip = _client_ip(request)
    if db.rate_limited(f"staff-ip:{ip}", 20, 900) or db.rate_limited(f"staff:{body.email}", 10, 900):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    record = accounts.get_user(body.email)
    bad = (not record or record.get("role") != body.role
           or not accounts.verify_password(record, body.password)
           or not totp.verify(record.get("totp_secret"), body.code))
    if bad:
        raise HTTPException(401, "Incorrect email, password, or authenticator code")
    token = _mint_or_503(body.email)
    response.headers["Cache-Control"] = "no-store"
    log.info("staff sign-in: %s", body.role)
    return {"token": token, "user": account_identity(record)}


@router.post("/auth/set-password")
def set_password(body: SetPasswordIn, user=Depends(current_user)):
    """Bind a password to the caller's operator account so they can later sign in
    with email + password and still receive operator access. Only an operator
    verified through Google may do this — it is what proves ownership of the
    allowlisted email, closing the gap that self-registration would otherwise
    leave open."""
    if user["role"] != "operator" or not user.get("email") or not str(user.get("id") or "").startswith("google:"):
        raise HTTPException(403, "Sign in with Google as an operator before setting a password")
    accounts.set_password(user["email"], user["name"], body.password, operator_eligible=True)
    db.log_audit(user["name"], "operator.password_set", {"email": user["email"]}, actor_id=user["id"])
    return {"ok": True, "email": user["email"]}
