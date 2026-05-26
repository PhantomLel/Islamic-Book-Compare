import getDb from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const ssr = true;

export const load: PageServerLoad = async () => {
    const db = await getDb();

    const [data, bookCounts] = await Promise.all([
        db.collection('status').findOne({}, { projection: { _id: 0 } }),
        db.collection('books').aggregate([
            { $group: { _id: '$source', total: { $sum: 1 } } }
        ]).toArray()
    ]);

    // Build a lookup map: source name -> actual count in books collection
    const countBySource: Record<string, number> = {};
    for (const row of bookCounts) {
        if (row._id) countBySource[row._id] = row.total;
    }

    // Overwrite total_books for each store with the live count
    const enriched = { ...data };
    for (const key of Object.keys(enriched)) {
        if (enriched[key] && typeof enriched[key] === 'object' && 'total_books' in enriched[key]) {
            enriched[key] = { ...enriched[key], total_books: countBySource[key] ?? 0 };
        }
    }

    return {
        props: enriched
    }
}
