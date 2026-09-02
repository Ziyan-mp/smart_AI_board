from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from schemas import (
    AIAnalyzeRequest,
    AIAnalyzeResponse,
    AIDetection,
    AIResultData,
)
from database import engine, Base, get_db
from models import AIRequest, AIResult

from services.modules.math import process_math


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables on startup
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        logger.info("Database tables verified/created successfully.")

    except Exception as e:
        logger.error(f"Error creating tables: {e}")

    yield


app = FastAPI(
    title="Smart Board AI Backend MVP",
    version="1.0.0",
    lifespan=lifespan,
)


# CORS
# For local development and MVP deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "service": "smart-board-ai-backend",
        "module": "math",
    }


@app.post(
    "/api/v1/analyze",
    response_model=AIAnalyzeResponse,
)
async def analyze(
    request: AIAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze handwritten mathematical content.

    Current MVP supports only the math module:
    Pix2Text -> normalization -> SymPy solving.
    """

    # MVP is math-only
    mode = "math"

    try:
        logger.info("[AI] Received analysis request")
        logger.info("[AI] Mode: math")

        # Diagnostic: identify the Python runtime used by Render
        logger.info(f"[AI] Python version: {sys.version}")

        if not request.image:
            raise HTTPException(
                status_code=400,
                detail="An image is required for mathematical analysis.",
            )

        # ----------------------------------------
        # Math AI pipeline
        # ----------------------------------------
        result_dict = process_math(request.image)

        result_data = AIResultData(
            module=result_dict.get("module", "math"),
            result_type=result_dict.get(
                "result_type",
                "analysis",
            ),
            recognized_content=result_dict.get(
                "recognized_content",
                "",
            ),
            explanation=result_dict.get(
                "explanation",
                "",
            ),
            data=result_dict.get(
                "data",
                {},
            ),
        )

        detection = AIDetection(
            recognized_content=result_dict.get(
                "recognized_content",
                "",
            ),
            subject="math",
            content_type="math",
            action="analyze",
            confidence=result_dict.get(
                "confidence",
                None,
            ),
            visual_data=None,
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(
            f"[AI] Math processing error: {e}"
        )

        raise HTTPException(
            status_code=500,
            detail="Mathematical analysis failed.",
        )

    # ----------------------------------------
    # Database audit
    # ----------------------------------------
    #
    # Database failure must NOT prevent a
    # successful AI response.
    #
    try:
        logger.info(
            "[DB] Saving AI request audit..."
        )

        db_request = AIRequest(
            user_id=request.user_id,
            board_id=request.board_id,
            selected_content=request.selected_content,
            recognized_content=detection.recognized_content,
            subject=detection.subject,
            content_type=detection.content_type,
            action=detection.action,
            confidence=detection.confidence,
            status="completed",
        )

        db.add(db_request)

        # Get generated request ID
        await db.flush()

        db_result = AIResult(
            request_id=db_request.id,
            module=result_data.module,
            result_type=result_data.result_type,
            result_data=result_data.data,
            explanation=result_data.explanation,
        )

        db.add(db_result)

        await db.commit()

        logger.info(
            "[DB] AI request audit saved successfully"
        )

    except Exception as e:
        await db.rollback()

        logger.warning(
            f"[DB] Warning: failed to save AI request audit: {e}"
        )

    # ----------------------------------------
    # Return AI result
    # ----------------------------------------

    logger.info("[AI] Returning Math Result")

    return AIAnalyzeResponse(
        success=True,
        detection=detection,
        result=result_data,
        error=None,
    )