# ResQlink AI Service (Face Recognition)

This service is the deep-learning face recognition component for ResQlink.
It detects faces, generates ArcFace embeddings, and computes similarity for missing and found person matching.

---

## 1) What This Service Solves

ResQlink already had rule-based matching using:
- age
- clothing similarity
- physical description similarity
- location distance
- time difference

This AI service extends that system with face similarity from deep-learning embeddings.
It does not replace the old system; it adds an additional signal.

---

## 2) High-Level Architecture

```text
Frontend (dashboard/admin console)
          |
Backend API (FastAPI in this repository)
          |
  +-------+-------------------------+
  |                                 |
MongoDB                        Cloudinary
  |                                 |
  +---------------+-----------------+
                  |
         AI Service (this folder)
            FastAPI + InsightFace
                  |
              ArcFace Embedding
                  |
            Cosine Similarity Score
```

### Why separate service?
- AI dependencies are heavy and can be isolated.
- Easier deployment/scaling independently from main backend.
- Cleaner fault boundaries (main app still works if AI is down).

---

## 3) Core Concepts Explained

### 3.1 Face Detection
The model first locates face bounding boxes in the image.
If multiple faces are found, the largest face is selected.

### 3.2 Face Embedding
ArcFace converts a face crop into a numeric feature vector (embedding).
Embeddings represent identity-related features in vector space.

### 3.3 Embedding Normalization
Before comparison, vectors are normalized (unit length).
This makes cosine similarity stable and meaningful.

### 3.4 Cosine Similarity
Similarity between two normalized vectors:

$$
  ext{similarity} = \frac{A \cdot B}{\|A\|\|B\|}
$$

After normalization, denominator is effectively 1, so this becomes a dot product.

### 3.5 Threshold and Match Decision
- If similarity >= threshold: matched = true
- Else: matched = false

Default threshold is controlled by `FACE_SIMILARITY_THRESHOLD`.

---

## 4) Technology Stack

- FastAPI: HTTP API layer
- InsightFace: face detection + ArcFace embeddings
- ONNX Runtime: model inference backend
- OpenCV: image decoding
- NumPy: vector math
- Requests: image download from Cloudinary URLs

---

## 5) API Endpoints and Contracts

## `GET /health`
Used by monitoring and startup checks.

Response:
```json
{
  "status": "ok",
  "service": "face-recognition"
}
```

## `POST /face/compare`
Compares two image URLs directly.

Request:
```json
{
  "missingImageUrl": "https://res.cloudinary.com/...",
  "foundImageUrl": "https://res.cloudinary.com/..."
}
```

Success response:
```json
{
  "matched": true,
  "similarity": 0.914,
  "confidence": 91.4
}
```

Notes:
- `confidence` is a presentation-friendly percentage derived from similarity.
- Similarity precision is returned as a rounded float.

## `POST /face/embed`
Generates and returns embedding metadata for one image.
Used by backend for caching and reuse.

Request:
```json
{
  "imageUrl": "https://res.cloudinary.com/..."
}
```

Success response:
```json
{
  "faceDetected": true,
  "facesDetected": 1,
  "faceEmbedding": [0.01, -0.03],
  "faceEmbeddingModel": "ArcFace",
  "faceProcessedAt": "2026-10-06T12:00:00+00:00"
}
```

No-face response:
```json
{
  "faceDetected": false,
  "faceProcessingError": "NO_FACE_DETECTED",
  "faceProcessedAt": "2026-10-06T12:00:00+00:00"
}
```

---

## 6) Error Handling Strategy

The service is designed to fail gracefully with machine-readable error codes.

Typical handled cases:
- invalid URL (`INVALID_IMAGE_URL`)
- download timeout (`IMAGE_FETCH_TIMEOUT`)
- download/network failure (`IMAGE_FETCH_FAILED`)
- unsupported content type (`UNSUPPORTED_IMAGE`)
- broken/undecodable image (`BROKEN_IMAGE`)
- no face in image (`NO_FACE_DETECTED`)
- inference/runtime errors (`FACE_ENGINE_ERROR` / `INTERNAL_ERROR`)

Design goals:
- Never crash on bad input.
- Return informative response for backend/UI.
- Keep response schema consistent.

---

## 7) Multiple Faces Handling

If an image contains multiple faces:
- All faces are detected.
- The largest bounding box (primary face) is chosen.

Why this choice:
- Usually represents the most foreground/intentional subject.
- Deterministic behavior for reproducible results.

---

## 8) Embedding Caching and Reuse

