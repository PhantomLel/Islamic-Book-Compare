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

let stores: string[] = [];

const sendUsageAlert = async (request: Request, search: string, author: string, page: number, show: number, sort: string, instock: boolean, exclude: string[], fuzzySearch: boolean, total: number) => {
  if (request.headers.get('host') !== 'kitaabfinder.com') {
    return;
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown IP';
  const userAgent = request.headers.get('user-agent') || 'Unknown User Agent';

  const message = `*Book Search Alert*

• Search: \`${search || 'None'}\`

📍 *Client Info:*
• IP: \`${ip}\`
• User Agent: \`${userAgent}\`

🔎 *Search Parameters:*
• Author: *${author || 'None'}*
• Page: \`${page}\`
• Show: \`${show}\` results
• Sort: \`${sort}\`
• In Stock Only: ${instock ? '✅ Yes' : '❌ No'}
• Exclude Stores: ${exclude.length > 0 ? exclude.join(', ') : 'None'}
• Fuzzy Search: ${fuzzySearch ? '✅ Enabled' : '❌ Disabled'}

*Results:*
• Total Found: *${total}* books

⏰ ${new Date().toLocaleString()}`;

  sendMessage(message).catch(error => {
    console.error('Failed to send usage alert:', error);
  });
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
    const sort = url.searchParams.get('sort') || 'low';
    const instock = url.searchParams.get('instock') !== 'false';
    const searchDesc = url.searchParams.get('searchDesc') !== 'false';
    const exclude = url.searchParams.getAll('exclude');  
    const fuzzySearch = url.searchParams.get('fuzzy') === 'true';
    const exactSearch = url.searchParams.get('exactSearch') === 'true';

    const queries: any[] = [];

    // if (search && author) {
    //   queries.push({
    //     $or: [
    //       { 
    //         author: { $exists: false },
    //         title: { $regex: new RegExp(`(?=.*${search})(?=.*${author})`, 'i') }
    //       },
    //       { 
    //         title: { $regex: search, $options: 'i' },
    //         author: { $regex: author, $options: 'i' }
    //       }
    //     ]
    //   });
    // } else if (search) {
    //   queries.push({
    //     $or: [
    //       { title: { $regex: search, $options: 'i' } },
    //       { author: { $regex: search, $options: 'i' } }
    //     ]
    //   });
    // } else if (author) {
    //   queries.push({ author: { $regex: author, $options: 'i' } });
    // }

    // if (searchDesc) {
    //   // if description is not null search it 
    //   queries.push({ 
    //     description: { $regex: search, $options: 'i' }
    //   });
    // }

    if (search && author) {
      queries.push( 
          {
            "$search": {
              "index": "default",
              "compound": {
                "must": [
                  {
                    "autocomplete": {
                      "query": author,
                      "path": "author", 
                      // "matchCriteria": "all",
                      "fuzzy": fuzzySearch ? {} : undefined

                    }
                  },
                  {
                    "autocomplete": {
                      "query": search,
                      "path": "title",
                      // "matchCriteria": "all",
                      "fuzzy": fuzzySearch ? {} : undefined
                    }
                  }
                ]
              }
            }
          }
      );
    } else if (search) {
      if (exactSearch) {
      queries.push( 
        {
          $search: {
            index: "keyword",
            regex: { 
              query: `.*${search.toLowerCase()}.*`,
              path: "title",
              allowAnalyzedField: true,
            }
          }
        }
      ); } else {
        queries.push( 
          {
            $search: {
              index: "default",
              autocomplete: { 
                query: search.toLowerCase(),
                path: "title",
                fuzzy: fuzzySearch ? {} : undefined
              }
            }
          }
        );
      }
    } else if (author) {
      queries.push(
        {
          $search: { 
            index: "default", 
            autocomplete: { 
              query: author, 
              path: "author", 
              // matchCriteria: "all",
              fuzzy: fuzzySearch ? {} : undefined
            } 
          }
        }
      );
    }
  
    if (instock) {
      queries.push( { "$match": { instock: true } });  
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
          { $sort: sort === "rel" ? {score : -1} : { price: sort === 'low' ? 1 : -1 } },
       ] 
      }
    })
    let results = await db.collection('books').aggregate(queries).toArray();

    // get the total count and the documents
    const total = results.length > 0 ? results[0].count[0]?.totalCount || 0 : 0;
    const books = results.length > 0 ? results[0].documents : [];

    await sendUsageAlert(request, search, author, page, show, sort, instock, exclude, fuzzySearch, total);
  
    return {
      props: {
        results: books,
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