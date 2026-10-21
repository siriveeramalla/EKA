
import os
from ollama import AsyncClient

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

client = AsyncClient(host="http://localhost:11434")


async def generate_answer(question: str, context: str) -> str:
    response = await client.chat(
        model=OLLAMA_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an enterprise knowledge assistant. "
                    "Answer using only the provided document context. "
                    "If the context does not contain the answer, "
                    "say that the information was not found. "
                    "Do not invent policies, facts, or citations."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"DOCUMENT CONTEXT:\n{context}\n\n"
                    f"QUESTION:\n{question}\n\n"
                    "Answer clearly and identify the relevant source "
                    "documents when their names are provided in context."
                ),
            },
        ],
        options={"temperature": 0.1},
    )

    return response.message.content
