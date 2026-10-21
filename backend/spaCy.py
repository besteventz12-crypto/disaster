import io
import math
import os
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse

from bson import ObjectId
import cloudinary
import cloudinary.uploader
import requests
import spacy
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "").strip()
CLOUDINARY_FOLDER = os.getenv("CLOUDINARY_FOLDER", "disaster-management")
FACE_AI_SERVICE_URL = os.getenv("FACE_AI_SERVICE_URL", "http://localhost:8001").rstrip("/")
FACE_AI_TIMEOUT_SECONDS = float(os.getenv("FACE_AI_TIMEOUT_SECONDS", "12"))
FACE_MATCH_WEIGHT = max(0.0, min(0.5, float(os.getenv("FACE_MATCH_WEIGHT", "0.20"))))
FACE_DIRECT_MATCH_THRESHOLD = max(0.0, min(1.0, float(os.getenv("FACE_DIRECT_MATCH_THRESHOLD", "0.70"))))

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is not set in environment.")

if CLOUDINARY_URL and (not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET):
    parsed = urlparse(CLOUDINARY_URL)
    if parsed.scheme == "cloudinary":
        CLOUDINARY_CLOUD_NAME = CLOUDINARY_CLOUD_NAME or (parsed.hostname or "")
        CLOUDINARY_API_KEY = CLOUDINARY_API_KEY or (unquote(parsed.username) if parsed.username else "")
        CLOUDINARY_API_SECRET = CLOUDINARY_API_SECRET or (unquote(parsed.password) if parsed.password else "")

if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
    raise RuntimeError("Cloudinary credentials are not fully set in environment.")

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True,
)

client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=5000,
)
db = client.get_database("disaster_management")
queries_collection = db["nlp_queries"]
files_collection = db["uploaded_files"]
users_collection = db["users"]
sos_alerts_collection = db["sos_alerts"]
warnings_collection = db["warnings"]
missing_persons_collection = db["missing_person_reports"]
found_persons_collection = db["found_person_reports"]
matches_collection = db["person_matches"]
shelters_collection = db["shelters"]
face_embeddings_cache_collection = db["face_embeddings_cache"]

nlp = spacy.load("en_core_web_sm")
disaster_keywords = [
    "flood",
    "earthquake",
    "fire",
    "landslide",
    "cyclone",
    "tsunami",
    "storm",
]


def _iso_now():
    return datetime.now(timezone.utc).isoformat()


def _extract_disaster_data(user_text):
    doc = nlp(user_text)
    entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]
    lowered = user_text.lower()
    detected_type = next(
        (word for word in disaster_keywords if word in lowered),
        "unknown",
    )
    return entities, detected_type


def process_text(user_text):
    entities, detected_type = _extract_disaster_data(user_text)
    record = {
        "query": user_text,
        "entities": entities,
        "disaster_type": detected_type,
        "created_at": _iso_now(),
    }
    insert_result = queries_collection.insert_one(record)
    record["_id"] = str(insert_result.inserted_id)
    return record


def process_bytes(file_bytes, filename="upload.bin", content_type="application/octet-stream"):
    upload_stream = io.BytesIO(file_bytes)
    upload_result = cloudinary.uploader.upload(
        upload_stream,
        folder=CLOUDINARY_FOLDER,
        resource_type="auto",
        filename_override=filename,
        use_filename=True,
    )

    record = {
        "filename": filename,
        "content_type": content_type,
        "bytes": len(file_bytes),
        "cloudinary_public_id": upload_result.get("public_id"),
        "cloudinary_url": upload_result.get("secure_url"),
        "created_at": _iso_now(),
    }
    insert_result = files_collection.insert_one(record)
    record["_id"] = str(insert_result.inserted_id)
    return record


def health_check():
    client.admin.command("ping")
    return {
        "mongo": "ok",
        "cloudinary": "configured",
    }


def create_user_record(payload):
    record = {
        **payload,
        "created_at": _iso_now(),
    }
    insert_result = users_collection.insert_one(record)
    record["_id"] = str(insert_result.inserted_id)
    return record


def create_sos_alert(payload):
    record = {
        **payload,
        "created_at": _iso_now(),
    }
    insert_result = sos_alerts_collection.insert_one(record)
    record["_id"] = str(insert_result.inserted_id)
    return record


