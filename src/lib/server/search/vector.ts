import type { Db, Document } from 'mongodb';
import { EMBED_MODEL, embedQuery } from '../embed';
import type { VectorHit } from './types';

export const VECTOR_INDEX_NAME = 'vector_index';
/**
 * 10x the limit, the low end of Atlas's recommended 10-20x. Latency depends on
 * `vector_index` using `"quantization": "scalar"`: without it the index does
 * not fit in the cluster's memory and queries take 2.5-16 s at any candidate
 * count. Override with `VECTOR_NUM_CANDIDATES`.
 */
export const VECTOR_NUM_CANDIDATES = (() => {
    const fromEnv = Number.parseInt(process.env.VECTOR_NUM_CANDIDATES ?? '', 10);
    // Atlas requires limit <= numCandidates <= 10000.
    return Number.isFinite(fromEnv) && fromEnv >= 100 && fromEnv <= 10000 ? fromEnv : 1000;
})();
export const VECTOR_LIMIT = 100;
/**
 * Minimum `vectorSearchScore` for a neighbor to count as relevant. For cosine
 * indexes Atlas reports (1 + cosine) / 2, so 0.72 is roughly cosine 0.44.
 * Starting value: calibrate with `SEARCH_DEBUG=true` before release.
 */
export const VECTOR_SCORE_FLOOR = 0.72;

// --- Embedding cache ---------------------------------------------------------

export const EMBED_CACHE_MAX = 500;
export const EMBED_CACHE_TTL_MS = 60 * 60 * 1000;

/** Small in-process LRU with a per-entry TTL. */
export class TtlLruCache<V> {
    private map = new Map<string, { value: V; at: number }>();

    constructor(
        private readonly max: number,
        private readonly ttlMs: number,
        private readonly now: () => number = Date.now
    ) {}

    get(key: string): V | undefined {
        const hit = this.map.get(key);
        if (!hit) return undefined;
        if (this.now() - hit.at > this.ttlMs) {
            this.map.delete(key);
            return undefined;
        }
        // Refresh recency: Map iteration order is insertion order.
        this.map.delete(key);
        this.map.set(key, hit);
        return hit.value;
    }

    set(key: string, value: V): void {
        this.map.delete(key);
        this.map.set(key, { value, at: this.now() });
        while (this.map.size > this.max) {
            const oldest = this.map.keys().next().value as string;
            this.map.delete(oldest);
        }
    }

    get size(): number {
        return this.map.size;
    }
}

function embedCache(): TtlLruCache<number[]> {
    // On globalThis (like warm-vector-index.ts) so it survives HMR.
    const g = globalThis as typeof globalThis & { __queryEmbedCache?: TtlLruCache<number[]> };
    if (!g.__queryEmbedCache) {
        g.__queryEmbedCache = new TtlLruCache<number[]>(EMBED_CACHE_MAX, EMBED_CACHE_TTL_MS);
    }
    return g.__queryEmbedCache;
}

/** Embed a query, reusing a cached vector when possible. Failures are never cached. */
export async function embedWithCache(text: string): Promise<number[] | null> {
    const cache = embedCache();
    const key = `${EMBED_MODEL}|${text}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const vec = await embedQuery(text);
    if (vec) cache.set(key, vec);
    return vec;
}

// --- Search ------------------------------------------------------------------

/**
 * Text sent to Voyage: the raw (trimmed) input, in the same `title\nauthor`
 * shape the documents were embedded with. Empty when neither is present.
 */
export function vectorQueryText(title: string, author: string): string {
    const t = title.trim();
    const a = author.trim();
    if (t && a) return `${t}\n${a}`;
    return t || a;
}

/**
 * Nearest in-stock books for the query, as full documents with `score`.
 * Returns `null` when the query could not be embedded (missing key, timeout,
 * Voyage error) so the caller can treat it as "no vector hits". Mongo errors
 * throw.
 */
export async function runVector(
    db: Db,
    text: string,
    exclude: string[]
): Promise<VectorHit[] | null> {
    if (!text) return null;
    const queryVector = await embedWithCache(text);
    if (!queryVector) return null;

    const filter: Document = { instock: true };
    if (exclude.length > 0) filter.source = { $nin: exclude };

    const rows = await db
        .collection('books')
        .aggregate([
            {
                $vectorSearch: {
                    index: VECTOR_INDEX_NAME,
                    path: 'embedding',
                    queryVector,
                    numCandidates: VECTOR_NUM_CANDIDATES,
                    limit: VECTOR_LIMIT,
                    filter
                }
            },
            { $addFields: { score: { $meta: 'vectorSearchScore' } } },
            { $project: { embedding: 0, embeddingModel: 0, _id: 0 } }
        ])
        .toArray();

    const hits = rows as unknown as VectorHit[];

    if (process.env.SEARCH_DEBUG === 'true') {
        console.log(
            '[search] vector scores',
            hits.slice(0, 20).map((h) => [Number(h.score).toFixed(4), h.title])
        );
    }
    return hits;
}
