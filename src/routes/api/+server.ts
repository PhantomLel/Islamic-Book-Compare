// return hello owlrd

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
    return json({ message: 'Hello World' });
}