def list_sos_alerts(limit=200):
    docs = sos_alerts_collection.find().sort("created_at", -1).limit(limit)
    return [_to_id_string(doc) for doc in docs]


def get_sos_alert_by_id(alert_id):
    try:
        obj_id = ObjectId(str(alert_id))
    except Exception as exc:
        raise ValueError("Invalid SOS alert id") from exc

    doc = sos_alerts_collection.find_one({"_id": obj_id})
    if not doc:
        return None
    return _to_id_string(doc)


def _clean_warnings(warnings):
    if not isinstance(warnings, list):
        return []
    cleaned = [str(item).strip() for item in warnings if str(item).strip()]
    return cleaned


def get_warnings():
    doc = warnings_collection.find_one({"key": "global_warnings"})
    if not doc:
        return []
    return _clean_warnings(doc.get("warnings", []))


def save_warnings(warnings):
    cleaned = _clean_warnings(warnings)
    warnings_collection.update_one(
        {"key": "global_warnings"},
        {
            "$set": {
                "warnings": cleaned,
                "updated_at": _iso_now(),
            },
            "$setOnInsert": {"created_at": _iso_now()},
        },
        upsert=True,
    )
    return cleaned


def _to_id_string(doc):
    if not doc:
        return doc
    out = {**doc}
    if "_id" in out:
        out["_id"] = str(out["_id"])
    return out


def _normalize_text(value):
    return str(value or "").strip().lower()


def _token_set(text):
    normalized = _normalize_text(text)
    if not normalized:
        return set()
    tokens = [tok for tok in normalized.replace(",", " ").split() if tok]
    return set(tokens)


def _jaccard_similarity(a, b):
    sa = _token_set(a)
    sb = _token_set(b)
    if not sa and not sb:
        return 0.0
    union = sa.union(sb)
    if not union:
        return 0.0
    return len(sa.intersection(sb)) / len(union)


def _haversine_km(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2):
        return 50.0
    r = 6371.0
    dlat = math.radians(float(lat2) - float(lat1))
    dlon = math.radians(float(lon2) - float(lon1))
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(float(lat1)))
        * math.cos(math.radians(float(lat2)))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _hours_diff(ts1, ts2):
    try:
        if not ts1 or not ts2:
            return 48.0
        dt1 = datetime.fromisoformat(str(ts1).replace("Z", "+00:00"))
        dt2 = datetime.fromisoformat(str(ts2).replace("Z", "+00:00"))
        return abs((dt1 - dt2).total_seconds()) / 3600.0
    except Exception:
        return 48.0


def _normalize_embedding_vector(vector):
    if not isinstance(vector, list) or not vector:
        return []

    cleaned = []
    for value in vector:
        try:
            cleaned.append(float(value))
        except (TypeError, ValueError):
            return []

    norm = math.sqrt(sum(v * v for v in cleaned))
    if norm <= 0.0:
        return []
    return [v / norm for v in cleaned]


def _cosine_similarity_vectors(a, b):
    if not isinstance(a, list) or not isinstance(b, list):
        return 0.0
    if not a or not b or len(a) != len(b):
        return 0.0

    score = sum(float(x) * float(y) for x, y in zip(a, b))
    if math.isnan(score) or math.isinf(score):
        return 0.0
    return max(-1.0, min(1.0, float(score)))


def _cached_embedding_for_photo(photo_url):
    doc = face_embeddings_cache_collection.find_one({"photoUrl": photo_url})
    if not doc:
        return None
    return _to_id_string(doc)