To avoid repeated model inference, backend caches embedding metadata by `photoUrl`.

Backend cache collection:
- `face_embeddings_cache`

Stored fields include:
- `photoUrl`
- `faceDetected`
- `faceEmbedding`
- `faceEmbeddingModel`
- `faceProcessedAt`
- `faceProcessingError`

Benefit:
- lower latency
- lower compute cost
- faster repeated matching

---

## 9) Main Backend Integration Behavior

When a missing/found report is created, backend now:
1. checks cache by `photoUrl`
2. if cache miss, calls `POST /face/embed`
3. stores embedding metadata in report
4. stores/updates cache for future reuse

If processing fails (for example no face or timeout), report creation still succeeds; it simply carries `faceDetected=false` and a reason field.

This keeps user flow resilient and avoids blocking core operations.

During match runs, backend also backfills face fields for older records that were created before AI integration.
This means clicking match can still trigger embedding enrichment and AI-assisted scoring for legacy data.

---

## 10) Rule-Based + AI Score Combination

Existing rule-based score remains unchanged as the base signal.

If both reports have valid embeddings:

$$
  ext{finalScore} = (1-w)\cdot\text{rulesScore} + w\cdot\text{faceSimilarity}
$$

Where:
- $w$ = `FACE_MATCH_WEIGHT` (default `0.20`, clamped to `0.0` to `0.5`)

If embeddings are unavailable, backend uses only rule-based score.

For selected-missing runs, there is an additional direct-face qualification path:
- if `faceAvailable=true` and `faceSimilarity >= FACE_DIRECT_MATCH_THRESHOLD`, the pair can qualify even when blended score is lower than the route threshold.

Selected-missing matching compares against all found-person records, not only `status=open`.

---

## 11) Setup and Run

1. Create virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure `.env` values.
4. Start service:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8001 --reload
   ```

---

## 12) Environment Variables (AI Service)

- `FACE_SIMILARITY_THRESHOLD` (default: `0.60`)
- `FACE_DET_SIZE` (default: `640`)
- `AI_HTTP_TIMEOUT_SECONDS` (default: `12`)
- `AI_MODEL_NAME` (default: `buffalo_l`)
- `AI_EXECUTION_PROVIDER` (default: `CPUExecutionProvider`)
- `AI_CTX_ID` (default: `0`)
- `AI_SERVICE_PORT` (default: `8001`)

---

## 13) Environment Variables (Main Backend)

- `FACE_AI_SERVICE_URL` (default: `http://localhost:8001`)
- `FACE_AI_TIMEOUT_SECONDS` (default: `12`)
- `FACE_MATCH_WEIGHT` (default: `0.20`, clamped to `0.0..0.5`)
- `FACE_DIRECT_MATCH_THRESHOLD` (default: `0.70`, clamped to `0.0..1.0`)

---

## 14) Practical Test Flow

1. `GET /health` on AI service.
2. Upload two images to backend `/upload` to get Cloudinary URLs.
3. Call `POST /face/compare` with both URLs.
4. Create missing/found reports in backend using same URLs.
5. Verify MongoDB has embedding fields and/or error fields.
6. Run matching and verify AI fields appear in match output.
7. For selected-missing API, confirm comparisons include all found-person records and check `ai.faceAvailable` plus `ai.faceSimilarity`.

---

## 15) Security and Privacy Notes

- Face embeddings are biometric-derived data; treat as sensitive.
- Restrict database/network access in production.
- Use HTTPS between services in deployed environments.
- Add retention and deletion policies for embedding data.

---

## 16) Performance Notes

- First inference may be slower due to model initialization.
- Caching avoids repeated heavy inference per URL.
- CPU provider works, but GPU provider can reduce latency if configured.

---

## 17) Troubleshooting

- Error: connection refused
  - Ensure AI service is running on correct host/port.

- Error: `IMAGE_FETCH_TIMEOUT`
  - Check URL reachability and timeout setting.

- Error: `NO_FACE_DETECTED`
  - Use higher quality face image with frontal visibility.

- Very low similarity for expected same person
  - Check lighting/angle/occlusion and image quality.
  - Compare with multiple photos where possible.

---

## 18) Current Limitations

- Single-face selection strategy (largest face).
- No liveness/spoof detection.
- Threshold may require dataset-specific tuning.

---

## 19) Summary

This service adds production-style, pretrained deep-learning face matching into ResQlink with:
- robust error handling
- embedding cache support
- clear API contracts
- seamless integration with existing rule-based matching

The result is a stronger and more scalable missing/found person matching pipeline.
