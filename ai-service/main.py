import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from face_engine import FaceEngine, FaceEngineConfig, FaceEngineError

load_dotenv()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CompareRequest(BaseModel):
    missingImageUrl: str
    foundImageUrl: str


class EmbedRequest(BaseModel):
    imageUrl: str


app = FastAPI(title="ResQlink Face Recognition Service")

engine = FaceEngine(
    FaceEngineConfig(
        model_name=os.getenv("AI_MODEL_NAME", "buffalo_l"),
        det_size=int(os.getenv("FACE_DET_SIZE", "640")),
        provider=os.getenv("AI_EXECUTION_PROVIDER", "CPUExecutionProvider"),
        ctx_id=int(os.getenv("AI_CTX_ID", "0")),
        http_timeout_seconds=int(os.getenv("AI_HTTP_TIMEOUT_SECONDS", "12")),
        similarity_threshold=float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.60")),
    )
)

# fUv@hBNN65xi3/r
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "face-recognition",
    }


@app.post("/face/embed")
def face_embed(payload: EmbedRequest):
    try:
        result = engine.extract_embedding(payload.imageUrl)
        result["faceProcessedAt"] = _utc_now_iso()
        return result
    except FaceEngineError as exc:
        if exc.code == "NO_FACE_DETECTED":
            return {
                "faceDetected": False,
                "faceProcessingError": "NO_FACE_DETECTED",
                "faceProcessedAt": _utc_now_iso(),
            }
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.code,
                "message": exc.message,
            },
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content={
                "error": "INTERNAL_ERROR",
                "message": "Unexpected AI processing failure",
            },
        )


@app.post("/face/compare")
def face_compare(payload: CompareRequest):
    try:
        return engine.compare(payload.missingImageUrl, payload.foundImageUrl)
    except FaceEngineError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.code,
                "message": exc.message,
            },
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content={
                "error": "INTERNAL_ERROR",
                "message": "Unexpected AI processing failure",
            },
        )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
