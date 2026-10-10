from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import config as C
from .routers import monitoring, operator, payments, reports, subscribers, toxicity

app = FastAPI(
    title="Bio-Sentinel API",
    description="Daphnia biomonitoring, field reports, alerts and relief funding",
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware, allow_origins=C.CORS_ORIGINS, allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)
for r in (monitoring, reports, subscribers, payments, operator, toxicity):
    app.include_router(r.router)


@app.get("/")
def health():
    return {"service": "Bio-Sentinel Core Engine", "status": "ONLINE", "version": "2.0.0"}
