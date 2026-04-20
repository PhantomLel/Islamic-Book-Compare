/**
 * Query-side Voyage embedding client used by the hybrid search pipeline.
 *
 * Voyage embeddings are asymmetric: documents are embedded with
 * `input_type: "document"` at ingest time (see `book-scraper/voyage_embed.py`),
 * and queries with `input_type: "query"` at search time. Using the wrong side
 * noticeably hurts recall, so this module only handles the query side.
 *
 * Returns null on any failure (missing key, timeout, 5xx) so the caller can
 * transparently fall back to keyword-only search without breaking search.
 */

const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const DEFAULT_MODEL = process.env.VOYAGE_MODEL || 'voyage-4-large';
const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Embed a single query string. Returns null if the Voyage call fails or the
 * API key is missing. Logs on failure.
 */
export async function embedQuery(
    text: string,
    opts: { model?: string; timeoutMs?: number } = {}
): Promise<number[] | null> {
    const key = process.env.VOYAGE_API_KEY;
    if (!key) {
        console.warn('[embed] VOYAGE_API_KEY not set; semantic search disabled');
        return null;
    }

    const trimmed = text.trim();
    if (!trimmed) return null;

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    try {
        const resp = await fetch(VOYAGE_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: [trimmed],
                model: opts.model ?? DEFAULT_MODEL,
                input_type: 'query',
            }),
            signal: controller.signal,
        });

        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            console.error(`[embed] voyage ${resp.status}: ${body.slice(0, 300)}`);
            return null;
        }

        const data = await resp.json();
        const first = data?.data?.[0];
        const vec = first?.embedding;
        if (!Array.isArray(vec) || vec.length === 0) {
            console.error('[embed] voyage returned empty embedding payload');
            return null;
        }
        return vec as number[];
    } catch (err) {
        console.error('[embed] request failed:', err);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}
