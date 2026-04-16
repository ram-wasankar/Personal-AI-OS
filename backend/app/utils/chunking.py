import math
import re
from collections import Counter


WORD_RE = re.compile(r"\b[a-zA-Z0-9_]{2,}\b")


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in WORD_RE.findall(text)]


def semantic_chunk_text(text: str, chunk_size: int = 700, overlap: int = 120) -> list[str]:
    normalized = text.replace("\r", "\n")
    paragraphs = [" ".join(part.split()) for part in normalized.split("\n\n")]
    paragraphs = [part for part in paragraphs if part]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        if len(paragraph) > chunk_size * 1.2:
            sentences = re.split(r"(?<=[.!?])\s+", paragraph)
        else:
            sentences = [paragraph]

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            candidate = f"{current} {sentence}".strip() if current else sentence
            if len(candidate) <= chunk_size:
                current = candidate
                continue

            if current:
                chunks.append(current)
                if overlap > 0:
                    tail = current[-overlap:]
                    current = f"{tail} {sentence}".strip()
                else:
                    current = sentence
            else:
                chunks.append(sentence[:chunk_size])
                current = sentence[chunk_size - overlap :] if overlap else ""

    if current:
        chunks.append(current)

    return [chunk.strip() for chunk in chunks if chunk.strip()]


def chunk_text(text: str, chunk_size: int = 700, overlap: int = 120) -> list[str]:
    return semantic_chunk_text(text=text, chunk_size=chunk_size, overlap=overlap)


def bm25_like_score(query: str, text: str) -> float:
    query_tokens = tokenize(query)
    doc_tokens = tokenize(text)
    if not query_tokens or not doc_tokens:
        return 0.0

    doc_len = len(doc_tokens)
    avg_doc_len = 180
    tf = Counter(doc_tokens)

    score = 0.0
    k1 = 1.2
    b = 0.75

    for token in query_tokens:
        frequency = tf.get(token, 0)
        if frequency == 0:
            continue

        idf = math.log(1 + (1 + avg_doc_len) / (1 + frequency))
        numerator = frequency * (k1 + 1)
        denominator = frequency + k1 * (1 - b + b * (doc_len / avg_doc_len))
        score += idf * (numerator / max(denominator, 1e-6))

    return float(score)
