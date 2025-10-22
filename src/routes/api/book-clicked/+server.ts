import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sendMessage from '$lib/server/telegram';

export const POST: RequestHandler = async ({ request }) => {
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
        
        return json({ success: true });
    } catch (error) {
        console.error('Failed to track book click:', error);
        return json({ success: false, error: 'Failed to track book click' }, { status: 500 });
    }
};