def _fetch_face_embedding_from_ai(photo_url):
    endpoint = f"{FACE_AI_SERVICE_URL}/face/embed"
    payload = {"imageUrl": photo_url}

    try:
        response = requests.post(endpoint, json=payload, timeout=FACE_AI_TIMEOUT_SECONDS)
    except requests.Timeout:
        return {
            "faceDetected": False,
            "faceProcessingError": "AI_TIMEOUT",
        }
    except requests.RequestException:
        return {
            "faceDetected": False,
            "faceProcessingError": "AI_SERVICE_UNAVAILABLE",
        }

    try:
        body = response.json()
    except ValueError:
        body = {}

    if not response.ok:
        return {
            "faceDetected": False,
            "faceProcessingError": str(body.get("error") or "AI_PROCESSING_FAILED"),
        }

    if body.get("faceDetected") is False:
        return {
            "faceDetected": False,
            "faceProcessingError": str(body.get("faceProcessingError") or "NO_FACE_DETECTED"),
            "faceProcessedAt": body.get("faceProcessedAt") or _iso_now(),
        }

    embedding = _normalize_embedding_vector(body.get("faceEmbedding") or [])
    if not embedding:
        return {
            "faceDetected": False,
            "faceProcessingError": "INVALID_EMBEDDING",
        }

    return {
        "faceDetected": True,
        "faceEmbedding": embedding,
        "faceEmbeddingModel": str(body.get("faceEmbeddingModel") or "ArcFace"),
        "faceProcessedAt": body.get("faceProcessedAt") or _iso_now(),
    }


def _attach_face_embedding_fields(record):
    photo_url = str(record.get("photoUrl") or "").strip()
    if not photo_url:
        record["faceDetected"] = False
        record["faceProcessingError"] = "NO_IMAGE_URL"
        return record

    cached = _cached_embedding_for_photo(photo_url)
    if cached:
        record["faceDetected"] = bool(cached.get("faceDetected"))
        record["faceEmbeddingModel"] = cached.get("faceEmbeddingModel") or "ArcFace"
        record["faceProcessedAt"] = cached.get("faceProcessedAt") or _iso_now()
        if record["faceDetected"]:
            record["faceEmbedding"] = cached.get("faceEmbedding") or []
            record.pop("faceProcessingError", None)
        else:
            record["faceProcessingError"] = cached.get("faceProcessingError") or "NO_FACE_DETECTED"
        return record

    processed = _fetch_face_embedding_from_ai(photo_url)
    cache_doc = {
        "photoUrl": photo_url,
        "faceDetected": bool(processed.get("faceDetected")),
        "faceEmbedding": processed.get("faceEmbedding") or [],
        "faceEmbeddingModel": processed.get("faceEmbeddingModel") or "ArcFace",
        "faceProcessedAt": processed.get("faceProcessedAt") or _iso_now(),
        "faceProcessingError": processed.get("faceProcessingError") or "",
        "updatedAt": _iso_now(),
    }
    face_embeddings_cache_collection.update_one(
        {"photoUrl": photo_url},
        {
            "$set": cache_doc,
            "$setOnInsert": {"createdAt": _iso_now()},
        },
        upsert=True,
    )

    record["faceDetected"] = cache_doc["faceDetected"]
    record["faceEmbeddingModel"] = cache_doc["faceEmbeddingModel"]
    record["faceProcessedAt"] = cache_doc["faceProcessedAt"]
    if cache_doc["faceDetected"]:
        record["faceEmbedding"] = cache_doc["faceEmbedding"]
        record.pop("faceProcessingError", None)
    else:
        record["faceProcessingError"] = cache_doc["faceProcessingError"] or "NO_FACE_DETECTED"
    return record


def _ensure_face_fields_for_existing_report(report, collection):
    if not report:
        return report

    has_flag = isinstance(report.get("faceDetected"), bool)
    has_embedding = isinstance(report.get("faceEmbedding"), list) and len(report.get("faceEmbedding", [])) > 0
    has_photo = bool(str(report.get("photoUrl") or "").strip())

    if has_flag and (has_embedding or not has_photo):
        return report

    updated = dict(report)
    _attach_face_embedding_fields(updated)

    set_payload = {
        "faceDetected": bool(updated.get("faceDetected", False)),
        "faceEmbeddingModel": updated.get("faceEmbeddingModel") or "ArcFace",
        "faceProcessedAt": updated.get("faceProcessedAt") or _iso_now(),
    }
    if isinstance(updated.get("faceEmbedding"), list) and updated.get("faceEmbedding"):
        set_payload["faceEmbedding"] = updated.get("faceEmbedding")
        unset_payload = {"faceProcessingError": ""}
    else:
        set_payload["faceProcessingError"] = updated.get("faceProcessingError") or "NO_FACE_DETECTED"
        unset_payload = {"faceEmbedding": ""}

    collection.update_one(
        {"_id": report.get("_id")},
        {
            "$set": set_payload,
            "$unset": unset_payload,
        },
    )
    return updated


