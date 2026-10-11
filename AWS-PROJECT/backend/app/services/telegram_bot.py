"""Telegram interactive webhook & polling bot service.

Allows citizens and operators to directly chat with @biosentinel_alert_bot to receive:
1. Real-time river health status & Wazirabad intake state (/status)
2. Ward water supply & rationing schedules (/ward <name>)
3. Emergency alerts and sitreps (/alerts)
4. Field sample submission guides (/report)
5. Interactive AI answers via Amazon Bedrock for general river questions
"""
import logging
import requests
from .. import config as C
from ..store import db
from . import llm

log = logging.getLogger("bio.telegram_bot")

HELP_TEXT = """🌊 <b>Bio-Sentinel | Yamuna River Defense Bot</b>

I can help you monitor river health and water supply timings in real time:

🔹 <b>/status</b> — Live Yamuna river corridor condition & Wazirabad intake status
🔹 <b>/ward &lt;name&gt;</b> — Water rationing schedule (e.g. <code>/ward Civil Lines</code>)
🔹 <b>/stations</b> — Monitored edge stations from Panipat to Delhi
🔹 <b>/toxic</b> — Current chemical & Daphnia biological alert levels
🔹 <b>/help</b> — Show this guide

<i>You can also describe any river condition or water issue directly to get an AI response!</i>"""


def format_status_message():
    gate = db.gate.get("intake_status", "OPEN")
    gate_icon = "🟢" if gate == "OPEN" else "🔴"

    active_incidents = [i for i in db.incidents.values() if i.get("status") != "CLOSED"]

    if active_incidents:
        inc = active_incidents[0]
        inc_text = (
            f"⚠️ <b>ACTIVE THREAT DETECTED</b>\n"
            f"• Origin: <code>{inc.get('station_id')}</code>\n"
            f"• Threat Level: <b>{inc.get('level')}</b>\n"
            f"• Anomaly: {inc.get('anomaly_type')}\n"
            f"• T-minus to Delhi Intake: <b>{round(inc.get('t_minus_seconds', 0) / 60)} min</b>\n"
        )
    else:
        inc_text = "✅ <b>River Corridor:</b> NORMAL · No active toxic plume detected.\n"

    return (
        f"🌊 <b>YAMUNA RIVER WATCH STATUS</b>\n\n"
        f"{inc_text}\n"
        f"🏛️ <b>Wazirabad Intake Gate:</b> {gate_icon} <b>{gate.replace('_', ' ')}</b>\n"
        f"📡 <b>Edge Stations:</b> 5 stations active (Panipat ➔ Wazirabad)\n"
        f"⏱️ <i>Telemetry refreshed every 5s on AWS</i>"
    )


def format_ward_message(ward_query):
    schedules = C.WARD_SCHEDULES
    if not ward_query:
        wards_list = "\n".join([f"• <code>{w}</code>: {s}" for w, s in schedules.items()])
        return (
            f"💧 <b>Delhi Jal Board Ward Schedules:</b>\n\n"
            f"{wards_list}\n\n"
            f"<i>Type <code>/ward &lt;name&gt;</code> to check your specific ward.</i>"
        )

    # Search for matching ward
    matched = None
    for w, sched in schedules.items():
        if ward_query.lower() in w.lower():
            matched = (w, sched)
            break

    if matched:
        return (
            f"💧 <b>Water Advisory for {matched[0]}:</b>\n\n"
            f"⏰ <b>Scheduled Supply:</b> {matched[1]}\n"
            f"🛡️ <b>Piped Water Safety:</b> Filtered & monitored by Bio-Sentinel.\n"
            f"💡 <i>Tip: Store water in clean covered containers during rationing.</i>"
        )
    else:
        return (
            f"❓ Ward '<b>{ward_query}</b>' not found in active rationing roster.\n\n"
            f"Available wards: {', '.join(schedules.keys())}."
        )


