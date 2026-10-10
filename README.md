# ResQlink

ResQlink is a disaster-management and emergency-response application focused on rapid SOS reporting, live incident visibility, missing and found person workflows, and admin response coordination.

## Team Members

- Vaisnavi Nag
- Pradya Shetty
- Ananya

## Core Features

- SOS alert creation with location, medical context, and media evidence.
- Public and admin dashboards with live alert feed.
- Missing and found person report workflows.
- Person match workflows from admin tools.
- Shelter administration and nearby shelter lookup.
- Role-based controls for destructive actions (admin-only delete and match run).

## AI Feature: Deep-Learning Face Matching

ResQlink now includes a deep-learning face recognition pipeline using a separate AI microservice.

### What this adds

- Face detection from report photos.
- ArcFace embedding generation.
- Cosine similarity between missing and found person photos.
- AI-assisted match score blended with existing rule-based score.

### What is preserved

The earlier rule-based system is still active and is not removed. It still uses:

- age difference
- clothing description similarity
- physical description similarity
- geographic distance
- time difference

If AI face embeddings are unavailable, matching safely falls back to rule-based logic.

## Deep-Learning Concepts Used

- Pretrained model use: no model training from scratch.
- Face detection: identify face regions from full image.
- Primary face selection: largest face when multiple faces are detected.
- Face embedding: convert face image to a dense numerical vector.
- Vector normalization: convert vectors to unit length for stable comparison.
- Cosine similarity: identity similarity between two embeddings.

Similarity concept:

$$
similarity = \frac{A \cdot B}{\|A\|\|B\|}
$$

## System Architecture

```text
ResQlink
  |- frontend (HTML/CSS/JS)
  |- backend (FastAPI + MongoDB + Cloudinary)
  |- ai-service (FastAPI + InsightFace/ArcFace)

Data flow:
photoUrl -> AI face detection -> ArcFace embedding -> MongoDB fields -> match scoring
```

## Repository Structure

```text
repo-copy-project/
|- backend/
|  |- main.py
|  |- spaCy.py
|  |- requirements.txt
|- frontend/
|  |- *.html
|  |- css/
|  |- js/
|  |- Material/
|- ai-service/
|  |- main.py
|  |- face_engine.py
|  |- requirements.txt
|  |- .env
|  |- README.md
|- docs/
|  |- README.md
|  |- PRE_INSTALLATION_AFTER_CLONE.md
|  |- FEATURES.md
|  |- TEST_CASES.md
|- README.md
```

## Tech Stack

### Frontend

- HTML5
- CSS3 + Tailwind CDN
- Vanilla JavaScript
- Leaflet.js

### Backend

- FastAPI
- PyMongo
- spaCy
- Cloudinary
- JWT auth
- Requests

### AI Service

- FastAPI
- InsightFace
- ArcFace embeddings
- ONNX Runtime
- OpenCV
- NumPy

## API Endpoints (AI-Related)

### AI service endpoints

- GET /health
- POST /face/embed
- POST /face/compare

### Main backend endpoints that use AI

- POST /missing-persons
- POST /found-persons
- POST /matches/run
- POST /matches/run/missing/{missing_person_id}

## Stored Face Fields

On report processing, backend can store fields such as:

```json
{
  "photoUrl": "https://res.cloudinary.com/...",
  "faceDetected": true,
  "faceEmbedding": [],
  "faceEmbeddingModel": "ArcFace",
  "faceProcessedAt": "2026-10-06T12:00:00+00:00",
  "faceProcessingError": "NO_FACE_DETECTED"
}
```

To avoid repeated inference for same image URL, embeddings are cached in MongoDB collection:

- face_embeddings_cache

## Scoring Logic

Rule score is preserved.
When face embeddings are available for both sides, final score is blended:

$$
final = (1 - w) \cdot ruleScore + w \cdot faceSimilarity
$$

Where:

- w = FACE_MATCH_WEIGHT (default 0.20)

For selected-missing matching, strong face similarity can directly qualify a match using FACE_DIRECT_MATCH_THRESHOLD.

## Error Handling

AI pipeline handles these scenarios gracefully:

- invalid image URL
- timeout while fetching image
- broken or unsupported image
- no face detected
- multiple faces detected
- AI service unavailable

The app does not crash; it stores diagnostics and falls back safely where needed.

## Setup

### 1) Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

### 2) AI service

```bash
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 3) Frontend

```bash
cd frontend
python -m http.server 8080
```

Open:

- http://localhost:8080/index.html

## Environment Variables

### backend/.env

```env
MONGODB_URI=your_mongodb_uri
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=disaster-management
JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_HOURS=12
ADMIN_EMAIL=admin@resqlink.com
ADMIN_PASSWORD=ResQlink@2026

FACE_AI_SERVICE_URL=http://localhost:8001
FACE_AI_TIMEOUT_SECONDS=12
FACE_MATCH_WEIGHT=0.20
FACE_DIRECT_MATCH_THRESHOLD=0.70
```

### ai-service/.env

```env
FACE_SIMILARITY_THRESHOLD=0.60
FACE_DET_SIZE=640
AI_HTTP_TIMEOUT_SECONDS=12
AI_MODEL_NAME=buffalo_l
AI_EXECUTION_PROVIDER=CPUExecutionProvider
AI_CTX_ID=0
AI_SERVICE_PORT=8001
```

## Quick Test Commands

### AI health

```bash
curl http://localhost:8001/health
```

### Compare two image URLs

```bash
curl -X POST "http://localhost:8001/face/compare" \
  -H "Content-Type: application/json" \
  -d '{
    "missingImageUrl": "https://res.cloudinary.com/...",
    "foundImageUrl": "https://res.cloudinary.com/..."
  }'
```

### Run selected missing-person match from backend

```bash
curl -X POST "http://localhost:5000/matches/run/missing/<missingId>" \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{"threshold":0.62}'
```

## Documentation Index

- [Project docs](docs/README.md)
- [Pre-installation guide](docs/PRE_INSTALLATION_AFTER_CLONE.md)
- [Feature list](docs/FEATURES.md)
- [Scenario test cases](docs/TEST_CASES.md)
- [AI service deep-learning docs](ai-service/README.md)

## Contact

Use repository issues/discussions for project questions.
