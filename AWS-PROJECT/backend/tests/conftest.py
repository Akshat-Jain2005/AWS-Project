import os
import sys

os.environ["DEV_MODE"] = "1"
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import db

OP1 = {"Authorization": "Bearer dev-operator-1"}
OP2 = {"Authorization": "Bearer dev-operator-2"}
REPORTER = {"Authorization": "Bearer dev-reporter"}


@pytest.fixture(autouse=True)
def fresh_store():
    db.reset()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def telemetry(station="STATION_02_PANIPAT", toxic=False):
    bio = ({"avg_velocity_mms": 38.0, "avg_depth_cm": 12.0, "erratic_index": 90.0} if toxic
           else {"avg_velocity_mms": 15.0, "avg_depth_cm": 80.0, "erratic_index": 10.0})
    return {"station_id": station, "timestamp": 1728412800,
            "chemical": {"ammonia_ppm": 0.36, "ph": 7.4, "temperature_c": 32.0}, "biological": bio}


def subscribe_and_verify(client, phone="9876543210", ward="Civil Lines", language="en"):
    r = client.post("/subscribe", json={"phone": phone, "ward": ward, "language": language, "consent": True})
    code = r.json()["dev_otp"]
    return client.post("/subscribe/verify", json={"phone": phone, "code": code})
