// handles Salla Oauth response

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sendMessage from '$lib/server/telegram';
import getDb from '$lib/server/db';

export const POST: RequestHandler = async ({ request }) => {
    const { data, event, merchant} = await request.json();
    if (event !== 'app.installed') {
        return json({ message: 'Invalid event' });
    }

    // try to find if there is document associated with this merchant. If not, create one
    const db = await getDb();
    const app = await db.collection('sallaKeys').findOne({ merchant });
    if (!app) {
        await db.collection('sallaKeys').insertOne({ merchant, access_token: data.access_token, refresh_token: data.refresh_token, created_at: new Date() });
    } else {
        await db.collection('sallaKeys').updateOne({ merchant }, { $set: { access_token: data.access_token, refresh_token: data.refresh_token, created_at: new Date() } });
    }

    sendMessage(`Salla Oauth response: ${JSON.stringify(data)}`);

    return json({ message: 'Success', data: { merchant, access_token: data.access_token, refresh_token: data.refresh_token } });
}