def create_missing_person_report(payload):
    record = {
        **payload,
        "status": "open",
        "created_at": _iso_now(),
    }
    _attach_face_embedding_fields(record)
    insert_result = missing_persons_collection.insert_one(record)
    record["_id"] = str(insert_result.inserted_id)
    return record


def create_found_person_report(payload):
    record = {
        **payload,
        "status": "open",
        "created_at": _iso_now(),
    }
    _attach_face_embedding_fields(record)
    insert_result = found_persons_collection.insert_one(record)
    record["_id"] = str(insert_result.inserted_id)
    return record


def create_shelter(payload):
    record = {
        **payload,
        "name": str(payload.get("name") or "Unnamed Shelter").strip(),
        "address": str(payload.get("address") or "").strip(),
        "contact": str(payload.get("contact") or "").strip(),
        "capacity": int(payload.get("capacity") or 0),
        "notes": str(payload.get("notes") or "").strip(),
        "created_at": _iso_now(),
    }
    insert_result = shelters_collection.insert_one(record)
    record["_id"] = str(insert_result.inserted_id)
    return record


def list_shelters(limit=200):
    docs = shelters_collection.find().sort("created_at", -1).limit(limit)
    return [_to_id_string(doc) for doc in docs]


def list_shelters_nearby(latitude, longitude, radius_km=5.0, limit=100):
    lat = float(latitude)
    lng = float(longitude)
    radius = max(0.5, float(radius_km))

    items = []
    for doc in shelters_collection.find().limit(max(limit * 4, limit)):
        s_lat = doc.get("latitude")
        s_lng = doc.get("longitude")
        if s_lat is None or s_lng is None:
            continue
        distance_km = _haversine_km(lat, lng, float(s_lat), float(s_lng))
        if distance_km <= radius:
            out = _to_id_string(doc)
            out["distanceKm"] = round(float(distance_km), 2)
            items.append(out)

    items.sort(key=lambda item: item.get("distanceKm", 9999))
    return items[:limit]


def list_missing_person_reports(limit=100):
    docs = missing_persons_collection.find().sort("created_at", -1).limit(limit)
    return [_to_id_string(doc) for doc in docs]


def list_found_person_reports(limit=100):
    docs = found_persons_collection.find().sort("created_at", -1).limit(limit)
    return [_to_id_string(doc) for doc in docs]


def delete_missing_person_report(missing_person_id):
    try:
        obj_id = ObjectId(str(missing_person_id))
    except Exception as exc:
        raise ValueError("Invalid missing person id") from exc

    result = missing_persons_collection.delete_one({"_id": obj_id})
    if result.deleted_count:
        matches_collection.delete_many({"missingPersonId": str(missing_person_id)})
        return True
    return False


def delete_found_person_report(found_person_id):
    try:
        obj_id = ObjectId(str(found_person_id))
    except Exception as exc:
        raise ValueError("Invalid found person id") from exc

    result = found_persons_collection.delete_one({"_id": obj_id})
    if result.deleted_count:
        matches_collection.delete_many({"foundPersonId": str(found_person_id)})
        return True
    return False


def _build_match_features(missing, found):
    age_diff = abs(float((missing.get("age") or 0)) - float((found.get("estimatedAge") or 0)))
    clothing_sim = _jaccard_similarity(missing.get("clothingDescription"), found.get("clothingDescription"))
    physical_sim = _jaccard_similarity(missing.get("physicalDescription"), found.get("physicalDescription"))
    distance_km = _haversine_km(
        missing.get("latitude"),
        missing.get("longitude"),
        found.get("latitude"),
        found.get("longitude"),
    )
    time_diff_hours = _hours_diff(missing.get("seenAt"), found.get("foundAt"))

    missing_penalty = 0.0
    for key in ["age", "clothingDescription", "physicalDescription", "latitude", "longitude", "seenAt"]:
        if missing.get(key) in (None, ""):
            missing_penalty += 0.5
    for key in ["estimatedAge", "clothingDescription", "physicalDescription", "latitude", "longitude", "foundAt"]:
        if found.get(key) in (None, ""):
            missing_penalty += 0.5

    missing_embedding = _normalize_embedding_vector(missing.get("faceEmbedding") or [])
    found_embedding = _normalize_embedding_vector(found.get("faceEmbedding") or [])
    face_similarity = 0.0
    face_available = False
    if missing.get("faceDetected") and found.get("faceDetected") and missing_embedding and found_embedding:
        face_similarity = _cosine_similarity_vectors(missing_embedding, found_embedding)
        face_available = True

    missing_has_photo = bool(str(missing.get("photoUrl") or "").strip())
    found_has_photo = bool(str(found.get("photoUrl") or "").strip())
    photo_pair_without_face = missing_has_photo and found_has_photo and (not face_available)

    return {
        "age_diff": age_diff,
        "clothing_sim": clothing_sim,
        "physical_sim": physical_sim,
        "distance_km": distance_km,
        "time_diff_hours": time_diff_hours,
        "missing_data_penalty": missing_penalty,
        "face_similarity": face_similarity,
        "face_available": face_available,
        "photo_pair_without_face": photo_pair_without_face,
    }


