import type { Actions, PageServerLoad } from './$types';
import getDb from '$lib/server/db';
import sendMessage from '$lib/server/telegram';
import { embedQuery } from '$lib/server/embed';
export const ssr = true;

const CANDIDATE_LIMIT = 100;
const VECTOR_NUM_CANDIDATES = 200;
const VECTOR_INDEX_NAME = 'vector_index';

type Candidate = {
    url: string;
    price: number;
    publisher?: string | null;
    titleNormalized?: string | null;
    authorNormalized?: string | null;
    source?: string | null;
};

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
    .replace(/ؤ/g, 'و') // waw with hamza above
    .replace(/(^|\s)ال/g, '$1') // remove ال only at beginning of words
    .replace(/ئ/g, 'ي')
    .replace(/ٱ/g, 'ا')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // remove harkaat
    .trim()
    .toLowerCase();
}

let stores: string[] = [];

const sendUsageAlert = async (request: Request, search: string, author: string, page: number, show: number, sort: string, exclude: string[], fuzzySearch: boolean, total: number, exactSearch: boolean) => {

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown IP';
  const userAgent = request.headers.get('user-agent') || 'Unknown User Agent';

  const message = `*Book Search Alert*

• Search: ${search}
• Link: https://kitaabfinder.com/search?search=${encodeURIComponent(search)}&author=${encodeURIComponent(author)}&page=${page}&show=${show}&sort=${sort}&exclude=${exclude.join(',')}&fuzzy=${fuzzySearch}&exactSearch=${exactSearch}

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
      exactSearch,
      total,
      timestamp: new Date().toISOString().slice(0, 16)
    }).catch(error => {
      console.error('Failed to log usage:', error);
    });
  }


}

function buildRegexMatchStage(
  sanatizedSearch: string,
  sanatizedAuthor: string
): any | null {
  if (sanatizedSearch && sanatizedAuthor) {
    return {
      $match: {
        titleNormalized: { $regex: sanatizedSearch, $options: 'i' },
        authorNormalized: { $regex: sanatizedAuthor, $options: 'i' },
      },
    };
  }
  if (sanatizedSearch) {
    return {
      $match: { titleNormalized: { $regex: sanatizedSearch, $options: 'i' } },
    };
  }
  if (sanatizedAuthor) {
    return {
      $match: { authorNormalized: { $regex: sanatizedAuthor, $options: 'i' } },
    };
  }
  return null;
}

function buildVectorFilter(exclude: string[]): { instock: true; source?: { $nin: string[] } } {
  const filter: { instock: true; source?: { $nin: string[] } } = { instock: true };
  if (exclude.length > 0) {
    filter.source = { $nin: exclude };
  }
  return filter;
}

function isExactMatch(
  cand: Candidate,
  sanatizedSearch: string,
  sanatizedAuthor: string
): boolean {
  const title = (cand.titleNormalized || '').toLowerCase();
  const author = (cand.authorNormalized || '').toLowerCase();
  if (sanatizedSearch && sanatizedAuthor) {
    return title.includes(sanatizedSearch) && author.includes(sanatizedAuthor);
  }
  if (sanatizedSearch) return title.includes(sanatizedSearch);
  if (sanatizedAuthor) return author.includes(sanatizedAuthor);
  return false;
}

async function runVectorSearch(opts: {
  booksCol: any;
  queryText: string;
  exclude: string[];
  sanatizedSearch: string;
  sanatizedAuthor: string;
  sort: string;
  page: number;
  show: number;
}): Promise<{ total: number; books: any[]; allPublishers: string[] } | null> {
  const {
    booksCol,
    queryText,
    exclude,
    sanatizedSearch,
    sanatizedAuthor,
    sort,
    page,
    show,
  } = opts;

  const candidateProjection = {
    _id: 0,
    url: 1,
    price: 1,
    publisher: 1,
    titleNormalized: 1,
    authorNormalized: 1,
    source: 1,
  };

  const queryVector = await embedQuery(queryText);
  if (!queryVector) return null;

  const vectorFilter = buildVectorFilter(exclude);
  const vectorResults: Array<Candidate & { score: number }> = await booksCol
    .aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector,
          numCandidates: VECTOR_NUM_CANDIDATES,
          limit: CANDIDATE_LIMIT,
          filter: vectorFilter,
        },
      },
      {
        $project: {
          ...candidateProjection,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ])
    .toArray();

  type Ranked = { cand: Candidate; score: number; exact: boolean };
  const ranked: Ranked[] = vectorResults.map((cand) => ({
    cand,
    score: cand.score,
    exact: isExactMatch(cand, sanatizedSearch, sanatizedAuthor),
  }));

  ranked.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (sort === 'low') return (a.cand.price ?? 0) - (b.cand.price ?? 0);
    if (sort === 'high') return (b.cand.price ?? 0) - (a.cand.price ?? 0);
    return b.score - a.score;
  });

  const total = ranked.length;
  const start = (page - 1) * show;
  const pageSlice = ranked.slice(start, start + show);

  let books: any[] = [];
  if (pageSlice.length > 0) {
    const urls = pageSlice.map((r) => r.cand.url);
    const fullDocs = await booksCol
      .find(
        { url: { $in: urls } },
        { projection: { _id: 0, embedding: 0, embeddingModel: 0 } }
      )
      .toArray();
    const byUrl = new Map<string, any>(fullDocs.map((d: any) => [d.url, d]));
    books = pageSlice
      .map((r) => byUrl.get(r.cand.url))
      .filter((d) => !!d);
  }

  const publisherSet = new Set<string>();
  for (const r of ranked) {
    const p = r.cand.publisher;
    if (p && typeof p === 'string') publisherSet.add(p);
  }

  return {
    total,
    books,
    allPublishers: Array.from(publisherSet),
  };
}

async function runRegexSearch(opts: {
  booksCol: any;
  matchStage: any;
  postFilterStages: any[];
  sort: string;
  page: number;
  show: number;
}): Promise<{ total: number; books: any[]; allPublishers: string[] }> {
  const { booksCol, matchStage, postFilterStages, sort, page, show } = opts;

  const queries: any[] = [matchStage, ...postFilterStages];
  queries.push({ $project: { embedding: 0, embeddingModel: 0 } });
  queries.push({ $limit: CANDIDATE_LIMIT });
  queries.push({
    $facet: {
      count: [{ $count: 'totalCount' }],
      documents: [
        {
          $sort:
            sort === 'rel'
              ? { titleNormalized: 1 }
              : { price: sort === 'low' ? 1 : -1 },
        },
        { $skip: (page - 1) * show },
        { $limit: show },
        { $project: { _id: 0 } },
      ],
      allPublishers: [
        { $match: { publisher: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: null, publishers: { $addToSet: '$publisher' } } },
        { $project: { _id: 0, allPublishers: '$publishers' } },
      ],
    },
  });

  const results = await booksCol.aggregate(queries).toArray();
  return {
    total: results.length > 0 ? results[0].count[0]?.totalCount || 0 : 0,
    books: results.length > 0 ? results[0].documents : [],
    allPublishers:
      results.length > 0 && results[0].allPublishers.length > 0
        ? results[0].allPublishers[0].allPublishers || []
        : [],
  };
}

async function loadSearchProps({ url, request }: { url: URL; request: Request }) {
  const db = await getDb();

  const search = url.searchParams.get('search')?.trim() || '';
  const author = url.searchParams.get('author')?.trim() || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const show = parseInt(url.searchParams.get('show') || '15');
  const sort = url.searchParams.get('sort') || 'rel';
  const exclude = url.searchParams.getAll('exclude');
  const fuzzySearch = url.searchParams.get('fuzzy') === 'true';
  const exactSearch = url.searchParams.get('exactSearch') === 'true';

  const sanatizedSearch = sanatizeSearch(search);
  console.log(sanatizedSearch);
  const sanatizedAuthor = sanatizeSearch(author);

  const matchStage = buildRegexMatchStage(sanatizedSearch, sanatizedAuthor);

  const postFilterStages: any[] = [{ $match: { instock: true } }];
  if (exclude.length > 0) {
    postFilterStages.push({ $match: { source: { $not: { $in: exclude } } } });
  }

  const booksCol = db.collection('books');

  const hasQuery = !!sanatizedSearch || !!sanatizedAuthor;
  const queryText = sanatizedSearch && sanatizedAuthor
    ? `${sanatizedSearch} by ${sanatizedAuthor}`
    : sanatizedSearch || sanatizedAuthor;

  let total = 0;
  let books: any[] = [];
  let allPublishers: string[] = [];

  const wantVector = !exactSearch && hasQuery;
  const vectorResult = wantVector
    ? await runVectorSearch({
        booksCol,
        queryText,
        exclude,
        sanatizedSearch,
        sanatizedAuthor,
        sort,
        page,
        show,
      })
    : null;

  if (vectorResult) {
    total = vectorResult.total;
    books = vectorResult.books;
    allPublishers = vectorResult.allPublishers;
  } else if (matchStage) {
    const regexResult = await runRegexSearch({
      booksCol,
      matchStage,
      postFilterStages,
      sort,
      page,
      show,
    });
    total = regexResult.total;
    books = regexResult.books;
    allPublishers = regexResult.allPublishers;
  }

  sendUsageAlert(request, search, author, page, show, sort, exclude, fuzzySearch, total, exactSearch);

  return {
    results: books,
    total,
    start: (page - 1) * show + 1,
    end: Math.min(page * show, total),
    allPublishers,
  };
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
