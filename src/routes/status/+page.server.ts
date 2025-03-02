import getDb from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const ssr = false;
export const prerender = false;

export const load: PageServerLoad = async () => {
    const db = await getDb();
    // exclude _id
    const data = await db.collection('status').findOne({}, { projection: { _id: 0 } });

    return {
        props: data
    }
}
