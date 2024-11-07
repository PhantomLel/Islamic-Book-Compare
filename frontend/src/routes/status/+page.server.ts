import { apiUrl } from '$lib';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const res = await fetch(`${apiUrl}status`);
    const data: Record<string, {
        error: string;
        last_crawled: string;
        total_books: number;
        time_to_crawl: number;
    }> = await res.json();
    return {
        props: data
    }
}
