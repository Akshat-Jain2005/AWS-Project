import hashlib
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
