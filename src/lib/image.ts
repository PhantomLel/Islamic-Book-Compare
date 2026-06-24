/** Normalize protocol-relative image URLs for use in <img src>. */
export function displayImageUrl(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (trimmed.startsWith('//')) return `https:${trimmed}`;
	return trimmed;
}

export function proxiedImageUrl(raw: string | null | undefined): string | null {
	const normalized = displayImageUrl(raw);
	if (!normalized) return null;
	return `/api/image?url=${encodeURIComponent(normalized)}`;
}
