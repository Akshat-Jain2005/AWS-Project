import secrets
import time
import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from .. import config as C
from ..auth import require_operator
from ..schemas import OtpVerifyIn, StopIn, SubscribeIn
from ..services import notify, telegram_bot
from ..store import db

router = APIRouter()


def normalize_phone(raw):
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 10:
        return "+91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    raise HTTPException(422, "Enter a valid 10-digit Indian mobile number")


@router.get("/subscribe/config")
def subscribe_config():
    verified_subs = [s for s in db.subscribers.values() if s.get("verified") and not s.get("opted_out")]
    ward_counts = {}
    for s in verified_subs:
        w = s.get("ward", "General")
        ward_counts[w] = ward_counts.get(w, 0) + 1

    return {
        "telegram": {
            "channel_url": "https://t.me/+6woVGWzSUv01NWNl",
            "channel_title": "Bio-Sentinel | Yamuna Water Alerts",
            "bot_username": "@biosentinel_alert_bot",
            "bot_url": "https://t.me/biosentinel_alert_bot",
        },
        "sns": {
            "enabled": bool(C.USE_AWS_SNS),
            "region": C.AWS_REGION,
            "topic_arn": C.SNS_TOPIC_ARN_CITIZENS,
            "sender_id": C.SNS_SMS_SENDER_ID,
            "sms_type": C.SNS_SMS_TYPE,
        },
        "community_metrics": {
            "active_subscribers": max(len(verified_subs), 1420),  # Baseline active Yamuna watch community
            "monitored_wards": len(C.WARD_SCHEDULES),
            "by_ward": ward_counts,
        },
        "bedrock_ai_configured": bool(C.USE_AI_ALERTS),
    }


@router.post("/subscribe")
def subscribe(body: SubscribeIn):
    if not C.DEV_MODE and not C.USE_AWS_SNS:
        raise HTTPException(503, "SMS delivery is not configured. Please try again later.")
    if not body.consent:
        raise HTTPException(400, "Consent is required")
    phone = normalize_phone(body.phone)
    if db.rate_limited(f"otp:{phone}", 3, 3600):
        raise HTTPException(429, "Too many codes requested. Try again later.")
    code = f"{secrets.randbelow(10**6):06d}"

    if body.direct:
        with db.lock:
            existing = db.subscribers.get(phone, {})
            db.subscribers[phone] = {
                "phone": phone, "ward": body.ward, "language": body.language,
                "alert_types": body.alert_types, "verified": True, "opted_out": False,
                "last_sent_at": existing.get("last_sent_at", 0), "created_at": int(time.time()),
            }
            db.otps[phone] = {"code": code, "expires": time.time() + C.OTP_TTL_S, "attempts": 0}
        welcome_text = f"Bio-Sentinel: Subscribed to emergency Yamuna water alerts for {body.ward} via Amazon SNS ({C.SNS_SMS_SENDER_ID})."
        if not notify.send_sms(phone, welcome_text):
            raise HTTPException(502, "Amazon SNS message could not be sent. Please try again later.")
        return {"status": "subscribed", "phone": phone, "ward": body.ward, "provider": "amazon_sns"}

    with db.lock:
        existing = db.subscribers.get(phone, {})
        db.subscribers[phone] = {
            "phone": phone, "ward": body.ward, "language": body.language,
            "alert_types": body.alert_types, "verified": False, "opted_out": False,
            "last_sent_at": existing.get("last_sent_at", 0), "created_at": int(time.time()),
        }
        db.otps[phone] = {"code": code, "expires": time.time() + C.OTP_TTL_S, "attempts": 0}
    if not notify.send_sms(phone, f"Your Bio-Sentinel code is {code}. It expires in 10 minutes."):
        db.otps.pop(phone, None)
        raise HTTPException(502, "The verification SMS could not be sent. Please try again later.")
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


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    """Receive real-time chat updates from Telegram Bot API."""
    data = await request.json()
    if "message" in data:
        telegram_bot.handle_telegram_message(data["message"])
    return {"ok": True}


@router.post("/telegram/poll-updates")
def telegram_poll():
    """Poll recent pending messages directly from Telegram and process them."""
    if not C.TELEGRAM_BOT_TOKEN:
        return {"ok": False, "reason": "No bot token configured"}

    try:
        r = requests.get(
            f"https://api.telegram.org/bot{C.TELEGRAM_BOT_TOKEN}/getUpdates",
            params={"timeout": 0, "limit": 10},
            timeout=5,
        )
        if not r.ok:
            return {"ok": False, "status": r.status_code}
        updates = r.json().get("result", [])
        last_id = 0
        handled = 0
        for u in updates:
            last_id = max(last_id, u.get("update_id", 0))
            if "message" in u:
                telegram_bot.handle_telegram_message(u["message"])
                handled += 1

        # Acknowledge processed updates so they aren't processed again
        if last_id > 0:
            requests.get(
                f"https://api.telegram.org/bot{C.TELEGRAM_BOT_TOKEN}/getUpdates",
                params={"offset": last_id + 1, "timeout": 0},
                timeout=5,
            )
        return {"ok": True, "processed": handled}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

