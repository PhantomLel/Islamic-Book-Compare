/** Hostnames and suffixes allowed through /api/image (SSRF guard). */
const ALLOWED_IMAGE_HOSTS = new Set([
	'cdn.shopify.com',
	'cdn.shopifycdn.net',
]);

const ALLOWED_IMAGE_HOST_SUFFIXES = [
	'.myshopify.com',
	'.wp.com',
	'.shopify.com',
	'.shopifycdn.net',
	// Bookstore domains scraped by book-scraper
	'kitaabun.com',
	'kastntinya.com',
	'salla.com',
	'salla.sa',
	'ismaeelbooks.co.uk',
	'anadolukitapevi.com',
	'zakariyyabooks.com',
	'qurtubabooks.com',
	'tahsilyayinevi.com',
	'al-hidaayah.co.uk',
	'sifatusafwa.com',
	'irfanbooks.org',
	'albadr.co.uk',
	'irsad.com.tr',
	'osmanbooks.com',
	'salafibookstore.com',
	'jqubookstore.com',
	'islamicbookcenter.org',
	'darulimanbooks.com',
	'buraqbooks.com',
	'abuhanifahbooks.co.uk',
	'albalaghbooks.com',
	'almuttaqin.co.uk',
	'maktabahalhidayah.com',
	'safinatulnajat.com',
];

function isBlockedHost(hostname: string): boolean {
	const host = hostname.toLowerCase();

	if (host === 'localhost' || host.endsWith('.local')) return true;
	if (host === '0.0.0.0') return true;
	if (/^\[?::1\]?$/.test(host)) return true;

	// Block literal IPv4/IPv6 — image URLs should use hostnames.
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
	if (host.includes(':')) return true;

	return false;
}

export function isAllowedImageHost(hostname: string): boolean {
	const host = hostname.toLowerCase();

	if (isBlockedHost(host)) return false;
	if (ALLOWED_IMAGE_HOSTS.has(host)) return true;

	return ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => {
		if (suffix.startsWith('.')) {
			return host.endsWith(suffix) || host === suffix.slice(1);
		}
		return host === suffix || host.endsWith(`.${suffix}`);
	});
}

export function normalizeImageUrl(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	try {
		const url = trimmed.startsWith('//') ? new URL(`https:${trimmed}`) : new URL(trimmed);
		if (url.protocol !== 'https:') return null;
		if (!isAllowedImageHost(url.hostname)) return null;
		return url.toString();
	} catch {
		return null;
	}
}
