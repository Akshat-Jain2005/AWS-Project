"""
High-Fidelity Telemetry Dataset Generator for Bio-Sentinel
Ground truth based on Bio-Sentinel Spec (Section 1 & 2):
- Normal Baseline:
    Velocity: 12.0 - 18.0 mm/s (foraging)
    Depth: 70.0 - 90.0 cm (upper photic zone)
    Erratic Index: < 20.0 (smooth sinusoidal)
    Ammonia: 0.1 - 0.45 ppm (safe baseline <= 0.4 ppm)
    pH: 7.2 - 7.6
    Temp: 30.0 - 34.0 C

- Toxic Contamination State (Chemical Cocktail / Industrial Solvent Blind Spot):
    Velocity: Severe lethargy (< 5.0 mm/s) OR erratic panic velocity (> 32.0 mm/s)
    Depth: Rapid benthic drop / sinking (< 20.0 cm)
    Erratic Index: Chaotic turning angles, tight looping, paralysis (> 80.0)
    Ammonia: 0.2 - 0.45 ppm (STILL GREEN - The Sensor Blind Spot!)

- Ammonia Surge Event:
    Ammonia: 1.5 - 5.5 ppm (> 0.9 ppm threshold, spikes > 3.0 ppm)
    Velocity: Initial hyperactivity (20-30 mm/s) transitioning to lethargy (< 7 mm/s)
    Depth: Gradual descent (30 - 55 cm)
    Erratic Index: Moderate to high (40 - 75)
"""

import numpy as np
import pandas as pd
import os

def generate_telemetry_dataset(num_samples=60000, random_seed=42):
    np.random.seed(random_seed)
    
    records = []
    
    # 1. Normal Baseline State (45% of data)
    n_normal = int(num_samples * 0.45)
    for _ in range(n_normal):
        vel = np.random.normal(loc=15.0, scale=1.5)
        vel = np.clip(vel, 11.5, 18.5)
        
        depth = np.random.normal(loc=80.0, scale=4.5)
        depth = np.clip(depth, 68.0, 92.0)
        
        erratic = np.random.exponential(scale=5.0) + 3.0
        erratic = np.clip(erratic, 2.0, 19.5)
        
        ammonia = np.random.uniform(0.15, 0.42)
        ph = np.random.normal(loc=7.4, scale=0.15)
        temp = np.random.normal(loc=31.5, scale=1.5)
        
        records.append({
            "avg_velocity_mms": vel,
            "avg_depth_cm": depth,
            "erratic_index": erratic,
            "ammonia_ppm": ammonia,
            "ph": ph,
            "temperature_c": temp,
            "anomaly_detected": False,
            "threat_level": "NORMAL",
            "anomaly_type": "NORMAL_BASELINE"
        })
        
    # 2. The Sensor Blind Spot: Industrial Toxic Dump (25% of data)
    # Chemical sensors remain green (ammonia <= 0.45 ppm), but biological kinematics collapse!
    n_blind_spot = int(num_samples * 0.25)
    for _ in range(n_blind_spot):
        # 50% panic velocity, 50% lethargy/paralysis
        if np.random.rand() > 0.5:
            vel = np.random.uniform(32.5, 48.0) # Panic velocity
        else:
            vel = np.random.uniform(0.5, 4.8)   # Severe lethargy / dying
            
        depth = np.random.uniform(3.0, 19.5)     # Sunk to chamber bottom
        erratic = np.random.uniform(80.5, 99.5)   # Chaotic loops / spasms
        
        ammonia = np.random.uniform(0.18, 0.44)  # Probes stay green!
        ph = np.random.normal(loc=7.35, scale=0.2)
        temp = np.random.normal(loc=32.0, scale=1.8)
        
        records.append({
            "avg_velocity_mms": vel,
            "avg_depth_cm": depth,
            "erratic_index": erratic,
            "ammonia_ppm": ammonia,
            "ph": ph,
            "temperature_c": temp,
            "anomaly_detected": True,
            "threat_level": "CRITICAL_LEVEL_3",
            "anomaly_type": "BIO_KINEMATIC_COLLAPSE"
        })

    # 3. Night Industrial Effluent Ammonia Surge (18% of data)
    # Severe chemical ammonia spike (> 1.2 ppm up to 5.5 ppm)
    n_ammonia = int(num_samples * 0.18)
    for _ in range(n_ammonia):
        ammonia = np.random.exponential(scale=1.2) + 1.2
        ammonia = np.clip(ammonia, 1.2, 5.8)
        
        # Ammonia causes moderate-to-severe biological distress
        if ammonia > 3.0:
            threat = "CRITICAL_LEVEL_3"
            vel = np.random.uniform(3.0, 8.0)
            depth = np.random.uniform(15.0, 35.0)
            erratic = np.random.uniform(65.0, 88.0)
        else:
            threat = "WARNING_LEVEL_2"
            vel = np.random.uniform(8.0, 11.5)
            depth = np.random.uniform(35.0, 58.0)
            erratic = np.random.uniform(35.0, 65.0)
            
        ph = np.random.normal(loc=7.8, scale=0.3)
        temp = np.random.normal(loc=33.0, scale=2.0)
        
        records.append({
            "avg_velocity_mms": vel,
            "avg_depth_cm": depth,
            "erratic_index": erratic,
            "ammonia_ppm": ammonia,
            "ph": ph,
            "temperature_c": temp,
            "anomaly_detected": True,
            "threat_level": threat,
            "anomaly_type": "AMMONIA_SURGE"
        })

    # 4. Elevated / Transitional Stress State (12% of data)
    # High summer heat, mild runoff, or early plume onset
    n_elevated = num_samples - len(records)
    for _ in range(n_elevated):
        vel = np.random.choice([np.random.uniform(18.5, 24.0), np.random.uniform(9.0, 11.8)])
        depth = np.random.uniform(45.0, 67.0)
        erratic = np.random.uniform(22.0, 48.0)
        ammonia = np.random.uniform(0.45, 0.88)
        ph = np.random.choice([np.random.uniform(6.8, 7.1), np.random.uniform(7.7, 8.2)])
        temp = np.random.uniform(34.0, 39.0) # High thermal stress
        
        records.append({
            "avg_velocity_mms": vel,
            "avg_depth_cm": depth,
            "erratic_index": erratic,
            "ammonia_ppm": ammonia,
            "ph": ph,
            "temperature_c": temp,
            "anomaly_detected": True,
            "threat_level": "ELEVATED_LEVEL_1",
            "anomaly_type": "UNSPECIFIED_TOXIC_PLUME"
        })

    df = pd.DataFrame(records)
    # Shuffle
    df = df.sample(frac=1.0, random_state=random_seed).reset_index(drop=True)
    return df

if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    df = generate_telemetry_dataset(num_samples=60000)
    out_path = os.path.join(out_dir, "bio_telemetry_dataset.csv")
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df):,} telemetry instances successfully -> {out_path}")
    print("\nClass distribution:")
    print(df["threat_level"].value_counts())
    print("\nAnomaly Type distribution:")
    print(df["anomaly_type"].value_counts())