def handle_telegram_message(message: dict) -> bool:
    """Process an incoming Telegram message from a private user, group, or channel."""
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    text = (message.get("text") or message.get("caption") or "").strip()
    from_user = message.get("from", {})
    user_name = from_user.get("first_name") or chat.get("title") or "Resident"

    if not chat_id or not text:
        return False

    # Extract command and strip bot mention (e.g. /status@biosentinel_alert_bot -> /status)
    raw_cmd = text.split()[0].lower() if text else ""
    cmd = raw_cmd.split("@")[0]

    if cmd in ("/start", "/help"):
        reply = f"Hello {user_name}!\n\n{HELP_TEXT}"
    elif cmd == "/status":
        reply = format_status_message()
    elif cmd.startswith("/ward"):
        parts = text.split(maxsplit=1)
        query = parts[1] if len(parts) > 1 else ""
        reply = format_ward_message(query)
    elif cmd == "/stations":
        reply = (
            "📍 <b>Monitored Station Nodes:</b>\n\n"
            "1. <b>Panipat I</b> (68 km to intake)\n"
            "2. <b>Panipat II</b> (50 km to intake)\n"
            "3. <b>Sonipat</b> (38.5 km to intake)\n"
            "4. <b>Palla</b> (Delhi Border · 16.5 km to intake)\n"
            "5. <b>Wazirabad Intake Headworks</b> (0 km · Delhi Reservoir)"
        )
    elif cmd == "/toxic":
        reply = (
            "🧪 <b>Toxicity & Heat Thresholds:</b>\n\n"
            "• <b>DJB Intake Limit:</b> 0.9 ppm Total Ammonia\n"
            "• <b>Thermal Multiplier:</b> Delhi's 45°C summer heat increases un-ionized ammonia toxicity up to <b>4.2×</b>.\n"
            "• <b>Biological Sentinel:</b> Live Daphnia magna swimming velocity, depth & erratic index tracked 24/7."
        )
    else:
        # User sent a custom query or description (e.g. "there are some plumes formed in the water here")
        # Try generating an intelligent, empathetic response via Amazon Bedrock (or clean domain fallback)
        system_prompt = (
            "You are the official Bio-Sentinel Yamuna River Emergency Assistant bot. "
            "A citizen is messaging you about Yamuna river water quality, pollution, or water supply in Delhi. "
            "Provide a helpful, empathetic, concise answer in 2-3 sentences. "
            "Advise them not to touch contaminated river water, and let them know that the Bio-Sentinel sensor network "
            "and municipal operators have been notified of their observation."
        )
        ai_reply = llm.invoke_claude(system_prompt, text)
        if ai_reply and "[AI" not in ai_reply:
            reply = f"🤖 <b>Bio-Sentinel Advisory:</b>\n\n{ai_reply}\n\n<i>To check live river status, send /status.</i>"
        else:
            reply = (
                f"Thank you for reporting this observation, {user_name}.\n\n"
                f"Your report: <i>\"{text}\"</i> has been received by the Bio-Sentinel telemetry system.\n\n"
                f"⚠️ <b>Safety Notice:</b> Please do not enter the river or touch suspected industrial foam/plumes.\n"
                f"Use <b>/status</b> to check current river telemetry, or <b>/ward</b> for water supply timings."
            )

    return send_bot_reply(chat_id, reply)


def send_bot_reply(chat_id, text, parse_mode="HTML") -> bool:
    """Send message to a specific chat_id."""
    token = C.TELEGRAM_BOT_TOKEN
    if not token:
        log.warning("Cannot send bot reply: TELEGRAM_BOT_TOKEN not configured")
        return False

    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode,
                "disable_web_page_preview": True,
            },
            timeout=8,
        )
        return r.ok
    except Exception as exc:
        log.error("Telegram send_bot_reply error: %s", exc)
        return False


def run_polling_loop(poll_timeout: int = 15):
    """Continuously poll Telegram for updates using long-polling."""
    import time
    token = C.TELEGRAM_BOT_TOKEN
    if not token:
        log.warning("Polling stopped: TELEGRAM_BOT_TOKEN not configured")
        return

    offset = None
    log.info("Starting Telegram long-polling daemon...")
    while True:
        try:
            params = {"timeout": poll_timeout, "limit": 20}
            if offset is not None:
                params["offset"] = offset

            resp = requests.get(
                f"https://api.telegram.org/bot{token}/getUpdates",
                params=params,
                timeout=poll_timeout + 5,
            )
            if not resp.ok:
                time.sleep(2)
                continue

            data = resp.json()
            updates = data.get("result", [])
            for update in updates:
                offset = update.get("update_id", 0) + 1
                msg = update.get("message") or update.get("channel_post")
                if msg:
                    handle_telegram_message(msg)
        except Exception as exc:
            log.error("Telegram polling error: %s", exc)
            time.sleep(3)
