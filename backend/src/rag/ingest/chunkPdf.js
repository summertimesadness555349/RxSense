'use strict';

const path = require('path');
const { PDFLoader }                    = require('@langchain/community/document_loaders/fs/pdf');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

// ── Chunk size ────────────────────────────────────────────────────────────────
// 1800 chars ≈ 450 tokens — complete clinical description, precise retrieval
const CHUNK_SIZE    = 1800;
const CHUNK_OVERLAP = 220;    // ≈ 55 tokens sentence-aware overlap

// ── Chapter/section header detection ─────────────────────────────────────────
const CHAPTER_RE  = /^(chapter\s+\d+[\s:–—-]*.*)/i;
const ALLCAPS_RE  = /^[A-Z][A-Z\s\d\-–:,/()']{7,80}$/;
const NUMBERED_RE = /^\d{1,3}(\.\d{1,3})?\s+[A-Z][a-zA-Z]/;

function detectHeader(text) {
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (t.length >= 6 && t.length <= 120) {
            if (CHAPTER_RE.test(t) || ALLCAPS_RE.test(t) || NUMBERED_RE.test(t)) {
                return t.replace(/\s+/g, ' ');
            }
        }
    }
    return null;
}

/**
 * Load a PDF and return semantic chunks ready for embedding.
 *
 * Uses LangChain PDFLoader + RecursiveCharacterTextSplitter.
 * Each chunk content is prefixed with [Source | Section] so the embedding
 * encodes topical context, not just raw paragraph text.
 *
 * @returns {Array<{ content: string, metadata: object }>}
 */
async function chunkPdf(pdfPath, bookSlug, bookTitle) {
    console.log(`  Loading ${path.basename(pdfPath)} ...`);

    const loader = new PDFLoader(pdfPath, { splitPages: false });
    const [doc]  = await loader.load();

    const rawChars = doc.pageContent.length;
    console.log(`  Raw text: ${(rawChars / 1024).toFixed(0)} KB`);

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize:    CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        // Prefer splitting at paragraph → sentence → word boundaries
        separators: ['\n\n', '\n', '.  ', '. ', ' ', ''],
    });

    const splits = await splitter.splitDocuments([doc]);

    // Walk splits in order, tracking the most recently seen chapter header.
    // This tags each chunk with the section it belongs to — critical for
    // retrieval quality ("anemia" hits hematology chunks, not cardiology ones).
    let currentChapter = 'Introduction';
    const chunks = splits.map((split, i) => {
        const header = detectHeader(split.pageContent);
        if (header) currentChapter = header;

        return {
            content: `[Source: ${bookTitle} | Section: ${currentChapter}]\n\n${split.pageContent.trim()}`,
            metadata: {
                book:        bookSlug,
                book_title:  bookTitle,
                chapter:     currentChapter,
                chunk_index: i,
            },
        };
    });

    console.log(`  → ${chunks.length} chunks  (avg ${Math.round(rawChars / chunks.length)} chars/chunk)`);
    return chunks;
}

module.exports = { chunkPdf };
