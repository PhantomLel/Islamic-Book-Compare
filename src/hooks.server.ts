import "dotenv/config";
import getDb from '$lib/server/db';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {

    if (process.env.PRODUCTION === 'false') {
        const response = await resolve(event);
        return response;
    }

    const db = await getDb();
    const ip = event.request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown IP';
    console.log(ip);

    const ip_info = await db.collection('ips').findOne({ ip });
    if (!ip_info) {
        await db.collection('ips').insertOne({ ip, count: 1 });
    } else {
        await db.collection('ips').updateOne({ ip }, { $inc: { count: 1 } });
    }

	const response = await resolve(event);
	return response;
}