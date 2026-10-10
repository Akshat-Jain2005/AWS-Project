import os
from pathlib import Path

# Load backend/.env so TELEGRAM_* / SNS_* / AWS_REGION are available locally.
# override=False keeps any variable already set in the environment (e.g. tests
# that pin DEV_MODE / USE_AWS_SNS) authoritative over the .env file.
try:
    from dotenv import load_dotenv

    load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env", override=False)
except ImportError:  # python-dotenv optional; env vars may be provided externally
    pass


def _tokens(name, default):
    out = {}
    for part in os.getenv(name, default).split(","):
        if ":" in part:
            token, who = part.split(":", 1)
            out[token.strip()] = who.strip()
    return out


DEV_MODE = os.getenv("DEV_MODE", "0") == "1"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]

# Local stand-in for Cognito. Replace with JWT verification at deploy time.
OPERATOR_TOKENS = _tokens("OPERATOR_TOKENS", "dev-operator-1:Operator One,dev-operator-2:Operator Two")
REPORTER_TOKENS = _tokens("REPORTER_TOKENS", "dev-reporter:Verified Reporter")
SENSOR_API_KEY = os.getenv("SENSOR_API_KEY", "")

# Amazon SNS – set USE_AWS_SNS=1 and provide topic ARNs to enable live delivery.
# When disabled (default), all messages remain in the in-memory outbox only.
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
USE_AWS_SNS = os.getenv("USE_AWS_SNS", "0") == "1"
SNS_TOPIC_ARN_OPERATORS = os.getenv("SNS_TOPIC_ARN_OPERATORS", "")
SNS_TOPIC_ARN_CITIZENS = os.getenv("SNS_TOPIC_ARN_CITIZENS", "")
SNS_SMS_SENDER_ID = os.getenv("SNS_SMS_SENDER_ID", "BIOSNT")
SNS_SMS_TYPE = os.getenv("SNS_SMS_TYPE", "Transactional")

# Amazon Bedrock – generative alert copy. Disabled by default (USE_AI_ALERTS=0)
# so tests and local runs never reach the network; alert services fall back to
# the static templates. Model id defaults to GLM 5 (provider Z.AI) in Bedrock.
BEDROCK_REGION = os.getenv("BEDROCK_REGION", "ap-southeast-2")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "zai.glm-5")
USE_AI_ALERTS = os.getenv("USE_AI_ALERTS", "0") == "1"

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
# Dashboard webhook secret. Falls back to RAZORPAY_KEY_SECRET when unset so the
# webhook still verifies before a dedicated secret is configured.
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
DEV_RAZORPAY_SECRET = "dev_razorpay_secret"  # used only when real keys are not set

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

CLUSTER_MIN_WEIGHT = 3.0       # weighted bad reports needed to raise an incident
CLUSTER_RADIUS_KM = 2.0
CLUSTER_WINDOW_S = 3600
STATION_ATTACH_RADIUS_KM = 10.0
AUTOCLOSE_NORMAL_READINGS = 5
TWO_PERSON_THRESHOLD = 5000
SMS_COOLDOWN_S = 1800
DEFICIT_MGD = 110

# Heat-aware ammonia toxicity. Starting values, calibrate against a source you cite.
UIA_WATCH_MGL = float(os.getenv("UIA_WATCH_MGL", "0.02"))
UIA_DANGER_MGL = float(os.getenv("UIA_DANGER_MGL", "0.20"))
DEFAULT_WATER_TEMP_C = float(os.getenv("DEFAULT_WATER_TEMP_C", "30"))
OTP_TTL_S = 600
OTP_MAX_ATTEMPTS = 5

# Approximate coordinates. Replace with your real station locations.
STATION_COORDS = {
    "STATION_01_PANIPAT": (29.43, 76.97),
    "STATION_02_PANIPAT": (29.39, 76.97),
    "STATION_03_SONIPAT": (28.99, 77.02),
    "STATION_04_PALLA": (28.83, 77.20),
    "STATION_05_WAZIRABAD": (28.71, 77.23),
}

# Sample rationing config. Replace with real schedules.
WARD_SCHEDULES = {
    "Civil Lines": "6-9 AM and 5-8 PM",
    "Karol Bagh": "7-10 AM and 6-9 PM",
    "Sangam Vihar": "tanker supply 8 AM-12 PM",
    "Kusumpur Pahadi": "tanker supply 8 AM-12 PM",
}

CAMPAIGNS = {
    "upkeep": {"title": "Bio-Sentinel Node Upkeep Fund", "tiers": [199, 1999]},
    "relief": {"title": "Emergency Clean Water Relief Fund", "tiers": [499, 2499]},
}

ALLOWED_OBSERVATIONS = {"dark_color", "foam", "sharp_smell", "dead_fish", "oil_sheen", "clear"}
BAD_OBSERVATIONS = {"dark_color", "foam", "sharp_smell", "dead_fish", "oil_sheen"}
