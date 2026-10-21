
import json
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer


BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR / "documents" / "processed"
VECTOR_DIR = BASE_DIR / "vector_db"

COLLECTION_NAME = "enterprise_knowledge"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

CHUNK_SIZE = 180
CHUNK_OVERLAP = 30
BATCH_SIZE = 64


def split_into_chunks(text):
    """Split text into overlapping word-based chunks."""
    words = text.split()

    if not words:
        return []

    chunks = []
    start = 0

    while start < len(words):
        end = min(start + CHUNK_SIZE, len(words))
        chunk = " ".join(words[start:end])

        if chunk.strip():
            chunks.append(chunk)

        if end == len(words):
            break

        start = end - CHUNK_OVERLAP

    return chunks


def main():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    json_files = sorted(PROCESSED_DIR.glob("*.json"))

    if not json_files:
        print("No processed JSON files found.")
        print(f"Expected directory: {PROCESSED_DIR}")
        return

    records = []

    for json_file in json_files:
        try:
            data = json.loads(
                json_file.read_text(encoding="utf-8")
            )

            document_id = data.get(
                "document_id", json_file.stem
            )
            filename = data.get(
                "filename", json_file.stem
            )

            for section_index, section in enumerate(
                data.get("sections", [])
            ):
                text = section.get("text", "")
                location = section.get(
                    "location", "Unknown location"
                )

                chunks = split_into_chunks(text)

                for chunk_index, chunk in enumerate(chunks):
                    records.append({
                        "id": (
                            f"{document_id}_"
                            f"{section_index}_{chunk_index}"
                        ),
                        "text": chunk,
                        "metadata": {
                            "document_id": str(document_id),
                            "source": str(filename),
                            "location": str(location),
                            "section_index": section_index,
                            "chunk_index": chunk_index,
                        },
                    })

        except (json.JSONDecodeError, OSError, ValueError) as error:
            print(f"[SKIPPED] {json_file.name}: {error}")

    if not records:
        print("No text chunks were created.")
        return

    print(f"Processed JSON files: {len(json_files)}")
    print(f"Text chunks created: {len(records)}")
    print("Loading embedding model...")

    model = SentenceTransformer(MODEL_NAME)

    client = chromadb.PersistentClient(
        path=str(VECTOR_DIR)
    )

    # Rebuild the collection so rerunning this script does not
    # leave outdated chunks from previous indexing runs.
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    for start in range(0, len(records), BATCH_SIZE):
        batch = records[start:start + BATCH_SIZE]
        texts = [record["text"] for record in batch]

        embeddings = model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        ).tolist()

        collection.upsert(
            ids=[record["id"] for record in batch],
            documents=texts,
            metadatas=[
                record["metadata"] for record in batch
            ],
            embeddings=embeddings,
        )

        print(
            f"Indexed {min(start + len(batch), len(records))}"
            f"/{len(records)} chunks"
        )

    print("\nVector database created successfully.")
    print(f"Stored chunks: {collection.count()}")
    print(f"Database directory: {VECTOR_DIR}")


if __name__ == "__main__":
    main()
