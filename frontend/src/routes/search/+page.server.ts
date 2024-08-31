import type { PageServerLoad } from './$types';
import { apiUrl, type Book } from '$lib';
import { redirect } from '@sveltejs/kit';

export let ssr = false;
export const load: PageServerLoad = async ({url}) => {

    const query = url.searchParams.get('search');
    if (query === null) {
        throw redirect(301, '/');
    }
    const res = await fetch(`${apiUrl}search?search=${encodeURI(query)}`);

    const data: Book[] = await res.json();

    return {
        props: {
            search: query,
            results: data
        }
    }
};