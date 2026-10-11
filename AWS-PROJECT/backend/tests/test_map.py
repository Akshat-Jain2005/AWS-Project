"""The public /status feed carries station coordinates so the map marker can be
placed by both the public dashboard and the operator console."""


def test_status_includes_station_coords(client):
    stations = client.get("/status").json()["stations"]
    assert stations and all("coords" in s for s in stations)
    panipat = next((s for s in stations if s["station_id"] == "STATION_01_PANIPAT"), None)
    assert panipat is not None
    assert panipat["coords"] == [29.43, 76.97]  # from config.STATION_COORDS


def test_map_config_is_public_and_hides_the_key(client):
    body = client.get("/map-config").json()
    assert set(body) == {"region", "style", "style_url"}
    assert "key" not in str(body).lower()
