import secrets
import time
from fastapi import APIRouter, Depends, HTTPException
from .. import config as C
from ..auth import require_operator
from ..schemas import OtpVerifyIn, StopIn, SubscribeIn
from ..services import notify
from ..store import db

router = APIRouter()


def normalize_phone(raw):
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 10:
        return "+91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    raise HTTPException(422, "Enter a valid 10-digit Indian mobile number")


@router.post("/subscribe")
def subscribe(body: SubscribeIn):
    if not body.consent:
        raise HTTPException(400, "Consent is required")
    phone = normalize_phone(body.phone)
    if db.rate_limited(f"otp:{phone}", 3, 3600):
        raise HTTPException(429, "Too many codes requested. Try again later.")
    code = f"{secrets.randbelow(10**6):06d}"
    with db.lock:
        existing = db.subscribers.get(phone, {})
        db.subscribers[phone] = {
            "phone": phone, "ward": body.ward, "language": body.language,
            "alert_types": body.alert_types, "verified": False, "opted_out": False,
            "last_sent_at": existing.get("last_sent_at", 0), "created_at": int(time.time()),
        }
        db.otps[phone] = {"code": code, "expires": time.time() + C.OTP_TTL_S, "attempts": 0}
    notify.send_sms(phone, f"Your Bio-Sentinel code is {code}. It expires in 10 minutes.")
    resp = {"status": "otp_sent", "phone": phone}
    if C.DEV_MODE:
        resp["dev_otp"] = code
    return resp


@router.post("/subscribe/verify")
def verify(body: OtpVerifyIn):
    phone = normalize_phone(body.phone)
    otp = db.otps.get(phone)
    if not otp or time.time() > otp["expires"]:
        raise HTTPException(400, "Code expired. Request a new one.")
    if otp["attempts"] >= C.OTP_MAX_ATTEMPTS:
        raise HTTPException(429, "Too many attempts. Request a new code.")
    otp["attempts"] += 1
    if not secrets.compare_digest(otp["code"], body.code.strip()):
        raise HTTPException(400, "Wrong code")
    db.subscribers[phone]["verified"] = True
    del db.otps[phone]
    return {"status": "subscribed", "phone": phone, "ward": db.subscribers[phone]["ward"]}


@router.post("/subscribe/stop")
def stop(body: StopIn):
    phone = normalize_phone(body.phone)
    sub = db.subscribers.get(phone)
    if sub:
        sub["opted_out"] = True
    return {"status": "unsubscribed"}


@router.get("/subscribers/summary")
def summary(user=Depends(require_operator)):
    counts = {}
    for s in db.subscribers.values():
        if s["verified"] and not s["opted_out"]:
            counts[s["ward"]] = counts.get(s["ward"], 0) + 1
    return {"total": sum(counts.values()), "by_ward": counts}
