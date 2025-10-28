import { json } from '@sveltejs/kit';
import sendMessage from '$lib/server/telegram';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { messageText } = await request.json();
        
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown IP';
        const userAgent = request.headers.get('user-agent') || 'Unknown User Agent';

        const message = `${messageText} \n IP: ${ip} \n User Agent: ${userAgent}`;
        
        await sendMessage(message);
        
        return json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Failed to send message:', error);
        return json({ success: false, error: 'Failed to send message' }, { status: 500 });
    }
};
