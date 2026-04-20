import type { Actions, PageServerLoad } from './$types';
import getDb from '$lib/server/db';
import sendMessage from '$lib/server/telegram';
import { embedQuery } from '$lib/server/embed';
export const ssr = false;

// Hybrid search tuning. K is the RRF constant (60 is the canonical default);
// CANDIDATE_LIMIT is the per-side candidate pool we fuse over.
const RRF_K = 60;
const CANDIDATE_LIMIT = 100;
const VECTOR_NUM_CANDIDATES = 400;
const VECTOR_INDEX_NAME = 'vector_index';

// Which search backend to use. Set via env so you can flip between modes at
// deploy-time without code changes (useful for A/B-testing relevance).
//   - 'hybrid'  : keyword + vector, fused with RRF (default, best quality)
//   - 'vector'  : vector-only (pure semantic, catches paraphrases but can miss
//                 exact-title typing)
//   - 'keyword' : old $search autocomplete only (pre-embedding behavior)
// exactSearch (regex) always overrides this; it's a distinct user-facing mode.
type SearchMode = 'hybrid' | 'vector' | 'keyword';
const SEARCH_TYPE: SearchMode = (() => {
    const raw = (process.env.SEARCH_TYPE || 'hybrid').toLowerCase();
    if (raw === 'vector' || raw === 'keyword' || raw === 'hybrid') return raw;
    console.warn(`[search] unknown SEARCH_TYPE="${raw}", falling back to 'hybrid'`);
    return 'hybrid';
})();

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


/**
 * Build the same `$search` stage we used in the pre-hybrid pipeline. Returned
 * as a standalone stage (or `null` when there's nothing to search on) so we can
 * reuse it from the hybrid path and from the legacy fallback.
 */
function buildKeywordSearchStage(
  sanatizedSearch: string,
  sanatizedAuthor: string,
  fuzzySearch: boolean,
  exactSearch: boolean
): any | null {
  if (sanatizedSearch && sanatizedAuthor) {
    if (exactSearch) {
      return {
        $match: {
          titleNormalized: { $regex: new RegExp(sanatizedSearch, 'i') },
          authorNormalized: { $regex: new RegExp(sanatizedAuthor, 'i') },
        },
      };
    }
    return {
      $search: {
        index: 'default',
        compound: {
          must: [
            {
              autocomplete: {
                query: sanatizedAuthor,
                path: 'authorNormalized',
                fuzzy: fuzzySearch ? {} : undefined,
              },
            },
            {
              autocomplete: {
                query: sanatizedSearch,
                path: 'titleNormalized',
                fuzzy: fuzzySearch ? {} : undefined,
              },
            },
          ],
        },
      },
    };
  }
  if (sanatizedSearch) {
    if (exactSearch) {
      return {
        $match: { titleNormalized: { $regex: sanatizedSearch, $options: 'i' } },
      };
    }
    return {
      $search: {
        index: 'default',
        autocomplete: {
          query: sanatizedSearch,
          path: 'titleNormalized',
          fuzzy: fuzzySearch ? {} : undefined,
        },
      },
    };
  }
  if (sanatizedAuthor) {
    return {
      $search: {
        index: 'default',
        autocomplete: {
          query: sanatizedAuthor,
          path: 'authorNormalized',
          fuzzy: fuzzySearch ? {} : undefined,
        },
      },
    };
  }
  return null;
}

/**
 * Build the `filter` clause that goes *inside* `$vectorSearch`. Only fields
 * declared as filter fields in the Atlas vector index can appear here (see the
 * plan: we declared `source` and `instock`). Returns undefined when nothing to
 * filter on so we omit the key entirely.
 */
function buildVectorFilter(instock: boolean, exclude: string[]): any | undefined {
  const filter: any = {};
  if (instock) filter.instock = true;
  if (exclude.length > 0) filter.source = { $nin: exclude };
  return Object.keys(filter).length ? filter : undefined;
}

/**
 * Substring exact-match check against the already-sanitized search terms. We
 * want books whose normalized title literally contains the user's query to
 * float to the top regardless of RRF score - that preserves the "type the
 * exact title, get that book" expectation while embeddings expand recall.
 * Both sides are lowercased because the Python sanitizer doesn't lowercase.
 */
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

