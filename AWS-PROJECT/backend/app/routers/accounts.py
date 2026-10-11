"""Email/password sign-in: registration, login, and binding a password to an
operator account. Account records live in DynamoDB (see app/accounts.py);
sessions are stateless signed tokens (see app/sessions.py). These endpoints are
the alternative to Google sign-in so the app is usable without a Google account.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .. import accounts, config as C, sessions, totp
from ..auth import account_identity, current_user, generate_and_send_otp, verify_otp
from ..schemas import EmailOtpIn, EmailOtpVerifyIn, LoginIn, RegisterIn, SetPasswordIn, StaffLoginIn
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


@router.post("/auth/send-otp")
def send_email_otp(body: EmailOtpIn, request: Request):
    """Send an email verification code (OTP) to the given address via configured SMTP."""
    ip = _client_ip(request)
    if db.rate_limited(f"otp-ip:{ip}", 15, 900) or db.rate_limited(f"otp-email:{body.email}", 5, 900):
        raise HTTPException(429, "Too many verification requests. Please wait a few minutes.")
    
    # Check operator/reporter listing in backend (same allowlist & db listing for both)
    if body.role in ("operator", "reporter"):
        is_allowed = (body.email in C.OPERATOR_ALLOWLIST)
        record = accounts.get_user(body.email)
        if not is_allowed and not (record and record.get("role") in ("operator", "reporter")):
            raise HTTPException(403, f"No valid {body.role} email. This email is not registered as an authorized operator or verified reporter.")

    otp_data = generate_and_send_otp(body.email)
    if not otp_data:
        raise HTTPException(500, "Unable to send verification code. Please check your email or server configuration.")
    
    # Store in database/memory store with prefix
    db.put_otp(f"EMAIL#{body.email}", {
        "otp": otp_data["otp"],
        "expires_at": otp_data["expires_at"],
        "attempts": otp_data["attempts"],
        "expires": otp_data["expires_at"],
    })
    return {"ok": True, "message": f"Verification code sent to {body.email}"}


@router.post("/auth/verify-otp")
def verify_email_otp(body: EmailOtpVerifyIn, request: Request):
    """Verify an email verification code (OTP)."""
    ip = _client_ip(request)
    if db.rate_limited(f"otp-vfy-ip:{ip}", 25, 900):
        raise HTTPException(429, "Too many verification attempts. Please wait.")
    
    key = f"EMAIL#{body.email}"
    rec = db.get_otp(key)
    if not rec:
        raise HTTPException(400, "No verification code requested or it has expired.")
    
    ok, msg = verify_otp(rec, body.code)
    if not ok:
        db.put_otp(key, rec)  # update attempts
        raise HTTPException(400, msg)
    
    # Mark email as verified
    db.put_otp(key, {"verified": True, "email": body.email, "expires": rec.get("expires", 0)})
    return {"ok": True, "verified": True, "message": "Email verified successfully!"}


@router.post("/auth/register", status_code=201)
def register(body: RegisterIn, request: Request, response: Response):
    """Create a new member account and sign the user in. Members get the signed-in
    public experience; operator access is never granted by self-registration."""
    if not C.SESSION_SECRET:
        raise HTTPException(503, "Password sign-in is not configured on this server")
    if db.rate_limited(f"register:{_client_ip(request)}", 10, 3600):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    try:
        accounts.create_user(body.email, body.name, body.password, phone=body.phone or "", alt_phone=body.alt_phone or "")
    except accounts.UserExists:
        raise HTTPException(409, "An account with this email already exists")
    token = _mint_or_503(body.email)
    response.headers["Cache-Control"] = "no-store"
    log.info("account registered")
    user_rec = accounts.get_user(body.email)
    return {"token": token, "user": account_identity(user_rec) if user_rec else {"role": "authenticated", "name": body.name, "email": body.email}}


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
    password + a 6-digit TOTP authenticator code or email OTP."""
    if not C.SESSION_SECRET:
        raise HTTPException(503, "Sign-in is not configured on this server")
    ip = _client_ip(request)
    if db.rate_limited(f"staff-ip:{ip}", 20, 900) or db.rate_limited(f"staff:{body.email}", 10, 900):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    
    # Operators and Verified Reporters share the exact same allowlist and backend listing
    is_staff_allowlisted = (body.email in C.OPERATOR_ALLOWLIST)
    record = accounts.get_user(body.email)
    
    if not record and is_staff_allowlisted:
        # Auto-provision allowlisted staff account
        record, _ = accounts.create_staff(body.email, body.email.split("@")[0].title(), body.password, body.role)
    elif record and is_staff_allowlisted and record.get("role") != body.role and body.role in ("operator", "reporter"):
        # Allow allowlisted staff to switch between authorized staff roles
        record["role"] = body.role
        try:
            accounts._table().put_item(Item=record)
        except Exception:
            pass
        accounts._local_users[body.email] = record
        accounts._save_local_users()

    bad = (not record or record.get("role") != body.role
           or not accounts.verify_password(record, body.password))
    if bad:
        raise HTTPException(401, "Incorrect email, password, or authenticator code")
    
    # Check code: either email OTP or TOTP authenticator
    rec_otp = db.get_otp(f"EMAIL#{body.email}")
    email_otp_ok = False
    if rec_otp:
        email_otp_ok, _ = verify_otp(rec_otp, body.code)
    
    totp_ok = totp.verify(record.get("totp_secret"), body.code) if record.get("totp_secret") else False
    
    if not (email_otp_ok or totp_ok):
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
    if user["role"] not in ("operator", "reporter") or not user.get("email") or not str(user.get("id") or "").startswith("google:"):
        raise HTTPException(403, "Sign in with Google as an operator or reporter before setting a password")
    accounts.set_password(user["email"], user["name"], body.password, operator_eligible=True)
    db.log_audit(user["name"], "operator.password_set", {"email": user["email"]}, actor_id=user["id"])
    return {"ok": True, "email": user["email"]}
