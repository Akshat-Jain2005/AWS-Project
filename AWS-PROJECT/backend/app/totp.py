"""RFC 6238 TOTP (time-based one-time passwords) for operator / reporter MFA.

Stdlib only: HMAC-SHA1 over a 30-second counter, 6 digits, with a ±1 step window
to tolerate clock skew. Secrets are base32 — the format authenticator apps expect
— so this is interoperable with Google Authenticator, Authy, 1Password, etc.
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

DIGITS = 6
STEP = 30


def generate_secret(length: int = 20) -> str:
    """A fresh base32 TOTP secret (default 160-bit)."""
    return base64.b32encode(secrets.token_bytes(length)).decode().rstrip("=")


def _code_at(secret: str, counter: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    truncated = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(truncated % (10 ** DIGITS)).zfill(DIGITS)


def now_code(secret: str, now: float | None = None) -> str:
    """The current TOTP code (used by tests and the provisioning CLI)."""
    counter = int((now if now is not None else time.time()) // STEP)
    return _code_at(secret, counter)


def verify(secret: str, code: str, *, window: int = 1, now: float | None = None) -> bool:
    """True when `code` matches the TOTP for `secret` within ±window steps."""
    if not secret or not code:
        return False
    code = str(code).strip().replace(" ", "")
    if len(code) != DIGITS or not code.isdigit():
        return False
    counter = int((now if now is not None else time.time()) // STEP)
    for drift in range(-window, window + 1):
        if hmac.compare_digest(_code_at(secret, counter + drift), code):
            return True
    return False


def provisioning_uri(secret: str, account: str, issuer: str = "Bio-Sentinel") -> str:
    """otpauth:// URI to enrol the secret in an authenticator app."""
    label = quote(f"{issuer}:{account}")
    return (f"otpauth://totp/{label}?secret={secret}"
            f"&issuer={quote(issuer)}&digits={DIGITS}&period={STEP}")
