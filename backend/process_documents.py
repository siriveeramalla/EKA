
import json
import uuid
from pathlib import Path

from app.services.document_service import extract_text


BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "documents" / "raw"
PROCESSED_DIR = BASE_DIR / "documents" / "processed"

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv"}


def process_all_documents():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    files = [
        path for path in RAW_DIR.iterdir()
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not files:
        print(f"No supported documents found in: {RAW_DIR}")
        return

    successful = 0
    failed = 0

    for file_path in files:
        document_id = str(uuid.uuid4())

        try:
            sections = extract_text(str(file_path))

            if not sections:
                print(f"[SKIPPED] No text extracted: {file_path.name}")
                failed += 1
                continue

            result = {
                "document_id": document_id,
                "filename": file_path.name,
                "file_type": file_path.suffix.lower()[1:],
                "sections": sections,
            }

            output_path = PROCESSED_DIR / f"{document_id}.json"
            output_path.write_text(
                json.dumps(result, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            print(
                f"[SUCCESS] {file_path.name}: "
                f"{len(sections)} sections extracted"
            )
            successful += 1

        except Exception as error:
            print(f"[FAILED] {file_path.name}: {error}")
            failed += 1

    print("\n--- Processing Summary ---")
    print(f"Total files found: {len(files)}")
    print(f"Successfully processed: {successful}")
    print(f"Failed or skipped: {failed}")


if __name__ == "__main__":
    process_all_documents()
