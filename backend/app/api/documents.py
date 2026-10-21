
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.document_service import extract_text


router = APIRouter(
    prefix="/api/v1/documents",
    tags=["Documents"]
)

BASE_DIR = Path(__file__).resolve().parents[2]

RAW_DIR = BASE_DIR.parent / "documents" / "raw"
PROCESSED_DIR = BASE_DIR.parent / "documents" / "processed"

RAW_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()

    if not original_name or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Upload a PDF, DOCX, TXT, or CSV file."
        )

    document_id = str(uuid.uuid4())
    storage_name = f"{document_id}{extension}"
    file_path = RAW_DIR / storage_name

    size = 0

    try:
        with file_path.open("wb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                size += len(chunk)

                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File exceeds the 20 MB limit."
                    )

                destination.write(chunk)

        sections = extract_text(str(file_path))

        if not sections:
            raise HTTPException(
                status_code=422,
                detail="No text extracted. The file may be empty or scanned."
            )

        output = {
            "document_id": document_id,
            "filename": original_name,
            "file_type": extension[1:],
            "size_bytes": size,
            "sections": sections,
        }

        output_path = PROCESSED_DIR / f"{document_id}.json"

        output_path.write_text(
            json.dumps(output, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

        return {
            "message": "Document uploaded and processed successfully.",
            "document_id": document_id,
            "filename": original_name,
            "file_type": extension[1:],
            "sections_extracted": len(sections),
            "text_characters": sum(
                len(section["text"]) for section in sections
            ),
        }

    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise

    except Exception as error:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail=f"Could not process the document: {error}"
        ) from error

    finally:
        await file.close()
