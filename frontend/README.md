# Knowly — Enterprise Knowledge Assistant

A Next.js + TypeScript frontend for the FastAPI RAG backend.

## Included screens

- **Ask knowledge base:** chat with suggested questions, answer feedback controls, and a source/evidence panel.
- **Knowledge base:** upload PDF, DOCX, TXT, and CSV files; view upload metadata and indexing reminders.
- **Analytics:** connectivity and session-upload indicators, plus an explicit roadmap of metrics that still need backend instrumentation. No fabricated live usage statistics are shown.
- **Settings:** backend health, API endpoint configuration, local UI preference, and security/deployment checklist.

## Requirements

- Node.js 20.9+ (Node 22 recommended)
- FastAPI backend running at `http://127.0.0.1:8000`

## Setup

1. Install packages:
   ```bash
   npm install
   ```
2. Copy `.env.local.example` to `.env.local`:
   ```powershell
   Copy-Item .env.local.example .env.local
   ```
3. Start the frontend:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

## Backend connection

The browser calls FastAPI directly using `NEXT_PUBLIC_API_BASE_URL` (default `http://127.0.0.1:8000`). The UI polls `/health` every 15 seconds and displays actual connectivity status. The chat endpoint is `POST /api/v1/chat/`; upload is `POST /api/v1/documents/upload`.

In `backend/app/main.py`, allow the Next.js development origin:

```python
allow_origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
]
```

## Important backend limitations

- A successful upload extracts text and stores a processed JSON file, but **does not automatically re-index ChromaDB**. The UI tells the user to run `python process_documents.py` and `python build_vector_db.py` from the backend folder.
- The current backend has no document-list endpoint, so the Knowledge Base table lists uploads from the current browser session only. It is not a persistent server-side library yet.
- Analytics values such as query volume, response latency, retrieval quality, and helpfulness trends require backend event persistence and are shown as unavailable/planned rather than invented.
- Authentication, role-based permissions, and persistent conversations/feedback still need implementation before public or multi-user deployment.
- Chat generation requires a functioning configured LLM (OpenAI API credits or a working local Ollama model).


## Specification-aligned workspace update

The main chat view uses a three-column desktop layout: left navigation, central conversation, and a right-side Sources & citations panel. The sources panel displays retrieved chunks returned by FastAPI, a retrieval-relevance estimate derived from distance when available, source excerpts, copy actions, and session-only feedback controls.

The app also includes navigation views for Knowledge Base, Documents, Analytics, Settings, User Profile, and a sign-in UI preview. Authentication, persisted chat history, backend document listing, real document preview links, feedback persistence, analytics metrics, and server-side RBAC are not implemented by this frontend alone and require backend services.

Set `NEXT_PUBLIC_API_BASE_URL` in `.env.local` to your FastAPI origin. The frontend uses `/health`, `/api/v1/chat/`, and `/api/v1/documents/upload`.
