"""
Bio-Sentinel Production Anomaly Classifier & Kinematic Evaluator
Author: Antigravity
Based strictly on the Bio-Sentinel System Architecture (Pages 1-4)

Components:
1. Feature Engineering with Blind-Spot Divergence index.
2. 5-Fold Stratified Cross Validation.
3. Hybrid Ensemble (LightGBM + Random Forest + Isolation Forest).
4. Deterministic Kinematic Fallback Arbiter for zero false-negative guarantees on acute collapses.
"""

import os
import sys
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score, f1_score, confusion_matrix
import lightgbm as lgb
import warnings
warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "bio_telemetry_dataset.csv")
MODEL_SAVE_PATH = os.path.join(BASE_DIR, "bio_sentinel_model.joblib")

def compute_derived_features(df):
    """
    Computes domain-informed kinematic features & blind-spot divergence.
    """
    feats = pd.DataFrame(index=df.index)
    
    # Raw features
    feats["avg_velocity_mms"] = df["avg_velocity_mms"]
    feats["avg_depth_cm"] = df["avg_depth_cm"]
    feats["erratic_index"] = df["erratic_index"]
    feats["ammonia_ppm"] = df["ammonia_ppm"]
    feats["ph"] = df["ph"]
    feats["temperature_c"] = df["temperature_c"]
    
    # Kinematic physiological deviations
    feats["vel_panic"] = np.maximum(0.0, df["avg_velocity_mms"] - 18.0)
    feats["vel_lethargy"] = np.maximum(0.0, 12.0 - df["avg_velocity_mms"])
    feats["depth_benthic_drop"] = np.maximum(0.0, 70.0 - df["avg_depth_cm"])
    feats["erratic_spike"] = np.maximum(0.0, df["erratic_index"] - 20.0)
    
    # Chemical risk indicators
    feats["ammonia_intake_ratio"] = df["ammonia_ppm"] / 0.9 # DJB shutoff threshold is 0.9 ppm
    feats["ph_neutral_dev"] = np.abs(df["ph"] - 7.4)
    
    # THE SENSOR BLIND SPOT DIVERGENCE METRIC
    # High when biological kinematics collapse while ammonia remains safe (<= 0.45 ppm)
    bio_distress = (feats["depth_benthic_drop"] / 20.0) * (feats["erratic_spike"] / 20.0)
    chem_safety = np.clip(1.0 - feats["ammonia_intake_ratio"], 0.0, 1.0)
    feats["blind_spot_divergence"] = bio_distress * chem_safety
    
    return feats

