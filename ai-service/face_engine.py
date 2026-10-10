import math
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

import cv2
import numpy as np
import requests
from insightface.app import FaceAnalysis


class FaceEngineError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


@dataclass
class FaceEngineConfig:
    model_name: str = "buffalo_l"
    det_size: int = 640
    provider: str = "CPUExecutionProvider"
    ctx_id: int = 0
    http_timeout_seconds: int = 12
    similarity_threshold: float = 0.60


class FaceEngine:
    def __init__(self, config: FaceEngineConfig):
        self.config = config
        self._app = FaceAnalysis(name=config.model_name, providers=[config.provider])
        self._app.prepare(ctx_id=config.ctx_id, det_size=(config.det_size, config.det_size))

    def _validate_url(self, image_url: str) -> str:
        cleaned = str(image_url or "").strip()
        parsed = urlparse(cleaned)
        if parsed.scheme not in {"http", "https"}:
            raise FaceEngineError("INVALID_IMAGE_URL", "Image URL must be http or https", 400)
        if not parsed.netloc:
            raise FaceEngineError("INVALID_IMAGE_URL", "Image URL is not valid", 400)
        return cleaned

    def _download_image(self, image_url: str) -> bytes:
        url = self._validate_url(image_url)
        try:
            response = requests.get(url, timeout=self.config.http_timeout_seconds)
            response.raise_for_status()
        except requests.Timeout as exc:
            raise FaceEngineError("IMAGE_FETCH_TIMEOUT", "Timed out downloading image", 408) from exc
        except requests.RequestException as exc:
            raise FaceEngineError("IMAGE_FETCH_FAILED", "Could not download image", 400) from exc

        content_type = str(response.headers.get("content-type", "")).lower()
        if content_type and "image" not in content_type:
            raise FaceEngineError("UNSUPPORTED_IMAGE", "URL did not return an image", 415)
        return response.content

    def _decode_image(self, image_bytes: bytes) -> np.ndarray:
        if not image_bytes:
            raise FaceEngineError("BROKEN_IMAGE", "Image is empty", 415)

        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise FaceEngineError("BROKEN_IMAGE", "Image could not be decoded", 415)
        return image

    def _largest_face(self, faces: List[Any]) -> Tuple[Any, int]:
        if not faces:
            raise FaceEngineError("NO_FACE_DETECTED", "No face detected in image", 422)

        def area(face: Any) -> float:
            x1, y1, x2, y2 = [float(v) for v in face.bbox]
            return max(0.0, x2 - x1) * max(0.0, y2 - y1)

        sorted_faces = sorted(faces, key=area, reverse=True)
        return sorted_faces[0], len(sorted_faces)

    @staticmethod
    def _normalize_vector(vector: np.ndarray) -> np.ndarray:
        norm = float(np.linalg.norm(vector))
        if norm <= 0.0:
            raise FaceEngineError("INVALID_EMBEDDING", "Embedding norm is zero", 500)
        return vector / norm

    @staticmethod
    def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        sim = float(np.dot(emb1, emb2))
        if math.isnan(sim) or math.isinf(sim):
            return 0.0
        return max(-1.0, min(1.0, sim))

    def extract_embedding(self, image_url: str) -> Dict[str, Any]:
        image_bytes = self._download_image(image_url)
        image = self._decode_image(image_bytes)

        try:
            faces = self._app.get(image)
        except Exception as exc:
            raise FaceEngineError("FACE_ENGINE_ERROR", "Face model inference failed", 500) from exc

        primary_face, face_count = self._largest_face(faces)
        embedding = np.asarray(primary_face.embedding, dtype=np.float32)
        embedding = self._normalize_vector(embedding)

        return {
            "faceDetected": True,
            "facesDetected": face_count,
            "faceEmbedding": embedding.astype(np.float32).tolist(),
            "faceEmbeddingModel": "ArcFace",
        }

    def compare(self, missing_image_url: str, found_image_url: str) -> Dict[str, Any]:
        missing = self.extract_embedding(missing_image_url)
        found = self.extract_embedding(found_image_url)

        emb1 = np.asarray(missing["faceEmbedding"], dtype=np.float32)
        emb2 = np.asarray(found["faceEmbedding"], dtype=np.float32)
        similarity = self.cosine_similarity(emb1, emb2)
        confidence = round(max(0.0, similarity) * 100.0, 1)

        return {
            "matched": bool(similarity >= self.config.similarity_threshold),
            "similarity": round(similarity, 6),
            "confidence": confidence,
        }