def _score_from_features(features):
    age_score = max(0.0, 1.0 - float(features["age_diff"]) / 40.0)
    distance_score = max(0.0, 1.0 - float(features["distance_km"]) / 80.0)
    time_score = max(0.0, 1.0 - float(features["time_diff_hours"]) / 240.0)
    penalty_score = max(0.0, 1.0 - float(features["missing_data_penalty"]) / 5.0)
    rules_score = (
        0.2 * age_score
        + 0.25 * float(features["clothing_sim"])
        + 0.25 * float(features["physical_sim"])
        + 0.15 * distance_score
        + 0.1 * time_score
        + 0.05 * penalty_score
    )
    if features.get("face_available"):
        combined = (1.0 - FACE_MATCH_WEIGHT) * rules_score + FACE_MATCH_WEIGHT * float(features.get("face_similarity", 0.0))
    else:
        combined = rules_score

    # If both sides have photos but no face could be extracted, penalize score to reduce false positives from random images.
    if features.get("photo_pair_without_face"):
        combined *= 0.45

    return max(0.0, min(1.0, combined))


def _build_match_doc(missing, found, score, features):
    missing_id = str(missing["_id"])
    found_id = str(found["_id"])
    return {
        "pair_key": f"{missing_id}:{found_id}",
        "missingPersonId": missing_id,
        "foundPersonId": found_id,
        "score": score,
        "status": "matched",
        "missing": {
            "personName": missing.get("personName", "Unknown"),
            "photoUrl": missing.get("photoUrl", ""),
            "contact": missing.get("contact", {}),
            "lastSeenLocation": missing.get("lastSeenLocation", ""),
        },
        "found": {
            "personName": found.get("personName", "Unknown"),
            "photoUrl": found.get("photoUrl", ""),
            "contact": found.get("contact", {}),
            "foundLocation": found.get("foundLocation", ""),
        },
        "features": features,
        "ai": {
            "faceModel": (missing.get("faceEmbeddingModel") or found.get("faceEmbeddingModel") or "ArcFace"),
            "faceSimilarity": float(features.get("face_similarity", 0.0)),
            "faceAvailable": bool(features.get("face_available", False)),
        },
        "created_at": _iso_now(),
    }


