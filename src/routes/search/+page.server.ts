import type { Actions, PageServerLoad } from './$types';
import getDb from '$lib/server/db';

// export const ssr = false;

const get_stores = async () => {
    const db = await getDb();
    let data = await db.collection("status").findOne({}, { projection: { _id: 0 } });

    if (!data) {
        return []
    }

    const stores = Object.keys(data);
    stores.splice(stores.indexOf("status"), 1)
    return stores
}

let stores: string[] = [];


/*
Explanation:
1. **Initialize Query**
   - Start with an empty list to build search filters.

2. **Check Search and Author Parameters**:
   - `search` and `author` provided?
     - Yes -> Add condition to match books where:
       - Title contains both `search` and `author` terms 
       - | `$or` condition allows either `title` or `author` to match terms |
     - No -> Check if only `search` is provided?
       - Yes -> Add condition to match where title or author contains the `search` term
       - No -> Check if only `author` is provided?
         - Yes -> Add condition to match where author contains the `author` term

3. **Add In-Stock Filter**:
   - `instock` is `true`?
     - Yes -> Add condition to filter only in-stock items

4. **Apply Exclusion Filter**:
   - `exclude` has values?
     - Yes -> Add condition to filter out books where `source` matches any items in `exclude`

5. **Pagination and Sorting**:
   - **Pagination**: Skip results based on `page` and limit by `show` items per page
   - **Sorting**: Order by `price` (ascending for "low," descending for "high")
*/


export const load: PageServerLoad = async ({ url}) => {

    const db = await getDb();
  
    // Fetch the list of stores
    const stores = await get_stores();
  
    // Extract query parameters from the URL
    const search = url.searchParams.get('search') || '';
    const author = url.searchParams.get('author') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const show = parseInt(url.searchParams.get('show') || '15');
    const sort = url.searchParams.get('sort') || 'low';
    const instock = url.searchParams.get('instock') === 'true';
    const searchDesc = url.searchParams.get('searchDesc') !== 'false';
    const exclude = url.searchParams.getAll('exclude');  
  
    const queries: any[] = [];
    if (search && author) {
      queries.push({
        $or: [
          { 
            author: { $exists: false },
            title: { $regex: new RegExp(`(?=.*${search})(?=.*${author})`, 'i') }
          },
          { 
            title: { $regex: search, $options: 'i' },
            author: { $regex: author, $options: 'i' }
          }
        ]
      });
    } else if (search) {
      queries.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { author: { $regex: search, $options: 'i' } }
        ]
      });
    } else if (author) {
      queries.push({ author: { $regex: author, $options: 'i' } });
    }

    if (searchDesc) {
      // if description is not null search it 
      queries.push({ 
        description: { $regex: search, $options: 'i' }
      });
    }
  
    if (instock) {
      queries.push({ instock: true });  
    }
    if (exclude.length > 0) {
      queries.push({ source: { $not: { $in: exclude } } });  
    }
  
    // Get the total count of matching documents for pagination
    const total = await db.collection('books').countDocuments({ $and: queries });
  
    // Retrieve the search results based on the built query
    let results = db.collection('books')
      .find({ $and: queries }, { projection: { _id: 0 } })
      .skip((page - 1) * show)
      .limit(show);
  
    if (sort === 'low') {
      results = results.sort({ price: 1 });  
    } else if (sort === 'high') {
      results = results.sort({ price: -1 });  
    }
  
    const resultsList = await results.toArray();
  
    return {
      props: {
        results: resultsList,
        total,
        start: (page - 1) * show + 1,
        end: Math.min(page * show, total),
      },
      stores,
    };
  };
  
  // not in use currently
  export const actions: Actions = {
    feedback: async ({ request }) => {
        const db = await getDb();
        const formData = await request.formData();
        const email = formData.get("email") as string;
        const feedback = formData.get("feedback") as string;

        await db.collection("feedback").insertOne({ email, feedback });
    }
  }