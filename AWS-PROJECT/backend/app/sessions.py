"""Stateless session tokens for email/password sign-in.

Format: ``bst1.<payload>.<sig>`` where ``payload`` is base64url(JSON) and ``sig``
is base64url(HMAC-SHA256(secret, "bst1." + payload)). The ``bst1.`` prefix keeps
these tokens distinct from Google ID tokens (also dotted) so ``auth`` can route
on the prefix. The token carries only the account's email (``sub``) and an
expiry — never the role. The caller's role is recomputed from the live account
on every request, so changing the operator allowlist or an account flag takes
effect immediately and no stale role is ever frozen into a token.
"""
import base64
import hashlib
import hmac
import json
import time

from . import config as C

PREFIX = "bst1"


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def is_session_token(token: str) -> bool:
    return bool(token) and token.startswith(PREFIX + ".")


def mint(sub: str, *, ttl: int | None = None):
    """Return a signed token for ``sub`` (an email), or None if signing is not
    configured (no SESSION_SECRET)."""
    if not C.SESSION_SECRET:
        return None
    now = int(time.time())
    payload = {"sub": sub, "iat": now, "exp": now + int(ttl or C.SESSION_TTL_S)}
    body = PREFIX + "." + _b64e(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(C.SESSION_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return body + "." + _b64e(sig)


def verify(token: str):
    """Return the token's payload dict when the signature is valid and the token
    has not expired, else None. Never raises on malformed input."""
    if not C.SESSION_SECRET or not is_session_token(token):
        return None
    try:
        body, sig = token.rsplit(".", 1)
        expected = hmac.new(C.SESSION_SECRET.encode(), body.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64d(sig), expected):
            return None
        payload = json.loads(_b64d(body.split(".", 1)[1]))
    except Exception:
        return None
    if not isinstance(payload.get("sub"), str) or not payload["sub"]:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload
