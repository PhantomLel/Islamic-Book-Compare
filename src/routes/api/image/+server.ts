import type { RequestHandler } from './$types';
import { normalizeImageUrl } from '$lib/server/allowed-image-hosts';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const raw = url.searchParams.get('url');
	if (!raw) {
		return new Response('Missing url parameter', { status: 400 });
	}

	const imageUrl = normalizeImageUrl(raw);
	if (!imageUrl) {
		return new Response('Image URL not allowed', { status: 403 });
	}

	try {
		const upstream = await fetch(imageUrl, {
			headers: {
				Accept: 'image/*,*/*;q=0.8',
				'User-Agent':
					'Mozilla/5.0 (compatible; IslamicBookSearch/1.0; +https://github.com/PhantomLel/Islamic-Book-Compare)',
			},
			redirect: 'follow',
		});

		if (!upstream.ok) {
			return new Response('Image unavailable', {
				status: upstream.status >= 500 ? 502 : 404,
			});
		}

		const contentType = upstream.headers.get('content-type') ?? '';
		if (!contentType.startsWith('image/')) {
			return new Response('Not an image', { status: 400 });
		}

		return new Response(upstream.body, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
			},
		});
	} catch {
		return new Response('Failed to fetch image', { status: 502 });
	}
};
