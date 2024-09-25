import type { PageServerLoad } from './$types';
import { apiUrl, type Book } from '$lib';
import { redirect } from '@sveltejs/kit';

export let ssr = false;
export const load: PageServerLoad = async ({url}) => {

    const query = url.searchParams.get('search');
    if (query === null) {
        throw redirect(301, '/');
    }
    const res = await fetch(`${apiUrl}search?` + url.searchParams.toString());

    const data: {
        results : Book[],
        total : number,
        end : number,
        start : number,
    } = await res.json();

    return {
        props: data
    }
};