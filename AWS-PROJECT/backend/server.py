"""Compatibility entry point for the supported Bio-Sentinel application.

Use ``uvicorn app.main:app`` for deployment. Older ``uvicorn server:app``
commands resolve to the same routes, authentication and payment verification.
"""
from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
