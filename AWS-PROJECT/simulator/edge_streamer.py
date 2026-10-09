"""
Bio-Sentinel Edge Streamer / Hardware Simulator
Specification: Bio-Sentinel Spec Page 2 & Page 5

Modes:
  --mode normal       : Simulates baseline healthy Daphnia magna foraging (every 3s)
  --mode inject_toxin : Simulates the Sensor Blind Spot: safe chemical probes with acute biological kinematic collapse
"""

import time
import argparse
import random
import requests
import sys

DEFAULT_API_URL = "http://localhost:8000/telemetry"

def generate_telemetry(mode: str, station_id: str = "STATION_02_PANIPAT") -> dict:
    timestamp = int(time.time())
    
    if mode == "normal":
        # Baseline healthy state (Page 1)
        velocity = round(random.uniform(13.5, 17.0), 1)     # Steady foraging (12.0 - 18.0 mm/s)
        depth = round(random.uniform(75.0, 88.0), 1)        # Upper photic zone (70 - 90 cm)
        erratic = round(random.uniform(8.0, 16.5), 1)       # Smooth sinusoidal (< 20.0)
        ammonia = round(random.uniform(0.25, 0.40), 2)      # Safe baseline (<= 0.4 ppm)
        ph = round(random.uniform(7.28, 7.42), 2)
        temp = round(random.uniform(31.8, 32.5), 1)
    elif mode == "inject_toxin":
        # The Sensor Blind Spot: Synthetic toxic dye / neurotoxin dump (Page 1 & 5)
        # Chemical probes remain safe/green, but water fleas suffer kinematic collapse!
        velocity = round(random.choice([random.uniform(33.0, 42.0), random.uniform(1.2, 4.5)]), 1) # Panic or lethargy
        depth = round(random.uniform(8.0, 18.5), 1)         # Sunk to chamber floor (< 20 cm)
        erratic = round(random.uniform(82.0, 96.0), 1)      # Chaotic spasms (> 80.0)
        ammonia = round(random.uniform(0.32, 0.41), 2)      # GREEN SENSOR! Blind spot active!
        ph = round(random.uniform(7.30, 7.45), 2)
        temp = round(random.uniform(32.0, 32.8), 1)
    else:
        raise ValueError(f"Unknown mode: {mode}")

    payload = {
        "station_id": station_id,
        "timestamp": timestamp,
        "chemical": {
            "ammonia_ppm": ammonia,
            "ph": ph,
            "temperature_c": temp
        },
        "biological": {
            "avg_velocity_mms": velocity,
            "avg_depth_cm": depth,
            "erratic_index": erratic
        }
    }
    return payload

def stream(mode: str, api_url: str, interval_sec: float = 3.0, station_id: str = "STATION_02_PANIPAT"):
    print("=" * 65)
    print(f"BIO-SENTINEL EDGE STREAMER - Active Mode: [{mode.upper()}]")
    print(f"Station: {station_id} | Interval: {interval_sec}s | Target: {api_url}")
    print("=" * 65)
    
    iteration = 1
    while True:
        payload = generate_telemetry(mode, station_id)
        
        bio = payload["biological"]
        chem = payload["chemical"]
        
        status_tag = "[HEALTHY FORAGING]" if mode == "normal" else "[! CRITICAL TOXIN INJECTED !]"
        print(f"\n#{iteration:03d} {status_tag} @ {time.strftime('%H:%M:%S')}")
        print(f"   Chemical : Ammonia={chem['ammonia_ppm']} ppm | pH={chem['ph']} | Temp={chem['temperature_c']} C")
        print(f"   Biological: Velocity={bio['avg_velocity_mms']} mm/s | Depth={bio['avg_depth_cm']} cm | Erratic={bio['erratic_index']}")

        # Attempt sending to backend API if available
        try:
            res = requests.post(api_url, json=payload, timeout=2.0)
            if res.status_code == 200:
                data = res.json()
                print(f"   => Backend Classification: Anomaly={data.get('anomaly_detected')} | Threat={data.get('threat_level')} | Type={data.get('anomaly_type')}")
                fc = data.get("arrival_forecast", {})
                if fc:
                    print(f"      Plume Forecast: T-Minus {fc.get('estimated_hours_to_wazirabad')}h to Wazirabad | Est Intake Ammonia: {fc.get('predicted_intake_ammonia_ppm')} ppm")
            else:
                print(f"   (Backend returned HTTP {res.status_code})")
        except requests.exceptions.RequestException:
            print("   (Local backend offline - telemetry printed to console)")
            
        iteration += 1
        time.sleep(interval_sec)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bio-Sentinel Daphnia Kinematics Edge Streamer")
    parser.add_argument("--mode", type=str, choices=["normal", "inject_toxin"], default="normal",
                        help="Telemetry mode: 'normal' or 'inject_toxin'")
    parser.add_argument("--api-url", type=str, default=DEFAULT_API_URL, help="Target API endpoint")
    parser.add_argument("--interval", type=float, default=3.0, help="Transmission interval in seconds")
    parser.add_argument("--station", type=str, default="STATION_02_PANIPAT", help="Station ID")
    
    args = parser.parse_args()
    try:
        stream(args.mode, args.api_url, args.interval, args.station)
    except KeyboardInterrupt:
        print("\nEdge Streamer stopped by user.")
        sys.exit(0)
