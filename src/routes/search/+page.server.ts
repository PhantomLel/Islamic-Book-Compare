import type { Actions, PageServerLoad } from './$types';
import getDb from '$lib/server/db';
import sendMessage from '$lib/server/telegram';
export const ssr = false;

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

const sanatizeSearch = (search: string) => {
  /*
  
      Normalizes Arabic text 
      
      Replaces:
      - أ (alif with hamza above) → ا
      - إ (alif with hamza below) → ا
      - آ (alif with madda) → ا
      - ؤ (waw with hamza above) → و
      - ال (when at the beginning of a word) → null
      - remove harkaat
  */

  return search.replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ال/g, '')
    .trim()
    .toLowerCase();


}

let stores: string[] = [];

const sendUsageAlert = async (request: Request, search: string, author: string, page: number, show: number, sort: string, instock: boolean, exclude: string[], fuzzySearch: boolean, total: number, exactSearch: boolean) => {

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown IP';
  const userAgent = request.headers.get('user-agent') || 'Unknown User Agent';

  const message = `*Book Search Alert*

• Search: ${search}
• Link: https://kitaabfinder.com/search?search=${encodeURIComponent(search)}&author=${encodeURIComponent(author)}&page=${page}&show=${show}&sort=${sort}&instock=${instock}&exclude=${exclude.join(',')}&fuzzy=${fuzzySearch}&exactSearch=${exactSearch}

📍 *Client Info:*
• IP: https://ipinfo.io/${ip}
• User Agent: \`${userAgent}\`

🔎 *Search Parameters:*
• Author: *${author || 'None'}*
• Page: \`${page}\`
• Show: \`${show}\` results
• Sort: \`${sort}\`
• In Stock Only: ${instock ? '✅ Yes' : '❌ No'}
• Exclude Stores: ${exclude.length > 0 ? exclude.join(', ') : 'None'}
• Exact Search: ${exactSearch ? '✅ Enabled' : '❌ Disabled'}
• Fuzzy Search: ${fuzzySearch ? '✅ Enabled' : '❌ Disabled'}

*Results:*
• Total Found: *${total}* books

⏰ ${new Date().toLocaleString()}`;

  if (process.env.PRODUCTION === 'true') {
    sendMessage(message).catch(error => {
      console.error('Failed to send usage alert:', error);
    });

    const db = await getDb();
    db.collection('usage').insertOne({
      ip,
      type: 'search',
      search,
      author,
      page,
      show,
      sort,
      instock,
      exclude,
      fuzzySearch,
      exactSearch,
      total,
      timestamp: new Date().toISOString().slice(0, 16)
    }).catch(error => {
      console.error('Failed to log usage:', error);
    });
  }


}


export const load: PageServerLoad = async ({ url, request }) => {

  const db = await getDb();

  // Fetch the list of stores
  const stores = await get_stores();

  // Extract query parameters from the URL
  const search = url.searchParams.get('search')?.trim() || '';
  const author = url.searchParams.get('author')?.trim() || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const show = parseInt(url.searchParams.get('show') || '15');
  const sort = url.searchParams.get('sort') || 'rel';
  const instock = url.searchParams.get('instock') !== 'false';
  const searchDesc = url.searchParams.get('searchDesc') !== 'false';
  const exclude = url.searchParams.getAll('exclude');
  const fuzzySearch = url.searchParams.get('fuzzy') === 'true';
  const exactSearch = url.searchParams.get('exactSearch') === 'true';


  const queries: any[] = [];
  const sanatizedSearch = sanatizeSearch(search);
  const sanatizedAuthor = sanatizeSearch(author);

  if (sanatizedSearch && sanatizedAuthor) {

    if (exactSearch) {
      queries.push(
        { $match: { titleNormalized: { $regex: new RegExp(sanatizedSearch, 'i') }, authorNormalized: { $regex: new RegExp(sanatizedAuthor, 'i') } } }
      );
    } else {
      queries.push(
        {
          "$search": {
            "index": "default",
            "compound": {
              "must": [
                {
                  "autocomplete": {
                    "query": sanatizedAuthor,
                    "path": "authorNormalized",
                    // "matchCriteria": "all",
                    "fuzzy": fuzzySearch ? {} : undefined

                  }
                },
                {
                  "autocomplete": {
                    "query": sanatizedSearch,
                    "path": "titleNormalized",
                    // "matchCriteria": "all",
                    "fuzzy": fuzzySearch ? {} : undefined
                  }
                }
              ]
            }
          }
        }
      );
    }
  } else if (sanatizedSearch) {
    if (exactSearch) {
      queries.push(
        { $match: { titleNormalized: { $regex: sanatizedSearch, $options: 'i' } } }
      );
    } else {
      queries.push(
        {
          $search: {
            index: "default",
            autocomplete: {
              query: sanatizedSearch,
              path: "titleNormalized",
              fuzzy: fuzzySearch ? {} : undefined
            }
          }
        }
      );
    }
  } else if (sanatizedAuthor) {
    queries.push(
      {
        $search: {
          index: "default",
          autocomplete: {
            query: sanatizedAuthor,
            path: "authorNormalized",
            // matchCriteria: "all",
            fuzzy: fuzzySearch ? {} : undefined
          }
        }
      }
    );
  }

  if (instock) {
    queries.push({ "$match": { instock: true } });
  }
  if (exclude.length > 0) {
    queries.push({ "$match": { source: { $not: { $in: exclude } } } });
  }

  queries.push({
    "$addFields": {
      "score": { "$meta": "searchScore" }
    }
  })

  // get both the count and the documents
  queries.push({
    $facet: {
      count: [{ $count: "totalCount" }],
      documents: [
        { $skip: (page - 1) * show },
        { $limit: show },
        { $project: { _id: 0 } }, // remove the _id field
        { $sort: sort === "rel" ? { score: -1 } : { price: sort === 'low' ? 1 : -1 } },
      ],
      allPublishers: [
        { $match: { publisher: { $exists: true, $nin: [null, ""] } } },
        { $group: { _id: null, publishers: { $addToSet: "$publisher" } } },
        { $project: { _id: 0, allPublishers: "$publishers" } }
      ]
    }
  })
  let results = await db.collection('books').aggregate(queries).toArray();

  // get the total count and the documents
  const total = results.length > 0 ? results[0].count[0]?.totalCount || 0 : 0;
  const books = results.length > 0 ? results[0].documents : [];
  const allPublishers = results.length > 0 && results[0].allPublishers.length > 0
    ? results[0].allPublishers[0].allPublishers || []
    : [];

  await sendUsageAlert(request, search, author, page, show, sort, instock, exclude, fuzzySearch, total, exactSearch);

  return {
    props: {
      results: books,
      total,
      start: (page - 1) * show + 1,
      end: Math.min(page * show, total),
      allPublishers,
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