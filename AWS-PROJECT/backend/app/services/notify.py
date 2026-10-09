"""Delivery channels. Console provider for local work: messages go to db.outbox.
Swap send_sms for Amazon SNS / End User Messaging and send_email for SES at deploy time."""
import logging
import requests
from .. import config as C
from ..store import db

log = logging.getLogger("bio.notify")


def send_sms(phone, text):
    db.outbox.append({"channel": "sms", "to": phone, "text": text})
    log.info("SMS to %s: %s", phone, text)
    return True


def send_telegram(text):
    db.outbox.append({"channel": "telegram", "to": C.TELEGRAM_CHAT_ID or "console", "text": text})
    if not (C.TELEGRAM_BOT_TOKEN and C.TELEGRAM_CHAT_ID):
        log.info("Telegram (console): %s", text)
        return True
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{C.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": C.TELEGRAM_CHAT_ID, "text": text},
            timeout=5,
        )
        return r.ok
    except requests.RequestException:
        return False


def send_email(to, subject, body):
    db.outbox.append({"channel": "email", "to": to, "subject": subject, "text": body})
    log.info("Email to %s: %s", to, subject)
    return True