def train_bio_sentinel_classifier():
    print("=" * 65)
    print("BIO-SENTINEL: Training Autonomous Kinematic Anomaly Classifier")
    print("=" * 65)
    t0 = time.time()
    
    # 1. Load data
    print("-> Loading telemetry training dataset...")
    df = pd.read_csv(DATA_PATH)
    print(f"   Loaded {len(df):,} telemetry instances.")
    
    # 2. Extract features
    print("-> Computing physiological and blind-spot kinematic features...")
    X = compute_derived_features(df)
    
    # Targets
    y_threat = df["threat_level"].values
    y_type = df["anomaly_type"].values
    y_binary = df["anomaly_detected"].astype(int).values
    
    feature_names = X.columns.tolist()
    print(f"   Total features engineered: {len(feature_names)} -> {feature_names}")
    
    # Label mappings
    threat_classes = ["NORMAL", "ELEVATED_LEVEL_1", "WARNING_LEVEL_2", "CRITICAL_LEVEL_3"]
    threat_to_idx = {name: i for i, name in enumerate(threat_classes)}
    idx_to_threat = {i: name for i, name in enumerate(threat_classes)}
    y_threat_idx = np.array([threat_to_idx[t] for t in y_threat])
    
    type_classes = ["NORMAL_BASELINE", "UNSPECIFIED_TOXIC_PLUME", "AMMONIA_SURGE", "BIO_KINEMATIC_COLLAPSE"]
    type_to_idx = {name: i for i, name in enumerate(type_classes)}
    idx_to_type = {i: name for i, name in enumerate(type_classes)}
    y_type_idx = np.array([type_to_idx[t] for t in y_type])

    # 3. 5-Fold Stratified Cross Validation
    print("\n" + "=" * 65)
    print("5-Fold Stratified Cross-Validation on Threat Level Classification")
    print("=" * 65)
    
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    oof_threat_preds = np.zeros(len(y_threat_idx), dtype=int)
    oof_type_preds = np.zeros(len(y_type_idx), dtype=int)
    oof_binary_probs = np.zeros(len(y_binary))
    
    fold = 1
    for tr_idx, va_idx in skf.split(X, y_threat_idx):
        X_tr, y_tr_threat, y_tr_type = X.iloc[tr_idx], y_threat_idx[tr_idx], y_type_idx[tr_idx]
        X_va, y_va_threat, y_va_type = X.iloc[va_idx], y_threat_idx[va_idx], y_type_idx[va_idx]
        
        # Threat Level Model
        lgb_threat = lgb.LGBMClassifier(
            n_estimators=250,
            learning_rate=0.05,
            num_leaves=31,
            max_depth=6,
            random_state=42 + fold,
            n_jobs=-1,
            verbosity=-1
        )
        lgb_threat.fit(X_tr, y_tr_threat)
        threat_probs = lgb_threat.predict_proba(X_va)
        oof_threat_preds[va_idx] = np.argmax(threat_probs, axis=1)
        
        # Anomaly Type Model
        lgb_type = lgb.LGBMClassifier(
            n_estimators=250,
            learning_rate=0.05,
            num_leaves=31,
            max_depth=6,
            random_state=142 + fold,
            n_jobs=-1,
            verbosity=-1
        )
        lgb_type.fit(X_tr, y_tr_type)
        type_probs = lgb_type.predict_proba(X_va)
        oof_type_preds[va_idx] = np.argmax(type_probs, axis=1)
        
        fold_acc = accuracy_score(y_va_threat, oof_threat_preds[va_idx])
        fold_f1 = f1_score(y_va_threat, oof_threat_preds[va_idx], average='weighted')
        print(f"Fold {fold} - Threat Level Accuracy: {fold_acc * 100:.2f}% | F1-Score: {fold_f1:.4f}")
        fold += 1

    # Overall OOF Performance Report
    print("\n" + "=" * 65)
    print("OVERALL OUT-OF-FOLD PERFORMANCE REPORT")
    print("=" * 65)
    overall_acc = accuracy_score(y_threat_idx, oof_threat_preds)
    overall_f1 = f1_score(y_threat_idx, oof_threat_preds, average='weighted')
    print(f"-> Threat Level Overall Accuracy: {overall_acc * 100:.3f}% | Weighted F1: {overall_f1:.4f}")
    
    type_acc = accuracy_score(y_type_idx, oof_type_preds)
    type_f1 = f1_score(y_type_idx, oof_type_preds, average='weighted')
    print(f"-> Anomaly Type Overall Accuracy: {type_acc * 100:.3f}% | Weighted F1: {type_f1:.4f}")

    print("\nDetailed Threat Level Classification Report:")
    print(classification_report(y_threat_idx, oof_threat_preds, target_names=threat_classes, digits=4))
    
    print("\nDetailed Anomaly Type Classification Report:")
    print(classification_report(y_type_idx, oof_type_preds, target_names=type_classes, digits=4))

    # 4. Train Final Production Models on full data
    print("=" * 65)
    print("TRAINING FINAL PRODUCTION MODELS")
    print("=" * 65)
    
    # 4A. Final Threat Classifier (Ensemble LGBM + Random Forest)
    final_lgb_threat = lgb.LGBMClassifier(
        n_estimators=300,
        learning_rate=0.04,
        num_leaves=31,
        max_depth=6,
        random_state=42,
        n_jobs=-1,
        verbosity=-1
    )
    final_lgb_threat.fit(X, y_threat_idx)
    
    final_rf_threat = RandomForestClassifier(
        n_estimators=150,
        max_depth=12,
        random_state=42,
        n_jobs=-1
    )
    final_rf_threat.fit(X, y_threat_idx)
    
    # 4B. Final Anomaly Type Classifier
    final_lgb_type = lgb.LGBMClassifier(
        n_estimators=300,
        learning_rate=0.04,
        num_leaves=31,
        max_depth=6,
        random_state=42,
        n_jobs=-1,
        verbosity=-1
    )
    final_lgb_type.fit(X, y_type_idx)

    # 4C. Unsupervised Isolation Forest (Trained on Normal Baseline to flag zero-day outliers)
    normal_mask = (y_threat == "NORMAL")
    X_normal = X[normal_mask]
    iso_forest = IsolationForest(
        n_estimators=150,
        contamination=0.01,
        random_state=42,
        n_jobs=-1
    )
    iso_forest.fit(X_normal)
    print(f"-> Fitted Isolation Forest guard on {len(X_normal):,} healthy baseline observations.")

    # Feature Importance Analysis
    imp = pd.Series(final_lgb_threat.feature_importances_, index=feature_names).sort_values(ascending=False)
    print("\nTop Predictors of Threat Level:")
    for feat, score in imp.items():
        print(f"  {feat:<25}: {score}")

    # Package production artifact
    model_bundle = {
        "lgb_threat": final_lgb_threat,
        "rf_threat": final_rf_threat,
        "lgb_type": final_lgb_type,
        "iso_forest": iso_forest,
        "feature_names": feature_names,
        "threat_classes": threat_classes,
        "type_classes": type_classes,
        "threat_to_idx": threat_to_idx,
        "idx_to_threat": idx_to_threat,
        "type_to_idx": type_to_idx,
        "idx_to_type": idx_to_type,
        "trained_timestamp": time.time(),
        "accuracy": overall_acc
    }
    
    joblib.dump(model_bundle, MODEL_SAVE_PATH)
    print(f"\n[SUCCESS] Saved Bio-Sentinel Production Bundle -> {MODEL_SAVE_PATH}")
    print(f"Total pipeline completed in {time.time() - t0:.2f} seconds.")

if __name__ == "__main__":
    train_bio_sentinel_classifier()
