import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sendMessage from '$lib/server/telegram';
import getDb from '$lib/server/db';

export const POST: RequestHandler = async ({ request }) => {

    if (process.env.PRODUCTION === 'false') {
        return json({ success: true });
    }


    try {
        const { bookTitle, bookAuthor, bookUrl, bookPrice, bookSource } = await request.json();

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown IP';
        const userAgent = request.headers.get('user-agent') || 'Unknown User Agent';

        const message = `📖 *Book Clicked Alert*

📍 *Client Info:*
• IP: \`${ip}\`
• User Agent: \`${userAgent}\`

📚 *Book Details:*
• Title: *${bookTitle || 'Unknown'}*
• Author: *${bookAuthor || 'Unknown'}*
• Price: \`${bookPrice || 'N/A'}\`
• Source: \`${bookSource || 'Unknown'}\`
• URL: \`${bookUrl || 'Unknown'}\`

⏰ ${new Date().toLocaleString()}`;

        await sendMessage(message);
        const db = await getDb();
        await db.collection('usage').insertOne({
            ip,
            userAgent,
            type: 'book_clicked',
            bookUrl: bookUrl.split('?')[0],
            bookSource: bookSource.split('?')[0],
            timestamp: new Date().toISOString().slice(0, 16)
        }).catch(error => {
            console.error('Failed to log book click:', error);
        });

        return json({ success: true });
    } catch (error) {
        console.error('Failed to track book click:', error);
        return json({ success: false, error: 'Failed to track book click' }, { status: 500 });
    }
}

