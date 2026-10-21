from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import traceback
from app.services.rag_service import answer_question

router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


@router.post("/")
def chat(request: ChatRequest):
    try:
        return answer_question(request.question)
    except ValueError as error:
        raise HTTPException(
            status_code=400, detail=str(error)
        ) from error
    # except Exception:
    #     raise HTTPException(
    #         status_code=500,
    #         detail="The question could not be processed. Check the backend logs.",
    #     )
    except Exception as error:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error