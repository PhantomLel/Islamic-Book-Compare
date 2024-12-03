import "dotenv/config";
import getDb from '$lib/server/db';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {

    if (process.env.PRODUCTION === 'false') {
        const response = await resolve(event);
        return response;
    }

    const db = await getDb();
    const date = new Date().toLocaleDateString("en-US", { year: '2-digit', month: '2-digit', day: '2-digit' });
    const ip = event.request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown IP';

    const ip_info = await db.collection('ips').findOne({ date });
    if (!ip_info) {
        await db.collection('ips').insertOne({ date, count: 1, ips: [ip] });
    } else {
        await db.collection('ips').updateOne(
            { date }, 
            { $inc: { count: 1 }, $push: { ips: ip } } as any
        );
    }

    const response = await resolve(event);
    return response;
}