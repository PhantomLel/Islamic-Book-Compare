import type { Actions, PageServerLoad } from './$types';
import getDb from '$lib/server/db';
import sendMessage from '$lib/server/telegram';
import { parseSearchParams } from '$lib/server/search/params';
import { runSearch } from '$lib/server/search';
export const ssr = true;

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

const sendUsageAlert = async (request: Request, search: string, author: string, page: number, show: number, sort: string, exclude: string[], fuzzySearch: boolean, total: number, exactSearch: boolean, searchDesc: boolean) => {

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown IP';
  const userAgent = request.headers.get('user-agent') || 'Unknown User Agent';

  const message = `*Book Search Alert*

• Search: ${search}
• Link: https://kitaabfinder.com/search?search=${encodeURIComponent(search)}&author=${encodeURIComponent(author)}&page=${page}&show=${show}&sort=${sort}&exclude=${exclude.join(',')}&fuzzy=${fuzzySearch}&searchDesc=${searchDesc}&exactSearch=${exactSearch}

📍 *Client Info:*
• IP: https://ipinfo.io/${ip}
• User Agent: \`${userAgent}\`

🔎 *Search Parameters:*
• Author: *${author || 'None'}*
• Page: \`${page}\`
• Show: \`${show}\` results
• Sort: \`${sort}\`
• Exclude Stores: ${exclude.length > 0 ? exclude.join(', ') : 'None'}
• Exact Search: ${exactSearch ? '✅ Enabled' : '❌ Disabled'}
• Fuzzy Search: ${fuzzySearch ? '✅ Enabled' : '❌ Disabled'}
• Search Description: ${searchDesc ? '✅ Enabled' : '❌ Disabled'}

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
      exclude,
      fuzzySearch,
      searchDesc,
      exactSearch,
      total,
      timestamp: new Date().toISOString().slice(0, 16)
    }).catch(error => {
      console.error('Failed to log usage:', error);
    });
  }


}

async function loadSearchProps({ url, request }: { url: URL; request: Request }) {
  const db = await getDb();
  const params = parseSearchParams(url);

  const result = await runSearch(db, params);

  sendUsageAlert(
    request,
    params.search,
    params.author,
    result.page,
    params.show,
    params.sort,
    params.exclude,
    params.fuzzy,
    result.total,
    params.exactSearch,
    params.searchDesc
  );

  return result;
}

export const load: PageServerLoad = ({ url, request }) => {
  // Stream both promises so navigation can render the page shell (and loading
  // skeletons) immediately instead of blocking until MongoDB/embed calls finish.
  return {
    stores: get_stores(),
    props: loadSearchProps({ url, request }),
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
