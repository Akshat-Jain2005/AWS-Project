import hashlib
import hmac
import logging
import secrets
import time
from fastapi import Depends, Header, HTTPException
from . import config as C


def _short(token):
    return hashlib.sha256(token.encode()).hexdigest()[:8]


def current_user(authorization: str = Header(default="")):
    if authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        if token in C.OPERATOR_TOKENS:
            return {"role": "operator", "name": C.OPERATOR_TOKENS[token], "id": _short(token)}
        if token in C.REPORTER_TOKENS:
            return {"role": "reporter", "name": C.REPORTER_TOKENS[token], "id": _short(token)}
    return {"role": "public", "name": "anonymous", "id": None}


def require_operator(user=Depends(current_user)):
    if user["role"] == "public":
        raise HTTPException(401, "Login required")
    if user["role"] != "operator":
        raise HTTPException(403, "Operator access only")
    return user


logger = logging.getLogger(__name__)


def generate_and_send_otp(email):
    from .services.alerts import send_email

    otp = f"{secrets.randbelow(1_000_000):06d}"
    body = (
        f"Your Bio-Sentinel verification code is: {otp}\n\n"
        f"This code expires in {C.OTP_TTL_S // 60} minutes.\n\n"
        "Best regards,\n"
        "The Bio-Sentinel Team\n"
        "Secure. Reliable. Protected."
    )
    if not send_email(email, "Your Bio-Sentinel verification code", body):
        logger.error("OTP dispatch failed for %s", email)
        return None
    logger.info("OTP issued for %s", email)
    return {"otp": otp, "expires_at": time.time() + C.OTP_TTL_S, "attempts": 0}


def verify_otp(stored_record, input_otp):
    if not stored_record or not stored_record.get("otp"):
        return False, "No OTP requested"
    if time.time() > stored_record.get("expires_at", 0):
        return False, "OTP expired"
    if stored_record.get("attempts", 0) >= C.OTP_MAX_ATTEMPTS:
        return False, "Maximum attempts exceeded"

    stored_record["attempts"] = stored_record.get("attempts", 0) + 1
    if hmac.compare_digest(str(stored_record["otp"]), (input_otp or "").strip()):
        stored_record["otp"] = None
        stored_record["expires_at"] = 0
        return True, "OTP verified"

    remaining = C.OTP_MAX_ATTEMPTS - stored_record["attempts"]
    if remaining <= 0:
        return False, "Maximum attempts exceeded"
    return False, f"Invalid OTP ({remaining} attempts remaining)"
