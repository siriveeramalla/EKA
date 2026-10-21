
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer


BASE_DIR = Path(__file__).resolve().parent
VECTOR_DIR = BASE_DIR / "vector_db"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
COLLECTION_NAME = "enterprise_knowledge"


def main():
    client = chromadb.PersistentClient(
        path=str(VECTOR_DIR)
    )

    collection = client.get_collection(
        name=COLLECTION_NAME
    )

    model = SentenceTransformer(MODEL_NAME)

    question = input("Enter your question: ").strip()

    if not question:
        print("Please enter a question.")
        return

    query_embedding = model.encode(
        question,
        normalize_embeddings=True,
    ).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(5, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    print("\n--- Relevant Document Passages ---")

    for index, text in enumerate(
        results["documents"][0], start=1
    ):
        metadata = results["metadatas"][0][index - 1]
        distance = results["distances"][0][index - 1]

        print(f"\nResult {index}")
        print(f"Source: {metadata['source']}")
        print(f"Location: {metadata['location']}")
        print(f"Cosine distance: {distance:.4f}")
        print(f"Passage: {text}")


if __name__ == "__main__":
    main()