def run_person_matching(threshold=0.62):
    missing_reports = list(missing_persons_collection.find({"status": "open"}))
    found_reports = list(found_persons_collection.find({"status": "open"}))

    created_matches = []
    prepared_missing = [
        _ensure_face_fields_for_existing_report(item, missing_persons_collection) for item in missing_reports
    ]
    prepared_found = [
        _ensure_face_fields_for_existing_report(item, found_persons_collection) for item in found_reports
    ]

    for missing in prepared_missing:
        for found in prepared_found:
            features = _build_match_features(missing, found)
            score = _score_from_features(features)
            if score < threshold:
                continue

            missing_id = str(missing["_id"])
            found_id = str(found["_id"])
            pair_key = f"{missing_id}:{found_id}"
            existing = matches_collection.find_one({"pair_key": pair_key})
            if existing:
                matches_collection.update_one(
                    {"_id": existing.get("_id")},
                    {
                        "$set": {
                            "score": score,
                            "features": features,
                            "ai": {
                                "faceModel": (missing.get("faceEmbeddingModel") or found.get("faceEmbeddingModel") or "ArcFace"),
                                "faceSimilarity": float(features.get("face_similarity", 0.0)),
                                "faceAvailable": bool(features.get("face_available", False)),
                            },
                            "status": "matched",
                            "updated_at": _iso_now(),
                        }
                    },
                )
                refreshed = matches_collection.find_one({"_id": existing.get("_id")})
                created_matches.append(_to_id_string(refreshed or existing))

                missing_persons_collection.update_one({"_id": missing["_id"]}, {"$set": {"status": "matched", "matched_at": _iso_now()}})
                found_persons_collection.update_one({"_id": found["_id"]}, {"$set": {"status": "matched", "matched_at": _iso_now()}})
                continue

            match_doc = _build_match_doc(missing, found, score, features)
            insert_result = matches_collection.insert_one(match_doc)
            match_doc["_id"] = str(insert_result.inserted_id)
            created_matches.append(match_doc)

            missing_persons_collection.update_one({"_id": missing["_id"]}, {"$set": {"status": "matched", "matched_at": _iso_now()}})
            found_persons_collection.update_one({"_id": found["_id"]}, {"$set": {"status": "matched", "matched_at": _iso_now()}})

    created_matches.sort(key=lambda item: item.get("score", 0), reverse=True)
    return created_matches


def list_person_matches(limit=100):
    docs = matches_collection.find().sort("created_at", -1).limit(limit)
    return [_to_id_string(doc) for doc in docs]


def run_person_matching_for_missing(missing_person_id, threshold=0.62):
    try:
        from bson import ObjectId

        missing = missing_persons_collection.find_one({"_id": ObjectId(missing_person_id)})
    except Exception:
        missing = None

    if not missing:
        return []

    missing = _ensure_face_fields_for_existing_report(missing, missing_persons_collection)

    found_reports = list(found_persons_collection.find())
    prepared_found = [
        _ensure_face_fields_for_existing_report(item, found_persons_collection) for item in found_reports
    ]
    created_matches = []
    for found in prepared_found:
        features = _build_match_features(missing, found)
        score = _score_from_features(features)
        face_score = float(features.get("face_similarity", 0.0)) if features.get("face_available") else 0.0
        qualifies = (score >= threshold) or (features.get("face_available") and face_score >= FACE_DIRECT_MATCH_THRESHOLD)
        if not qualifies:
            continue

        effective_score = max(score, face_score)

        missing_id = str(missing["_id"])
        found_id = str(found["_id"])
        pair_key = f"{missing_id}:{found_id}"
        existing = matches_collection.find_one({"pair_key": pair_key})
        if existing:
            matches_collection.update_one(
                {"_id": existing.get("_id")},
                {
                    "$set": {
                        "score": effective_score,
                        "features": features,
                        "ai": {
                            "faceModel": (missing.get("faceEmbeddingModel") or found.get("faceEmbeddingModel") or "ArcFace"),
                            "faceSimilarity": float(features.get("face_similarity", 0.0)),
                            "faceAvailable": bool(features.get("face_available", False)),
                        },
                        "status": "matched",
                        "updated_at": _iso_now(),
                    }
                },
            )
            refreshed = matches_collection.find_one({"_id": existing.get("_id")})
            created_matches.append(_to_id_string(refreshed or existing))

            missing_persons_collection.update_one({"_id": missing["_id"]}, {"$set": {"status": "matched", "matched_at": _iso_now()}})
            found_persons_collection.update_one({"_id": found["_id"]}, {"$set": {"status": "matched", "matched_at": _iso_now()}})
            continue

        match_doc = _build_match_doc(missing, found, effective_score, features)
        insert_result = matches_collection.insert_one(match_doc)
        match_doc["_id"] = str(insert_result.inserted_id)
        created_matches.append(match_doc)

        missing_persons_collection.update_one({"_id": missing["_id"]}, {"$set": {"status": "matched", "matched_at": _iso_now()}})
        found_persons_collection.update_one({"_id": found["_id"]}, {"$set": {"status": "matched", "matched_at": _iso_now()}})

    created_matches.sort(key=lambda item: item.get("score", 0), reverse=True)
    return created_matches
