from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router
app = FastAPI(
    title="Enterprise Knowledge Assistant API",
    description="Backend API for an AI-powered enterprise knowledge assistant using RAG.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(documents_router)
app.include_router(chat_router)
@app.get("/")
def root():
    return {
        "message": "Enterprise Knowledge Assistant API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "backend",
    }