/**
 * Run keyword and/or vector searches and fuse the results.
 *
 * `mode`:
 *   - 'hybrid' : run both, fuse with RRF.
 *   - 'vector' : skip keyword entirely, rank purely by vector similarity.
 *
 * Returns `null` when vector results are needed but the embedding call failed
 * (no API key, timeout, etc.) so the caller can fall back to the legacy
 * keyword-only pipeline without breaking search for the user.
 */
async function runFusedSearch(opts: {
  booksCol: any;
  keywordSearchStage: any | null;
  queryText: string;
  instock: boolean;
  exclude: string[];
  postFilterStages: any[];
  sanatizedSearch: string;
  sanatizedAuthor: string;
  sort: string;
  page: number;
  show: number;
  mode: 'hybrid' | 'vector';
}): Promise<{ total: number; books: any[]; allPublishers: string[] } | null> {
  const {
    booksCol,
    keywordSearchStage,
    queryText,
    instock,
    exclude,
    postFilterStages,
    sanatizedSearch,
    sanatizedAuthor,
    sort,
    page,
    show,
    mode,
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

  const runKeyword = mode === 'hybrid' && !!keywordSearchStage;

  const keywordPromise: Promise<Array<Candidate & { score: number }>> = runKeyword
    ? booksCol
        .aggregate([
          keywordSearchStage,
          ...postFilterStages,
          { $limit: CANDIDATE_LIMIT },
          {
            $project: {
              ...candidateProjection,
              score: { $meta: 'searchScore' },
            },
          },
        ])
        .toArray()
    : Promise.resolve([]);

  // Kick off the query embed in parallel with the (optional) keyword search.
  const embedPromise = embedQuery(queryText);

  const [keywordResults, queryVector] = await Promise.all([
    keywordPromise,
    embedPromise,
  ]);

  if (!queryVector) {
    // Embedding failed or isn't configured. Let the caller run the legacy
    // aggregation so search still works.
    return null;
  }

  const vectorFilter = buildVectorFilter(instock, exclude);
  const vectorResults: Array<Candidate & { score: number }> = await booksCol
    .aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector,
          numCandidates: VECTOR_NUM_CANDIDATES,
          limit: CANDIDATE_LIMIT,
          ...(vectorFilter ? { filter: vectorFilter } : {}),
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

  // Fuse the ranked lists. In 'vector' mode the keyword list is empty and this
  // reduces to ranking purely by the vector similarity order.
  type Fused = { cand: Candidate; rrf: number; exact: boolean };
  const fused = new Map<string, Fused>();

  const addRanked = (list: Array<Candidate & { score: number }>) => {
    list.forEach((cand, rank) => {
      const contribution = 1 / (RRF_K + rank);
      const existing = fused.get(cand.url);
      if (existing) {
        existing.rrf += contribution;
      } else {
        fused.set(cand.url, {
          cand,
          rrf: contribution,
          exact: isExactMatch(cand, sanatizedSearch, sanatizedAuthor),
        });
      }
    });
  };
  addRanked(keywordResults);
  addRanked(vectorResults);

  const fusedList = Array.from(fused.values());

  // Sort fused candidates. Exact matches always first, then:
  //   - 'rel' -> by fused RRF score
  //   - 'low' / 'high' -> by price
  fusedList.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (sort === 'low') return (a.cand.price ?? 0) - (b.cand.price ?? 0);
    if (sort === 'high') return (b.cand.price ?? 0) - (a.cand.price ?? 0);
    return b.rrf - a.rrf;
  });

  const total = fusedList.length;
  const start = (page - 1) * show;
  const pageSlice = fusedList.slice(start, start + show);

  // Hydrate the page we're actually returning. Preserve order from fusion.
  let books: any[] = [];
  if (pageSlice.length > 0) {
    const urls = pageSlice.map((f) => f.cand.url);
    const fullDocs = await booksCol
      .find({ url: { $in: urls } }, { projection: { _id: 0 } })
      .toArray();
    const byUrl = new Map<string, any>(fullDocs.map((d: any) => [d.url, d]));
    books = pageSlice
      .map((f) => byUrl.get(f.cand.url))
      .filter((d) => !!d);
  }

  // Publishers dropdown: union across the full fused candidate pool. Matches
  // the spirit of the legacy `allPublishers` facet (publishers seen among
  // matching books) without running a second DB round-trip.
  const publisherSet = new Set<string>();
  for (const f of fusedList) {
    const p = f.cand.publisher;
    if (p && typeof p === 'string') publisherSet.add(p);
  }

  return {
    total,
    books,
    allPublishers: Array.from(publisherSet),
  };
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


  const sanatizedSearch = sanatizeSearch(search);
  console.log(sanatizedSearch);
  const sanatizedAuthor = sanatizeSearch(author);

  // Build the keyword ($search) stage the same way the legacy path did; we
  // reuse it both for hybrid mode and for the fallback when embeddings fail.
  const keywordSearchStage = buildKeywordSearchStage(
    sanatizedSearch,
    sanatizedAuthor,
    fuzzySearch,
    exactSearch
  );

  // Common post-search filters (instock + excluded stores). Vector search has
  // to apply these *inside* its own stage; keyword search can apply them after.
  const postFilterStages: any[] = [];
  if (instock) postFilterStages.push({ $match: { instock: true } });
  if (exclude.length > 0) {
    postFilterStages.push({ $match: { source: { $not: { $in: exclude } } } });
  }

  const booksCol = db.collection('books');

  // Which backend we'd actually like to run. Semantic modes only kick in when:
  //   - we have at least one search term,
  //   - user didn't request exactSearch (that's a regex grep; embeddings are
  //     pointless there),
  //   - and SEARCH_TYPE isn't set to 'keyword'.
  // A failed embed call still falls back to the legacy keyword aggregation.
  const hasQuery = !!sanatizedSearch || !!sanatizedAuthor;
  const wantSemantic = !exactSearch && hasQuery && SEARCH_TYPE !== 'keyword';
  const queryText = sanatizedSearch && sanatizedAuthor
    ? `${sanatizedSearch} by ${sanatizedAuthor}`
    : sanatizedSearch || sanatizedAuthor;

  let total = 0;
  let books: any[] = [];
  let allPublishers: string[] = [];

  const semanticResult = wantSemantic
    ? await runFusedSearch({
        booksCol,
        keywordSearchStage,
        queryText,
        instock,
        exclude,
        postFilterStages,
        sanatizedSearch,
        sanatizedAuthor,
        sort,
        page,
        show,
        // SEARCH_TYPE is 'hybrid' or 'vector' here (we excluded 'keyword' above).
        mode: SEARCH_TYPE === 'vector' ? 'vector' : 'hybrid',
      })
    : null;

  if (semanticResult) {
    total = semanticResult.total;
    books = semanticResult.books;
    allPublishers = semanticResult.allPublishers;
  } else {
    // Legacy path: pure keyword / regex aggregation. Runs for exactSearch,
    // author-less+search-less browsing, or as a graceful fallback when the
    // embedding API is unavailable.
    const queries: any[] = [];
    if (keywordSearchStage) queries.push(keywordSearchStage);
    queries.push(...postFilterStages);
    queries.push({ $addFields: { score: { $meta: 'searchScore' } } });
    queries.push({
      $facet: {
        count: [{ $count: 'totalCount' }],
        documents: [
          { $skip: (page - 1) * show },
          { $limit: show },
          { $project: { _id: 0 } },
          {
            $sort:
              sort === 'rel'
                ? { score: -1 }
                : { price: sort === 'low' ? 1 : -1 },
          },
        ],
        allPublishers: [
          { $match: { publisher: { $exists: true, $nin: [null, ''] } } },
          { $group: { _id: null, publishers: { $addToSet: '$publisher' } } },
          { $project: { _id: 0, allPublishers: '$publishers' } },
        ],
      },
    });

    const results = await booksCol.aggregate(queries).toArray();
    total = results.length > 0 ? results[0].count[0]?.totalCount || 0 : 0;
    books = results.length > 0 ? results[0].documents : [];
    allPublishers =
      results.length > 0 && results[0].allPublishers.length > 0
        ? results[0].allPublishers[0].allPublishers || []
        : [];
  }

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