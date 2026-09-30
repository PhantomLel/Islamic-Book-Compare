import "dotenv/config";
import getDb from '$lib/server/db';
import { startVectorIndexWarmer } from '$lib/server/warm-vector-index';
import type { Handle } from '@sveltejs/kit';

startVectorIndexWarmer();

let visitsIndex: Promise<string> | null = null;

function logVisit(doc: { date: string; ip: string; userAgent: string; url: string; at: Date }) {
    const run = async () => {
        const db = await getDb();
        const visits = db.collection('visits');
        if (!visitsIndex) {
            visitsIndex = visits.createIndex({ date: 1 }, { name: 'date_1' }).catch((err) => {
                visitsIndex = null;
                throw err;
            });
        }
        await visitsIndex;
        await visits.insertOne(doc);
    };

    void run().catch((err) => {
        console.error('Failed to log visit:', err);
    });
}

export const handle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event);

    // SvelteKit streams deferred load promises; nginx and similar proxies buffer
    // by default and delay the page shell until the full response is ready.
    response.headers.set('X-Accel-Buffering', 'no');

    if (process.env.PRODUCTION === 'false') {
        return response;
    }

    const date = new Date().toLocaleDateString("en-US", { year: '2-digit', month: '2-digit', day: '2-digit' });
    const ip = event.request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown IP';
    const userAgent = event.request.headers.get('user-agent') || 'Unknown User Agent';
    const url = event.request.url;

    logVisit({ date, ip, userAgent, url, at: new Date() });

    return response;
}
