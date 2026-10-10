from app.services import toxicity
from conftest import OP1, REPORTER, telemetry


def hot(temp, ammonia=0.8, ph=8.4):
    t = telemetry()
    t["chemical"] = {"ammonia_ppm": ammonia, "ph": ph, "temperature_c": temp}
    return t


def test_formula_matches_published_values():
    assert abs(toxicity.unionized_fraction(7.0, 20) - 0.0040) < 0.0003   # ~0.40 % at 20 C, pH 7
    assert abs(toxicity.unionized_fraction(7.0, 25) - 0.0056) < 0.0003   # ~0.56 % at 25 C, pH 7


def test_heat_and_ph_raise_toxicity():
    assert toxicity.unionized_fraction(7.4, 45) > toxicity.unionized_fraction(7.4, 25)
    assert toxicity.unionized_fraction(8.4, 30) > toxicity.unionized_fraction(7.4, 30)
    a = toxicity.assess(0.9, 7.4, 45)
    assert 3.3 < a["heat_multiplier_vs_25c"] < 3.9


def test_assess_endpoint_and_heat_curve(client):
    r = client.get("/toxicity/assess", params={"ammonia_ppm": 0.9, "ph": 7.4, "temp_c": 45}).json()
    assert r["unionized_ammonia_mgl"] > 0.04
    assert client.get("/toxicity/assess", params={"ammonia_ppm": 0.9, "ph": 20, "temp_c": 45}).status_code == 422
    pts = client.get("/toxicity/heat-curve", params={"ammonia_ppm": 0.9, "ph": 7.4}).json()["points"]
    values = [p["unionized_ammonia_mgl"] for p in pts]
    assert values == sorted(values) and len(values) == 8


def test_heatwave_opens_incident_even_though_total_ammonia_is_under_limit(client):
    r = client.post("/telemetry", json=hot(44.0, ammonia=0.8, ph=8.4))
    assert r.json()["toxicity"]["band"] == "DANGEROUS"
    assert r.json()["incident_id"]
    inc = client.get("/incidents", headers=OP1).json()[0]
    assert inc["anomaly_type"] in {"HEAT_AMMONIA_TOXICITY", "BIO_KINEMATIC_COLLAPSE", "AMMONIA_SURGE"}


def test_same_ammonia_in_cool_water_is_safe(client):
    r = client.post("/telemetry", json=hot(22.0, ammonia=0.8, ph=7.4))
    assert r.json()["toxicity"]["band"] == "SAFE"
    assert client.get("/incidents", headers=OP1).json() == []


def test_public_status_shows_toxicity_band(client):
    client.post("/telemetry", json=hot(44.0, ammonia=0.8, ph=8.4))
    row = [s for s in client.get("/status").json()["stations"] if s["station_id"] == "STATION_02_PANIPAT"][0]
    assert row["toxicity_band"] == "DANGEROUS" and row["unionized_ammonia_mgl"] > 0.2


def test_field_report_uses_heat_adjusted_severity(client):
    base = {"lat": 29.40, "lng": 76.98, "source_type": "river", "ammonia_ppm": 0.8, "ph": 8.4}
    cool = client.post("/reports", json={**base, "temperature_c": 20}, headers=REPORTER).json()
    warm = client.post("/reports", json={**base, "temperature_c": 44}, headers=REPORTER).json()
    assert cool["severity"] != "red" and warm["severity"] == "red"
