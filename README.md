<div align="center">

# 🛡️ Bio-Sentinel

### *The river won't warn you. We will.*

**A living early-warning system for the Yamuna: Daphnia magna biosensors + machine learning + human-in-the-loop water-supply defense.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-CloudFront-0284c7?style=for-the-badge)](https://d1lidy5nyd64my.cloudfront.net/)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![LightGBM](https://img.shields.io/badge/LightGBM-classifier-brightgreen?style=flat-square)
![AWS](https://img.shields.io/badge/AWS-EC2%20%7C%20DynamoDB%20%7C%20SNS%20%7C%20Bedrock%20%7C%20Location-FF9900?style=flat-square&logo=amazonaws&logoColor=white)

🌐 **Live site:** <https://d1lidy5nyd64my.cloudfront.net/>

*Built for the AWS Environmental Hackathon 2026, theme: Heat & Water.*

</div>

---

## Table of Contents

1. [Overview](#1-overview)
2. [The Problem: The Sensor Blind Spot](#2-the-problem-the-sensor-blind-spot)
3. [How Bio-Sentinel Works](#3-how-bio-sentinel-works)
4. [Feature Catalogue](#4-feature-catalogue)
5. [System Architecture](#5-system-architecture)
6. [Monitored Corridor & Stations](#6-monitored-corridor--stations)
7. [Machine Learning Pipeline](#7-machine-learning-pipeline)
8. [Heat-Aware Ammonia Toxicity](#8-heat-aware-ammonia-toxicity)
9. [Incident Engine](#9-incident-engine)
10. [Roles, Authentication & Security](#10-roles-authentication--security)
11. [Alerting & Notifications](#11-alerting--notifications)
12. [Crowdfunding & Payments](#12-crowdfunding--payments)
13. [Repository Structure](#13-repository-structure)
14. [Tech Stack](#14-tech-stack)
15. [Getting Started (Local Development)](#15-getting-started-local-development)
16. [Configuration Reference](#16-configuration-reference)
17. [API Reference](#17-api-reference)
18. [Data Contracts](#18-data-contracts)
19. [DynamoDB Data Model](#19-dynamodb-data-model)
20. [Edge Simulator](#20-edge-simulator)
21. [Testing](#21-testing)
22. [Deployment on AWS](#22-deployment-on-aws)
23. [Frontend Guide](#23-frontend-guide)
24. [Known Limitations & Notes](#24-known-limitations--notes)
25. [Roadmap](#25-roadmap)
26. [Contributing](#26-contributing)
27. [License & Acknowledgements](#27-license--acknowledgements)

---

## 1. Overview

**Bio-Sentinel** protects Delhi's drinking-water supply from upstream industrial pollution in the Yamuna River.

Edge units placed along the river between **Panipat and Wazirabad** watch a small chamber of live ***Daphnia magna*** (water fleas) with a camera. Each tick the unit extracts three behavioural signals (swim **velocity**, **depth** and an **erratic-motion index**) and posts them, together with conventional chemical probe readings (ammonia, pH, temperature), to the Bio-Sentinel cloud API.

The backend runs an ML ensemble to decide whether the fleas are behaving normally, computes **how many hours a contamination plume has before it reaches the Wazirabad intake**, opens an **incident**, and notifies operators. A human operator then decides whether to close or divert the intake gates. The public gets a live dashboard, SMS/Telegram alerts, a field-reporting channel, a heat-aware toxicity calculator, and a donation flow to fund sensor upkeep and emergency clean water.

| | |
|---|---|
| **Live URL** | <https://d1lidy5nyd64my.cloudfront.net/> |
| **Backend** | FastAPI on EC2 behind Nginx; an optional Lambda/Mangum package also exists |
| **Frontend** | React 19 + Vite 8 + Tailwind CSS 4 + MapLibre GL |
| **ML** | LightGBM classifiers + engineered kinematic features, with a deterministic safety arbiter |
| **Cloud** | DynamoDB, SNS, Bedrock, Amazon Location Service, S3, SSM, CloudFront |

---

## 2. The Problem: The Sensor Blind Spot

Water treatment intakes rely on **chemical probes** (e.g. an ammonia limit of **0.9 ppm** at the Delhi Jal Board intake). Probes only detect what they are built to detect. A dump of an unknown dye, solvent or "chemical cocktail" can leave ammonia, pH and temperature looking perfectly green while still being lethal.

When intakes have to shut, Delhi faces a drinking-water deficit of roughly **110 MGD** and entire wards go onto rationing.

Living organisms do not have that blind spot. *Daphnia magna* react to **any** toxin class by changing how they swim: they sink, spasm, loop or freeze. Bio-Sentinel turns that behaviour into a machine-readable alarm that fires **hours before** the plume reaches the intake, which is time for operators to act and for citizens to be warned.

> **Blind-spot divergence** is a core engineered feature: it is high exactly when biological kinematics collapse **while ammonia still looks safe**.

---

## 3. How Bio-Sentinel Works

```
 Daphnia chamber ──► Camera tracks speed, depth, erratic turns
        │
        ▼
  Edge unit (station)  ── JSON telemetry (chem + bio) ──►  POST /telemetry
                                                                │
                              ┌─────────────────────────────────┤
                              ▼                                 ▼
                   ML classifier + safety          Heat-aware un-ionized
                   arbiter → threat level          ammonia toxicity band
                              │                                 │
                              └──────────────┬──────────────────┘
                                             ▼
                             Plume arrival forecast (T-minus to Wazirabad)
                                             ▼
                                   Incident engine (open / escalate / auto-close)
                                             ▼
                  Telegram SITREP to operators  +  SNS  +  Operator console
                                             ▼
           Operator decision: SHUTDOWN / DIVERT_BYPASS / RESTORE  (audited, hash-chained)
                                             ▼
          Ward SMS / Telegram rationing notices  +  switch to emergency relief fundraising
```

**From one flea to one decision.**

---

## 4. Feature Catalogue

### 🔬 Detection & Forecasting
- Real-time telemetry ingest from edge stations with optional **sensor API-key** protection.
- Two ML heads: **threat level** (`NORMAL → ELEVATED_LEVEL_1 → WARNING_LEVEL_2 → CRITICAL_LEVEL_3`) and **anomaly type** (`NORMAL_BASELINE`, `UNSPECIFIED_TOXIC_PLUME`, `AMMONIA_SURGE`, `BIO_KINEMATIC_COLLAPSE`).
- **Deterministic physiological override** for acute events so a model miss cannot suppress a critical alert.
- **Plume arrival forecast**: river speed, distance, estimated hours to Wazirabad, and projected intake ammonia (total and un-ionized).
- Public **heat-aware toxicity assessor** and heat-curve endpoint.

### 🚨 Incident Management
- Automatic incident creation from sensors **and** from clustered citizen field reports.
- Confidence labelling: `SENSOR_ALERT`, `UNVERIFIED_SEND_INSPECTOR`, `CONFIRMED` (sensor + reports).
- Live **T-minus countdown** to plume arrival.
- Auto-close after 5 consecutive normal readings; manual close by operators.

### 🕹️ Operator Console
- Corridor map and station watch for all stations.
- **Intake gate control**: `SHUTDOWN`, `DIVERT_BYPASS`, `RESTORE` with mandatory rationale.
- Alert composer with **two-person approval** for large broadcasts.
- Field-report review queue (approve / reject).
- **Hash-chained, append-only audit log**.
- Automation rules toggles (Telegram on incident, SMS on shutdown, all-clear on restore).

### 🌍 Public & Community
- Public **Yamuna Water Watch** dashboard (status, stations, rationing schedules, deficit).
- **River-health GeoJSON** overlay on an Amazon Location Service map.
- **Citizen subscriptions** for ward-level SMS (OTP-verified, consent-gated, STOP supported) in English / Hindi / both.
- **Telegram bot** (`/status`, `/ward <name>`, `/stations`, `/toxic`, `/help`) with AI answers via Bedrock.
- **Field reporting** with GPS, readings, observation tags and optional photo upload to S3.
- **Donation checkout** (Razorpay and UPI QR) with campaign progress and donor wall.
- 3D interactive model of the biomonitor hardware (`<model-viewer>`).

### 🤖 Generative AI (opt-in)
- Amazon Bedrock writes **operator SITREPs** and **bilingual ward SMS**, always with safe fallbacks to static templates, so a model outage can never block an emergency alert.

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                               CLIENTS                                    │
│  Citizens (web / Telegram / SMS)   Operators & Reporters   Edge Stations │
└───────────────┬───────────────────────────┬─────────────────────┬────────┘
                │ HTTPS                     │ HTTPS               │ HTTPS POST
                ▼                           ▼                     ▼
        ┌────────────────────────────────────────────────────────────┐
        │  Amazon CloudFront  (React SPA + same-origin API routing)  │
        └───────────────────────────────┬────────────────────────────┘
                                        ▼
        ┌────────────────────────────────────────────────────────────┐
        │  FastAPI app (Nginx → Uvicorn on EC2)         │
        │  routers: monitoring · reports · subscribers · payments ·  │
        │           operator · toxicity · accounts                   │
        │  services: incidents · alerts · notify · llm · payments ·  │
        │            toxicity · telegram_bot · photos · audit        │
        │  ML: bio_sentinel_inference.py + bio_sentinel_model.joblib │
        └──┬──────────┬───────────┬────────────┬───────────┬─────────┘
           ▼          ▼           ▼            ▼           ▼
      DynamoDB      SNS       Bedrock    Location Svc     S3
     (accounts)  (SMS/topics) (alert AI)  (map tiles)  (report photos)
                      │
                      ▼
               Telegram Bot API · Razorpay · Gmail SMTP (OTP e-mail)
```

**Design notes**

- The Amazon Location API key **never reaches the browser**. The backend proxies the style descriptor and vector tiles, injecting the key server-side and scrubbing any residual `?key=` from the descriptor.
- All third-party delivery (SNS, Bedrock, Razorpay, Telegram) is **opt-in and disabled by default**; with it off, messages go to an in-memory outbox so local runs and tests never touch the network.
- Session tokens are stateless and carry **no role**: the role is recomputed from the live account on each request.

---

## 6. Monitored Corridor & Stations

Five stations are defined along the Yamuna threat corridor, in hydrological order. Distances are to the **Wazirabad DJB intake**.

| Station ID | Name | Distance to intake | Approx. lat, lng |
|---|---|---:|---|
| `STATION_01_PANIPAT` | Panipat Upstream Drain Outfall | 68.0 km | 29.43, 76.97 |
| `STATION_02_PANIPAT` | Panipat Industrial Outfall | 18.5 km ¹ | 29.39, 76.97 |
| `STATION_03_SONIPAT` | Sonipat Industrial Cluster | 38.5 km | 28.99, 77.02 |
| `STATION_04_PALLA` | Palla Delhi-Haryana Entry Point | 16.5 km | 28.83, 77.20 |
| `STATION_05_WAZIRABAD` | Wazirabad DJB Intake Reservoir | 0 km | 28.71, 77.23 |

> ¹ This is the configured forecast distance, not a verified geographic measurement. The dashboard and Telegram station list now use the backend metadata instead of a conflicting hard-coded 50 km label.

Station coordinates are **approximate placeholders**: replace `STATION_COORDS` in `backend/app/config.py` with real deployment locations.

**Plume forecast:** `estimated_hours = distance_km / river_velocity_kmh`, using a typical dry-season Yamuna flow of **2.2 km/h**.

---

## 7. Machine Learning Pipeline

### 7.1 Dataset
- `backend/bio_telemetry_dataset.csv`: **60,000** synthetic telemetry rows.
- Generated by `backend/generate_telemetry_dataset.py` (seed `42`) from the physiological ground truth below.

| State | Velocity (mm/s) | Depth (cm) | Erratic index | Ammonia (ppm) |
|---|---|---|---|---|
| **Normal baseline** (≈45% of data) | 12–18 (foraging) | 70–90 | < 20 | 0.1–0.45 |
| **Toxic "blind-spot" plume** | < 5 (lethargy) **or** > 32 (panic) | < 20 | > 80 | 0.2–0.45 *(still "green")* |
| **Ammonia surge** | 20–30 → < 7 | 30–55 | 40–75 | 1.5–5.5 (spikes > 3.0) |

### 7.2 Engineered features (13)

| Feature | Meaning |
|---|---|
| `avg_velocity_mms`, `avg_depth_cm`, `erratic_index` | Raw biological signals |
| `ammonia_ppm`, `ph`, `temperature_c` | Raw chemical signals |
| `vel_panic` | `max(0, velocity − 18)` |
| `vel_lethargy` | `max(0, 12 − velocity)` |
| `depth_benthic_drop` | `max(0, 70 − depth)`: sinking toward the chamber floor |
| `erratic_spike` | `max(0, erratic − 20)` |
| `ammonia_intake_ratio` | `ammonia / 0.9` (DJB intake limit) |
| `ph_neutral_dev` | `\|pH − 7.4\|` |
| `blind_spot_divergence` | `(depth_drop/20 · erratic_spike/20) · clip(1 − ammonia_ratio, 0, 1)` |

### 7.3 Training (`train_bio_sentinel_model.py`)
- **5-fold stratified cross-validation** reporting accuracy, weighted F1 and full classification reports for both heads.
- Final production bundle contains LightGBM classifiers (`lgb_threat`, `lgb_type`) alongside additional ensemble members (Random Forest, Isolation Forest fitted on healthy baseline observations), the ordered `feature_names`, and class-index maps.
- Output artifact: `backend/bio_sentinel_model.joblib` (~8 MB, committed).

### 7.4 Inference (`bio_sentinel_inference.py`)
1. Build the 13-feature row from the payload.
2. LightGBM predicts **threat level** and **anomaly type**.
3. **Deterministic safety arbiter** overrides the model for acute events:

| Condition | Forced outcome |
|---|---|
| `depth < 20` **and** (`velocity < 5` **or** `velocity > 32`) **and** `erratic > 80` | `CRITICAL_LEVEL_3` / `BIO_KINEMATIC_COLLAPSE` |
| `ammonia > 3.0 ppm` | `CRITICAL_LEVEL_3` / `AMMONIA_SURGE` |

4. Attach the **arrival forecast** (river velocity, distance, hours to Wazirabad, predicted intake ammonia).

### 7.5 Retrain
```bash
cd AWS-PROJECT/backend
python generate_telemetry_dataset.py      # optional: regenerate the CSV
python train_bio_sentinel_model.py        # writes bio_sentinel_model.joblib
```

> ⚠️ **Data caveat:** the training set is **synthetic**, derived from published/spec'd Daphnia behaviour, not from field recordings. Treat reported metrics as in-distribution results; validation against real-world telemetry is future work.

---

## 8. Heat-Aware Ammonia Toxicity

Total ammonia is not what harms aquatic life or intake processes: **un-ionized ammonia (NH₃)** is, and its fraction rises sharply with **temperature** and **pH**. A reading that is "legal" at 25 °C can be dangerous in a hot, alkaline river, which is the *Heat & Water* link of this project.

```
pKa  = 0.09018 + 2729.92 / (T°C + 273.15)
f    = 1 / (10^(pKa − pH) + 1)          # un-ionized fraction
UIA  = total_ammonia_ppm × f             # mg/L
```

| Band | Threshold (configurable) |
|---|---|
| `SAFE` | UIA < `UIA_WATCH_MGL` (default **0.02** mg/L) |
| `ELEVATED` | UIA ≥ 0.02 mg/L |
| `DANGEROUS` | UIA ≥ `UIA_DANGER_MGL` (default **0.20** mg/L) |

- A `DANGEROUS` band opens a `WARNING_LEVEL_2` incident of type `HEAT_AMMONIA_TOXICITY` **even if total ammonia is under the legal limit**.
- The assessment also returns `heat_multiplier_vs_25c`.
- Public endpoints: `GET /toxicity/assess` and `GET /toxicity/heat-curve` (feeds the *Toxicity Simulator* view).
- Thresholds are **starting values**: calibrate them against a source you cite before operational use.

---

## 9. Incident Engine

| Parameter | Value | Config key |
|---|---|---|
| Weighted bad reports to raise an incident | 3.0 | `CLUSTER_MIN_WEIGHT` |
| Report clustering radius | 2.0 km | `CLUSTER_RADIUS_KM` |
| Report clustering window | 3600 s | `CLUSTER_WINDOW_S` |
| Attach-to-station radius | 10 km | `STATION_ATTACH_RADIUS_KM` |
| Normal readings to auto-close | 5 | `AUTOCLOSE_NORMAL_READINGS` |
| Deficit when intake is shut | 110 MGD | `DEFICIT_MGD` |

**Sensor path:** telemetry with `threat_level ≥ WARNING_LEVEL_2` (or a `DANGEROUS` toxicity band) opens or escalates an incident at that station. An operator Telegram SITREP and an SNS operator notification are sent when an incident is first created (if the rule is enabled).

**Field-report path:** each report is scored `green / amber / red` from ammonia, heat-aware un-ionized ammonia, pH range and observation tags (`dark_color`, `foam`, `sharp_smell`, `dead_fish`, `oil_sheen`). `red` reports are clustered; **verified reporters count 1.0, citizens 0.5**. When the weighted total reaches 3.0 within 2 km / 1 hour, a `FIELD_REPORT_CLUSTER` incident is raised at the nearest station.

**Confidence:** `SENSOR_ALERT` (sensor only) · `UNVERIFIED_SEND_INSPECTOR` (reports only) · `CONFIRMED` (both).

**Lifecycle:** `OPEN → ACKNOWLEDGED` (on gate action) `→ CLOSED` (manual or auto).

**Overall public status:** `NORMAL` → `WATCH` (any open incident or non-normal station) → `ALERT` (intake not open, or any level-3 incident).

---

## 10. Roles, Authentication & Security

### Roles

| Role | How obtained | Capabilities |
|---|---|---|
| `public` | No credentials | Public status, reports (rate-limited), toxicity calculator, map |
| `authenticated` (citizen) | Email/password registration, email OTP or Google | Public dashboard, donations, subscribing |
| `reporter` | Invite-only staff account + MFA | Submit **verified** reports (weight 1.0); operator-endpoint read access |
| `operator` | Allowlisted Google account, or invite-only staff account + MFA | Everything: gate control, alerts, approvals, audit, rules |

### Sign-in methods
- **Google Identity Services**: the ID token is verified against `GOOGLE_CLIENT_ID`. Operator access requires `email_verified`, an authoritative domain (`gmail.com` or a matching Workspace `hd` claim) **and** an entry in `OPERATOR_ALLOWLIST` (exact email, or `@domain` entries).
- **Email + password**: PBKDF2-HMAC-SHA256 with per-user salt, constant-time comparison, stored preferentially in DynamoDB, with a local JSON fallback on storage errors.
- **Staff login** (`/auth/staff-login`): work email + password + **TOTP authenticator code or email OTP**.
- **Invite-only provisioning**: `python provision_staff.py operator ops@example.com "Jane"` prints the TOTP secret and `otpauth://` URI once.
- **DEV_MODE tokens**: `dev-operator-1`, `dev-operator-2`, `dev-reporter` (accepted **only** when `DEV_MODE=1`).

### Security controls
- Stateless HMAC-signed session tokens (`bst1.<payload>.<sig>`), default TTL 7 days; password sign-in **fails closed** if `SESSION_SECRET` is unset outside DEV_MODE.
- Role is **never stored in the token**; allowlist or flag changes apply immediately.
- OTPs: 6 digits, 10-minute TTL, max 5 attempts, constant-time compare.
- IP- and identity-based **rate limiting** on logins, reports, photo uploads and OTP requests.
- **Two-person rule**: alerts to more than 5,000 recipients require approval by a *different* operator.
- **Hash-chained audit log** (SHA-256 over seq, id, timestamp, actor, action, detail and previous hash) with `verify_chain()`; no update/delete method exists.
- Payment signatures verified with **HMAC-SHA256**; audit entry written on failure.
- Photo uploads via private S3 bucket with validated keys; browser token kept in `sessionStorage` (tab-scoped), with the legacy `localStorage` token retired.
- Maps API key kept server-side (see [Architecture](#5-system-architecture)).
- Telegram HTML from the LLM is sanitised; document-level markup is rejected and the static template is used instead.

---

## 11. Alerting & Notifications

| Channel | Implementation | Enabled by |
|---|---|---|
| **SMS** (citizens) | Amazon SNS direct publish, sender ID `BIOSNT`, transactional | `USE_AWS_SNS=1` |
| **SNS topics** | Operator topic and citizen topic | `SNS_TOPIC_ARN_OPERATORS` / `_CITIZENS` |
| **Telegram** | Bot API: operator SITREPs, ward notices, interactive bot | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| **Email** | Gmail SMTP (OTP delivery) | `GMAIL_SENDER`, `GMAIL_APP_PASSWORD` |
| **Generative copy** | Bedrock Converse API (default model `zai.glm-5`) | `USE_AI_ALERTS=1` |

**Alert kinds:** `rationing`, `all_clear`, `custom`.

- **SMS cooldown:** one SMS per subscriber per 30 minutes.
- **Bilingual:** English, Hindi or both per subscriber preference.
- **Opt-out:** `POST /subscribe/stop` (and STOP replies).
- **Automation rules** (operator-editable): `operator_telegram_on_incident`, `sms_on_shutdown`, `all_clear_on_restore`.
- A gate `SHUTDOWN`/`DIVERT_BYPASS` auto-acknowledges open incidents and (if enabled) sends a rationing alert to all configured wards; `RESTORE` sends an all-clear.

**Telegram bot commands:** `/status` · `/ward <name>` · `/stations` · `/toxic` · `/help`. Free-text questions are answered via Bedrock.

---

## 12. Crowdfunding & Payments

Two **state-adaptive campaigns**: the active campaign switches automatically with intake status.

| Campaign | Active when | Title | Suggested tiers (₹) |
|---|---|---|---|
| `upkeep` | Intake **OPEN** | Bio-Sentinel Node Upkeep Fund | 199, 1999 |
| `relief` | Intake **closed/diverted** | Emergency Clean Water Relief Fund | 499, 2499 |

- Order amounts: ₹10 – ₹5,00,000. Impact calculator: **₹1 ≈ 2 L** of verified tanker water.
- **Razorpay** orders and signature verification; webhook endpoint at `/donations/webhook`; order-status polling endpoint.
- **Mock mode** automatically when Razorpay keys are absent (uses a dev secret), so the full flow is testable offline.
- Dynamic **UPI QR** component and a donor wall (anonymous option supported).

---

## 13. Repository Structure

```
Bio-Sentinel/
├── .gitignore
└── AWS-PROJECT/
    ├── backend/
    │   ├── app/
    │   │   ├── main.py                 # FastAPI app factory, CORS, routers, health
    │   │   ├── config.py               # All env-driven settings + constants
    │   │   ├── auth.py                 # Identity resolution, roles, Google verify, OTP
    │   │   ├── accounts.py             # DynamoDB account store, PBKDF2 passwords
    │   │   ├── sessions.py             # Stateless HMAC session tokens
    │   │   ├── totp.py                 # TOTP authenticator support
    │   │   ├── schemas.py              # Pydantic request models
    │   │   ├── store.py                # In-memory state singleton (`db`)
    │   │   ├── store_memory.py         # MemoryStore implementation
    │   │   ├── store_dynamodb.py       # DynamoDB store implementation
    │   │   ├── routers/                # accounts · monitoring · operator · payments
    │   │   │                           # reports · subscribers · toxicity
    │   │   └── services/               # incidents · alerts · notify · llm · payments
    │   │                               # toxicity · telegram_bot · photos · audit
    │   ├── bio_sentinel_inference.py   # Live inference + forecast
    │   ├── bio_sentinel_model.joblib   # Trained model bundle
    │   ├── bio_telemetry_dataset.csv   # 60k-row synthetic training data
    │   ├── generate_telemetry_dataset.py
    │   ├── train_bio_sentinel_model.py
    │   ├── create_table.py             # Creates the DynamoDB table (+ gsi1)
    │   ├── provision_staff.py          # Invite-only operator/reporter provisioning
    │   ├── handler.py                  # AWS Lambda entrypoint (Mangum)
    │   ├── Dockerfile                  # Lambda container image (python:3.12)
    │   ├── server.py                   # Legacy v1 prototype server (see notes)
    │   ├── migration_plan.md           # DynamoDB migration design notes
    │   ├── requirements.txt
    │   ├── .env.example
    │   └── tests/                      # pytest suite
    ├── frontend/
    │   ├── index.html
    │   ├── vite.config.js              # Dev proxy to the API
    │   ├── playwright.config.js        # Desktop + mobile e2e projects
    │   ├── public/                     # Logos, hardware imagery, 3D .glb models
    │   ├── src/
    │   │   ├── App.jsx · main.jsx · api.js · auth.jsx · ui.jsx · format.js
    │   │   ├── components/donation/    # Checkout, UPI QR, success modal, etc.
    │   │   └── views/                  # Home · Auth · LiveDashboard · PublicDashboard
    │   │                               # CorridorMap · StationWatch · StationMap
    │   │                               # Incidents · Alerts · Reports · Audit
    │   │                               # GateControl · Funding · Subscribe
    │   │                               # ToxicitySimulator · Biomonitor3DViewer
    │   └── tests/                      # Playwright specs
    ├── simulator/
    │   └── edge_streamer.py            # Fake edge unit (normal / inject_toxin)
    └── scratch/migrate.py              # One-off refactor helper
```

---

## 14. Tech Stack

**Backend:** Python 3.12 · FastAPI · Pydantic v2 · Uvicorn · Mangum (Lambda adapter) · boto3 · pandas · NumPy (<2) · scikit-learn · LightGBM · joblib · google-auth · requests · python-dotenv

**Frontend:** React 19 · Vite 8 · Tailwind CSS 4 · MapLibre GL 4 · `@google/model-viewer` · lucide-react · qrcode.react · Razorpay Checkout · oxlint · Playwright

**AWS:** EC2 (current backend) · CloudFront · DynamoDB · SNS · Bedrock · Location Service (V2 maps) · S3 · SSM Parameter Store

**Testing:** pytest · httpx / FastAPI TestClient · moto (DynamoDB mock) · Playwright

---

## 15. Getting Started (Local Development)

### Prerequisites
- Python **3.12**
- Node.js **18+** (20+ recommended) and npm
- *(Optional)* Docker, for DynamoDB Local
- *(Optional)* AWS credentials, only if you enable SNS / Bedrock / S3 / Location

### 15.1 Clone
```bash
git clone <your-repo-url> Bio-Sentinel
cd Bio-Sentinel/AWS-PROJECT
```

### 15.2 Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env                 # then edit; see §16
```

Minimal local `.env` (no AWS needed for the core flow):
```ini
DEV_MODE=1
CORS_ORIGINS=http://localhost:5173
```

Run the API:
```bash
uvicorn app.main:app --reload --port 8000
```
Open <http://localhost:8000/docs> for the interactive OpenAPI UI. Health check: `GET /` → `{"service": "Bio-Sentinel Core Engine", "status": "ONLINE", ...}`.

### 15.3 (Optional) DynamoDB Local for email/password accounts
Email/password accounts prefer DynamoDB. The current code falls back to process memory and `backend/.local_users.json` on DynamoDB failures; this fallback is not shared between instances and writes can fail. Use DynamoDB for deployment and monitor account-store errors.
```bash
docker run -d -p 8000:8000 amazon/dynamodb-local     # use another host port if 8000 is taken by the API
# in backend/.env:
#   DDB_ENDPOINT_URL=http://localhost:8001   (match your mapped port)
#   DDB_TABLE_NAME=biosentinel
#   SESSION_SECRET=<python -c "import secrets; print(secrets.token_urlsafe(48))">
python create_table.py
```
> With `DEV_MODE=1` the dev tokens and a fixed dev session secret work out of the box, so you can skip this step for most local work.

### 15.4 Frontend
```bash
cd ../frontend
npm install
npm run dev                          # http://localhost:5173
```
The Vite dev server **proxies** API paths (`/status`, `/telemetry`, `/stations`, `/auth`, `/map`, …) to `http://localhost:8000`. Point it elsewhere with:
```bash
VITE_API_TARGET=http://my-backend:8000 npm run dev
```

Other scripts:
```bash
npm run build        # production build → dist/
npm run preview      # serve the production build
npm run lint         # oxlint
npm run test:e2e     # Playwright (desktop + mobile)
```

### 15.5 Drive it with the edge simulator
In a third terminal:
```bash
cd ../simulator
pip install requests

python edge_streamer.py --mode normal                       # healthy fleas, every 3 s
python edge_streamer.py --mode inject_toxin                 # the blind-spot attack
python edge_streamer.py --mode inject_toxin --station STATION_04_PALLA --interval 2
```
Then open the operator console (sign in with DEV token `dev-operator-1`) and watch an incident open, the T-minus clock start, and the corridor turn red.

### 15.6 Try it with curl
```bash
curl -X POST http://localhost:8000/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "station_id": "STATION_02_PANIPAT",
    "timestamp": 1728412800,
    "chemical":   {"ammonia_ppm": 0.36, "ph": 7.4, "temperature_c": 32.0},
    "biological": {"avg_velocity_mms": 38.0, "avg_depth_cm": 12.0, "erratic_index": 90.0}
  }'

curl http://localhost:8000/status

curl -X POST http://localhost:8000/gate-command \
  -H "Authorization: Bearer dev-operator-1" -H "Content-Type: application/json" \
  -d '{"action": "SHUTDOWN", "rationale": "Confirmed plume, protecting intake"}'
```

---

## 16. Configuration Reference

All settings are read from environment variables (`backend/.env` is auto-loaded via `python-dotenv`; real environment variables win).

### Core & Auth
| Variable | Default | Description |
|---|---|---|
| `DEV_MODE` | `0` | Enables dev tokens, dev session secret, mock delivery. **Never enable in production.** |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `GOOGLE_CLIENT_ID` | – | Google OAuth web client id (public) |
| `OPERATOR_ALLOWLIST` | – | Comma-separated emails or `@domain` entries granted operator access |
| `SESSION_SECRET` | – (dev value in DEV_MODE) | HMAC key for session tokens; required in prod |
| `SESSION_TTL_S` | `604800` | Session lifetime (7 days) |
| `PASSWORD_MIN_LENGTH` | `8` | Minimum password length |
| `SENSOR_API_KEY` | – | If set, `POST /telemetry` requires matching `X-Api-Key` |
| `OPERATOR_TOKENS` / `REPORTER_TOKENS` | dev defaults | `token:Name,…` pairs, honoured **only** in DEV_MODE |

### Storage
| Variable | Default | Description |
|---|---|---|
| `DDB_TABLE_NAME` | `biosentinel` | DynamoDB table |
| `DDB_ENDPOINT_URL` | – | Set for DynamoDB Local; blank = real AWS |
| `REPORT_PHOTO_BUCKET` | – | Private S3 bucket for report photos (needs POST CORS) |

### AWS services
| Variable | Default | Description |
|---|---|---|
| `AWS_REGION` | `ap-southeast-2` | Region for SNS / Location |
| `USE_AWS_SNS` | `0` | Enable live SMS / topic delivery |
| `SNS_TOPIC_ARN_OPERATORS` / `SNS_TOPIC_ARN_CITIZENS` | – | Topic ARNs |
| `SNS_SMS_SENDER_ID` / `SNS_SMS_TYPE` | `BIOSNT` / `Transactional` | SMS attributes |
| `LOCATION_API_KEY` | – | Amazon Location **public** API key (kept server-side) |
| `LOCATION_MAP_STYLE` | `Standard` | Map style name |
| `USE_AI_ALERTS` | `0` | Enable Bedrock-generated alert copy |
| `BEDROCK_REGION` / `BEDROCK_MODEL_ID` | `ap-southeast-2` / `zai.glm-5` | Bedrock settings |

### Messaging & Payments
| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Telegram bot and operator chat |
| `GMAIL_SENDER`, `GMAIL_APP_PASSWORD` | Gmail SMTP for email OTP (use an **app password**) |
| `SMTP_HOST`, `SMTP_PORT` | Default `smtp.gmail.com` / `587` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay credentials (blank = mock mode) |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret (falls back to key secret) |

### Tuning
| Variable | Default | Description |
|---|---|---|
| `UIA_WATCH_MGL` / `UIA_DANGER_MGL` | `0.02` / `0.20` | Un-ionized ammonia bands |
| `DEFAULT_WATER_TEMP_C` | `30` | Used when a report omits temperature |

> 🔒 `.env`, `*.pem`, `samconfig.toml` and `.aws-sam/` are git-ignored. Never commit secrets.

---

## 17. API Reference

Interactive docs are served at **`/docs`** (Swagger) and **`/redoc`**. Auth column: 🌐 public · 👤 any signed-in user · 🛠 operator/reporter.

### Health & Identity
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | 🌐 | Service health |
| GET | `/auth/config` | 🌐 | Client config: Google client id, which login methods are enabled |
| GET | `/me` | 👤 | Resolved identity and role |

### Authentication
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | 🌐 | Create a citizen account |
| POST | `/auth/login` | 🌐 | Email + password sign-in |
| POST | `/auth/send-otp` | 🌐 | Send an email OTP |
| POST | `/auth/verify-otp` | 🌐 | Verify an email OTP |
| POST | `/auth/staff-login` | 🌐 | Operator/reporter sign-in (password + TOTP/email OTP) |
| POST | `/auth/set-password` | 🛠 (Google) | Bind a password to a Google-verified operator account |

### Telemetry & Monitoring
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/telemetry` | 🌐 / `X-Api-Key` | Ingest a reading → classification, forecast, toxicity, incident id |
| GET | `/telemetry/{station_id}` | 🌐 | Recent readings (`limit` ≤ 200) |
| GET | `/status` | 🌐 | Public dashboard summary (no controls/audit) |
| GET | `/stations` | 🛠 | Full corridor state, gate state, open incidents |
| GET | `/incidents` | 🛠 | All incidents |
| POST | `/incidents/{id}/close` | 🛠 | Close an incident |
| GET | `/river-health/{stretch_id}` | 🌐 | GeoJSON reaches coloured by recent incidents (`hours` 1–168) |

### Map Proxy
| Method | Path | Description |
|---|---|---|
| GET | `/map-config` | Region, style, and proxied style URL (key never returned) |
| GET | `/map/style/{style}/descriptor` | Style JSON with tile URLs rewritten through the proxy |
| GET | `/map/tiles/{tileset}/{z}/{x}/{y}` | Vector tile proxy (24 h cache) |

### Toxicity
| Method | Path | Description |
|---|---|---|
| GET | `/toxicity/assess?ammonia_ppm=&ph=&temp_c=` | Un-ionized ammonia, band, heat multiplier |
| GET | `/toxicity/heat-curve?ammonia_ppm=&ph=` | UIA across 15–50 °C |

### Operator Actions
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/gate-command` | 🛠 | `SHUTDOWN` / `DIVERT_BYPASS` / `RESTORE` + rationale; audited |
| POST | `/alerts/send` | 🛠 | Create/send a custom alert (may require approval) |
| POST | `/alerts/{id}/approve` | 🛠 | Second-operator approval |
| GET | `/alerts` | 🛠 | Alert history |
| GET | `/audit` | 🛠 | Audit log (`limit` ≤ 500) |
| GET / PUT | `/automation/rules` | 🛠 | Read / update automation toggles |

### Field Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/reports/upload-url` | 🌐 | Pre-signed S3 POST for a photo (5/h/IP) |
| POST | `/reports` | 🌐 / 🛠 | Submit a report (citizens: 5/h/IP; staff = verified weight) |
| GET | `/reports` | 🌐 | Approved reports only |
| GET | `/reports/pending` | 🛠 | Review queue |
| PATCH | `/reports/{id}` | 🛠 | `approve` / `reject` |

### Subscriptions & Telegram
| Method | Path | Description |
|---|---|---|
| GET | `/subscribe/config` | Telegram links, SNS status, community metrics |
| POST | `/subscribe` | Subscribe a phone to ward alerts (consent required) |
| POST | `/subscribe/verify` | Verify subscription OTP |
| POST | `/subscribe/stop` | Opt out |
| GET | `/subscribers/summary` | Subscriber summary |
| POST | `/telegram/webhook` · `/telegram/poll-updates` | Bot ingestion |

### Payments
| Method | Path | Description |
|---|---|---|
| GET | `/campaigns` | Active campaign, totals, donor wall |
| POST | `/donations/order` | Create a Razorpay (or mock) order |
| POST | `/verify-payment` | HMAC signature verification and ledger entry |
| GET | `/donations/order/{id}/status` | Poll order status |
| POST | `/donations/webhook` | Razorpay webhook |

---

## 18. Data Contracts

**Telemetry request** (`POST /telemetry`)
```json
{
  "station_id": "STATION_02_PANIPAT",
  "timestamp": 1728412800,
  "chemical":   { "ammonia_ppm": 0.42, "ph": 7.35, "temperature_c": 32.1 },
  "biological": { "avg_velocity_mms": 14.6, "avg_depth_cm": 84.0, "erratic_index": 11.4 }
}
```

**Telemetry response**
```json
{
  "station_id": "STATION_02_PANIPAT",
  "anomaly_detected": true,
  "threat_level": "CRITICAL_LEVEL_3",
  "anomaly_type": "BIO_KINEMATIC_COLLAPSE",
  "arrival_forecast": {
    "river_velocity_kmh": 2.2,
    "distance_km": 18.5,
    "estimated_hours_to_wazirabad": 8.4,
    "predicted_intake_ammonia_ppm": 3.75,
    "predicted_intake_unionized_mgl": 0.0
  },
  "toxicity": {
    "total_ammonia_ppm": 0.36,
    "unionized_fraction": 0.0,
    "unionized_ammonia_mgl": 0.0,
    "band": "SAFE",
    "heat_multiplier_vs_25c": 1.0
  },
  "incident_id": "inc_ab12cd34"
}
```
*(Numeric values in the `toxicity` block are illustrative.)*

**Field report** (`POST /reports`)
```json
{
  "lat": 29.39, "lng": 76.97,
  "location_label": "Drain outfall near bridge",
  "source_type": "drain_outfall",
  "ammonia_ppm": 2.1, "ph": 8.6, "temperature_c": 34,
  "observations": ["dark_color", "foam", "sharp_smell"],
  "note": "Strong smell, dead fish on bank",
  "photo_key": null
}
```
`source_type` ∈ `river | drain_outfall | tap | tanker`

**Gate command** (`POST /gate-command`)
```json
{ "action": "SHUTDOWN", "rationale": "Confirmed plume reaching Palla in 4 h" }
```

**Subscribe** (`POST /subscribe`)
```json
{ "phone": "9876543210", "ward": "Civil Lines", "language": "both",
  "alert_types": ["pollution", "rationing", "all_clear"], "consent": true }
```
Phone numbers are normalised to `+91XXXXXXXXXX` (10-digit Indian mobiles).

---

## 19. DynamoDB Data Model

Single-table design, `PAY_PER_REQUEST`, with one GSI (`gsi1`). Create it with `python create_table.py`.

| Entity | `pk` | `sk` |
|---|---|---|
| User account | `USER#<email>` | `META` |
| Station | `STATION#<id>` | `META` |
| Telemetry | `TS#<station_id>` | `<timestamp>#<uuid>` (TTL) |
| Active / closed incident | `INC#ACTIVE` / `INC#CLOSED` | `<incident_id>` |
| Report | `REP#<id>` | `META` (`gsi1pk=STATUS#<status>`) |
| Subscriber | `SUB#<phone>` | `META` (`gsi1pk=WARD#<ward>`) |
| OTP | `OTP#<phone>` | `META` (TTL) |
| Donation / Ledger | `DON#<order_id>` / `LEDGER` | `META` / `<payment_id>` |
| Alert | `ALT#<id>` | `META` |
| Audit entry / head | `AUDIT` / `AUDITHEAD` | zero-padded seq / `HEAD` |
| Rate limit | `RATE#<key>` | `<timestamp>` (TTL) |
| Config | `CONFIG` | `GATE` / `RULES` |

See `backend/migration_plan.md` for the full storage-abstraction design.

---

## 20. Edge Simulator

`simulator/edge_streamer.py` emulates a station so you can demo the whole pipeline without hardware.

| Flag | Default | Description |
|---|---|---|
| `--mode` | `normal` | `normal` (healthy foraging) or `inject_toxin` (blind-spot collapse) |
| `--api-url` | `http://localhost:8000/telemetry` | Target endpoint |
| `--interval` | `3.0` | Seconds between readings |
| `--station` | `STATION_02_PANIPAT` | Station ID |

In `inject_toxin` mode the chemical probes stay **green** (ammonia ≈ 0.32–0.41 ppm) while velocity, depth and erratic index collapse, which is exactly the scenario conventional sensors miss.

If you enabled `SENSOR_API_KEY`, add the `X-Api-Key` header to the simulator's request.

---

## 21. Testing

### Backend (pytest)
```bash
cd AWS-PROJECT/backend
pytest -q
```
- Latest local audit: **94 tests passed** (12 October 2026), including API behaviour, accounts, Google auth, audit-chain helpers, map proxy, toxicity, dashboard integrations and Lambda adapter startup. Five scikit-learn warnings report loading a model saved with 1.5.1 into runtime 1.9.1; this is not an accuracy validation. The Lambda container itself was not built.
- `conftest.py` forces `DEV_MODE=1`, disables SNS, blanks Razorpay/Google/allowlist settings, and resets the in-memory store before **every** test, so the suite is hermetic and never calls the network.

### Frontend (Playwright)
```bash
cd AWS-PROJECT/frontend
npx playwright install chromium        # first time only
npm run test:e2e
```
- Specs: `public`, `community`, `console`, `map`, run on **desktop (1440×1000)** and **mobile (390×844)** projects.
- Playwright starts the dev server automatically. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a custom Chromium.

### Lint
```bash
npm run lint      # oxlint
```

---

## 22. Deployment on AWS

Verified with read-only AWS API calls on 12 October 2026 (Asia/Kolkata), account `056176271096`:

| Component | Observed configuration |
|---|---|
| Public URL | <https://d1lidy5nyd64my.cloudfront.net/> |
| CloudFront | Distribution `E3UAFMAHX2RNXN`, enabled, status `Deployed` |
| Frontend origin | S3 website endpoint `biosentinel-web-056176271096.s3-website-ap-southeast-2.amazonaws.com` |
| API origin | EC2 public DNS `ec2-13-238-143-38.ap-southeast-2.compute.amazonaws.com` |
| EC2 backend | `i-07270d5f23b131df5`, `BioSentinel-Backend-Prod`, running, `t3.small`, `ap-southeast-2` |
| DynamoDB | Table `bio-sentinel` exists in `ap-southeast-2`; ensure `DDB_TABLE_NAME=bio-sentinel` in deployment configuration |
| Lambda | No functions returned in `ap-southeast-2`; Lambda is not this CloudFront distribution's API origin |

CloudFront defaults to the S3 frontend and routes API prefixes including `/auth*`, `/status*`, `/telemetry*`, `/stations*`, `/reports*`, `/donations*` and `/map*` to the EC2 origin. This provides the same-origin API calls expected by the frontend. The checked-in Dockerfile describes an alternative Lambda packaging path, not the currently observed deployment.

The local `AWS-PROJECT/scratch/userdata.sh` describes Nginx proxying to Uvicorn on port 8000, with separate systemd services for FastAPI and Telegram polling. This script supports the EC2 architecture but does not prove the running instance has applied every line. No private runtime environment or secrets were retrieved in this audit. Access to other-region inventories was denied; the observations above are scoped to the actual CloudFront origins and Sydney resources.

### Frontend build

```bash
cd AWS-PROJECT/frontend
npm ci
npm run build
```

Upload `dist/` to the frontend bucket and invalidate the relevant CloudFront paths when deploying. Local fixes described in §24 have not been pushed to the live instance or bucket as part of this audit.

### Optional Lambda packaging

`backend/Dockerfile` uses `public.ecr.aws/lambda/python:3.12` and `handler.lambda_handler`. `mangum` is now declared in `requirements.txt`; a `.dockerignore` excludes local credentials and account files. This adapter is tested locally, but the Docker image has not been built or deployed during this audit. Operational state must be made persistent before using multiple Lambda execution environments.

### Remaining production work

- Persist operational state before restarts or horizontal scaling; see §24.
- Replace sample coordinates, ward schedules and forecast distances with validated configuration.
- Confirm deployed secret configuration, provider permissions and end-to-end delivery independently; an AWS resource existing does not verify those services.
- Configure Google authorized JavaScript origins for the deployed frontend.
- Confirm the desired license with the repository owner.

---

## 23. Frontend Guide

| View | Audience | Purpose |
|---|---|---|
| **Home** | Everyone | Story-driven landing page: the gap, the sensor, how it works, roles |
| **Auth** | Everyone | Sign in / register for operator, reporter and citizen roles |
| **PublicDashboard** ("Yamuna Water Watch") | Signed-in citizens | Live status, stations, rationing, map |
| **LiveDashboard** (Operator console) | Operators / reporters | Overview, corridor map, incidents, gate control, alerts, reports, audit |
| **CorridorMap / StationMap** | Both | MapLibre map via the keyless tile proxy with river-health overlay |
| **StationWatch** | Both | Per-station telemetry |
| **Subscribe** | Citizens | SMS / Telegram ward subscription |
| **ToxicitySimulator** | Everyone | "Heat makes it deadlier" calculator and curve |
| **Funding / DonationCheckout** | Signed-in users | Campaigns, donor wall, Razorpay / UPI |
| **Biomonitor3DViewer** | Everyone | Interactive 3D model of the sensor hardware |

Navigation is state-based (no router). The public dashboard and donation flows sit behind sign-in; operator/reporter sign-in lands directly in the console.

---

## 24. Known Limitations & Notes

1. **Operational state is still in memory.** `app/store.py` holds telemetry, incidents, reports, subscribers, alerts, donations, audit and gate state. EC2 process restarts lose it; workers do not share it. `store_dynamodb.py` is not wired into the active runtime. Migrating state is still required.
2. **Account persistence has a fallback.** Accounts prefer DynamoDB but fall back to memory and `backend/.local_users.json` on failures. The module docstring's claim that no fallback exists is stale. A local file is neither shared nor guaranteed durable.
3. **Mangum dependency fixed locally.** `requirements.txt` now includes Mangum; the actual live backend uses EC2. The Lambda adapter remains an optional packaging path.
4. **Prototype entry point fixed locally.** `backend/server.py` now imports `app.main.app`. Both entry points use the same authentication and payment checks; the hard-coded test key and unconditional successful payment response were removed.
5. **Synthetic training data.** The generator samples numerical distributions. No new training run or real-world accuracy validation was performed in this audit. The un-ionized ammonia thresholds remain configurable starting values.
6. **Distance mismatch fixed locally; calibration remains open.** Public status now exposes backend `distance_km`; dashboard and Telegram read that metadata. Station 02 remains configured at 18.5 km. That distance is smaller than downstream Sonipat's 38.5 km, so the corridor's physical distances still need verification before operational use.
7. **Placeholder configuration remains.** Station coordinates, ward schedules and the 110 MGD deficit are sample/assumed values. The artificial 1,420-subscriber minimum was removed locally; counts now reflect verified, non-opted-out records in the runtime store.
8. **Duplicate assets confirmed.** `yamuna_watch_textured.glb` and `yamuna_watch_textured (5).glb` are byte-identical: 18,372,248 bytes each, SHA-256 `2701691d0cf5c119d140be3b58d5c3bb19f50956486bdcaf65c0c979aba9fecf`. Only the former is referenced by frontend code. A separate 9,802,252-byte `sensor-model.glb` is different. No Git history was rewritten or model asset removed in this audit.
9. **Deployment distinction.** The live CloudFront API origin is EC2, not Lambda. Repository fixes are local until explicitly deployed and verified.
10. **Model/runtime mismatch.** Local tests warn that the saved estimators use scikit-learn 1.5.1 while the installed runtime is 1.9.1. Align the serving environment with the trained artifact or retrain and validate it before relying on predictions.
11. **No license file found.** License selection is an owner decision; none was added by this audit.

---

## 25. Roadmap

- [ ] Wire the DynamoDB store as the default persistent backend (incidents, audit chain, gate state)
- [ ] Real edge firmware (Raspberry Pi / Jetson) with on-device Daphnia tracking
- [ ] Validate and re-train on real Daphnia behavioural recordings
- [ ] Per-station river-velocity from live gauges instead of a fixed 2.2 km/h
- [ ] Hydrodynamic plume model (dispersion, dilution, confluences)
- [ ] Multi-river and multi-intake support
- [ ] Infrastructure-as-code (SAM/CDK/Terraform) for one-command deployment
- [ ] WebSocket / SSE push instead of polling
- [ ] Additional regional languages for citizen alerts
- [ ] Public open-data API and historical archive

---

## 26. Contributing

1. Fork and create a branch: `git checkout -b feature/my-change`
2. Keep tests green: `pytest -q` (backend) and `npm run test:e2e` (frontend)
3. Run `npm run lint` before committing frontend changes
4. **Never commit secrets**: use `.env` (git-ignored) and `.env.example` for documentation
5. Open a pull request describing the change and how you tested it

Please open an issue first for substantial changes (new storage backend, auth changes, model changes).

---

## 27. License & Acknowledgements

**License:** *No license file is currently included in the repository.* The repository owner must choose the intended license; this audit does not assign one.

**Acknowledgements**
- Built for the **AWS Environmental Hackathon 2026** (Heat & Water).
- *Daphnia magna* biomonitoring research, the foundation for behavioural toxicity detection.
- Delhi Jal Board intake guidance (0.9 ppm ammonia reference used in feature engineering).
- Amazon Web Services, Razorpay, Telegram, MapLibre, LightGBM, FastAPI and React communities.

<div align="center">

**🌊 Bio-Sentinel: from one flea to one decision. 🛡️**

<https://d1lidy5nyd64my.cloudfront.net/>

</div>
