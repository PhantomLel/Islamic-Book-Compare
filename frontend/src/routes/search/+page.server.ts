import type { PageServerLoad } from './$types';
import { apiUrl, type Book } from '$lib';

let controller: AbortController | null = null; // Store the abort controller globally

// export const ssr = false;

const get_stores = async () => {
    return await fetch(`${apiUrl}status`)
        .then(res => res.json())
        .then(data => {
            let stores = Object.keys(data)
            stores.splice(stores.indexOf("status"), 1)
            console.log(stores)
            return stores
        })
}

let stores: string[] = [];

export const load: PageServerLoad = async ({ url }) => {
    // Cancel the previous request if it's still ongoing
    if (controller) {
        controller.abort();
    }

    if (stores.length === 0) {
        stores = await get_stores();
    }

    // Create a new AbortController for the current request
    controller = new AbortController();
    const signal = controller.signal;

    try {
        // Perform the fetch request with the abort signal
        const res = await fetch(`${apiUrl}search?${url.searchParams.toString()}`, { signal });

        // Check if the response is OK
        if (!res.ok) {
            throw new Error('Error fetching data');
        }

        // Parse the JSON response
        const data: {
            results: Book[],
            total: number,
            end: number,
            start: number,
        } = await res.json();

        return {
            props: data,
            stores: stores
        };

    } catch (err: any) {
        if (err.name === 'AbortError') {
            console.log('Previous request was aborted');
        } else {
            console.error('Failed to fetch:', err);
            throw err; // Rethrow error if it's not an AbortError
        }
    } finally {
        // Reset the controller after the request completes or is aborted
        controller = null;

    }

    return {
        props: {
            results: [],
            total: 0,
            end: 0,
            start: 0,
            stores: stores
        },
    };

};

