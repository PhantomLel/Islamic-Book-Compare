/**
 * Keeps the Atlas vector index in memory. After the cluster sits idle the next
 * search spends several seconds reading the index back from disk. This reuses
 * one stored embedding, so it does not call Voyage.
 */

import { Binary } from 'mongodb';
import getDb from '$lib/server/db';

const INTERVAL_MS = 3 * 60 * 1000;
const VECTOR_INDEX_NAME = 'vector_index';
const VECTOR_NUM_CANDIDATES = 200;

type WarmerState = {
    timer?: ReturnType<typeof setInterval>;
    warming?: boolean;
    queryVector?: number[];
};

function warmerState(): WarmerState {
    const g = globalThis as typeof globalThis & { __vectorIndexWarmer?: WarmerState };
    if (!g.__vectorIndexWarmer) g.__vectorIndexWarmer = {};
    return g.__vectorIndexWarmer;
}

function queryVectorFrom(embedding: unknown): number[] | null {
    if (embedding instanceof Binary) {
        return Array.from(embedding.toFloat32Array());
    }
    if (Array.isArray(embedding) && embedding.length > 0) {
        return embedding as number[];
    }
    return null;
}

async function warmVectorIndex() {
    const state = warmerState();
    const db = await getDb();
    const books = db.collection('books');

    if (!state.queryVector) {
        const sample = await books.findOne(
            { embedding: { $exists: true }, instock: true },
            { projection: { embedding: 1 } }
        );
        const queryVector = queryVectorFrom(sample?.embedding);
        if (!queryVector) {
            console.warn('[warm] no stored embedding to reuse');
            return;
        }
        state.queryVector = queryVector;
    }

    await books
        .aggregate([
            {
                $vectorSearch: {
                    index: VECTOR_INDEX_NAME,
                    path: 'embedding',
                    queryVector: state.queryVector,
                    numCandidates: VECTOR_NUM_CANDIDATES,
                    limit: 100,
                    filter: { instock: true },
                },
            },
            { $project: { _id: 1 } },
        ])
        .toArray();
}

async function tick() {
    const state = warmerState();
    if (state.warming) return;
    state.warming = true;
    try {
        await warmVectorIndex();
    } catch (err) {
        console.error('[warm] vector index ping failed:', err);
    } finally {
        state.warming = false;
    }
}

export function startVectorIndexWarmer() {
    const state = warmerState();
    if (state.timer) return;
    void tick();
    state.timer = setInterval(() => {
        void tick();
    }, INTERVAL_MS);

    if (import.meta.hot) {
        import.meta.hot.dispose(() => {
            if (state.timer) clearInterval(state.timer);
            state.timer = undefined;
        });
    }
}
