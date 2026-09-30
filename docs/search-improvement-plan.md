# Search improvement plan

Self-contained spec for reworking search in `Islamic-Book-Compare` (SvelteKit frontend) and the normalizer in the sibling repo `../book-scraper` (Python ingest). An implementer should be able to follow this top to bottom without other context.

## 0. Before starting

- The working tree has an uncommitted change in `src/routes/search/+page.server.ts` that removes `allPublishers` from both search paths and from the load result. Nothing in `src/` reads `allPublishers`, so the change is safe. Commit it on its own first so the rest of this work starts from a clean diff.
- There is no test runner. Add `vitest` as a devDependency and a `"test": "vitest run"` script in `package.json`.
- Key files today:
  - `src/routes/search/+page.server.ts`: the whole search pipeline (normalization, regex search, vector search, ranking, pagination, usage logging).
  - `src/lib/server/embed.ts`: Voyage query embedding (`input_type: "query"`, 4 s timeout, returns `null` on failure).
  - `src/lib/server/warm-vector-index.ts`: keeps the Atlas vector index warm with a stored embedding every 3 min.
  - `src/lib/SearchBar.svelte`: title/author inputs, sort, exact-search checkbox, store/country filters. Debounces 1.1 s, then writes URL params.
  - `src/routes/search/FilterDrawer.svelte`: fuzzy, search-description, show-per-page.
  - `src/routes/search/BookCard.svelte`, `Pagination.svelte`, `+page.svelte`: results UI.
  - `src/lib/index.ts`: `Book` type.
  - `../book-scraper/upload.py`: `sanitize_arabic_text` writes `titleNormalized`, `authorNormalized`, `authorArabicNormalized`, `publisherNormalized`; `_embedding_input` embeds `title` or `title\nauthor` with `input_type="document"`.
- Atlas vector index `vector_index` on `books`: `embedding` (1024-dim, cosine), filter fields `source` and `instock`. The only regular index is `source_1_url_1`.

## 1. Problems found

### Ranking and recall

1. **Keyword and vector search never run together.** Default search embeds the query and takes the 100 nearest in-stock books (`runVectorSearch`). An exact title match only reaches the top if it is already inside that neighborhood. The regex path runs only when Voyage fails or Exact Search is on. Books with no embedding (the embed step failed at ingest) can only be found with Exact Search.
2. **No fallback when vector search returns nothing.** `vectorResult` is non-null even when it has 0 hits, so the regex path is skipped and the user sees "No Books Found".
3. **The text sent to Voyage is not what the user typed.** `sanatizeSearch` output (hamza folded, diacritics and leading `ال` stripped, lowercased) is embedded as `"<title> by <author>"`. Documents were embedded from the raw `title\nauthor`. Query and document text should have the same shape.
4. **The vector neighbor set is small and has no quality floor.** `numCandidates: 200` for `limit: 100` is 2×. Atlas recommends 10–20× for good recall. Every query returns 100 neighbors no matter how weak they are, so a specific title is followed by loosely related books.
5. **Price sort ranks the neighborhood, not the relevant books.** After the substring hits, the rest of the 100 neighbors are sorted by price, so a cheap unrelated item can come right after the typed book.
6. **Keyword "relevance" is alphabetical.** `runRegexSearch` sorts `rel` by `titleNormalized: 1`.
7. **Keyword path limits before it sorts.** `$limit: 100` runs before `$sort` inside the `$facet`, so price sort only orders an arbitrary 100 rows (natural order), and `total` is capped at 100.
8. **The reported total is capped at 100 on both paths** and nothing tells the user.

### Matching

9. **The regex is not escaped.** `(`, `[`, `*`, `+`, `?` in a query either over-match or throw. A throw rejects the streamed `props` promise and shows "Something went wrong".
10. **Whole-string substring only.** `sahih bukhari` does not match `Bukhari Sahih`, and `sahih al-bukhari` does not match `Sahih Bukhari`.
11. **`authorArabicNormalized` is never queried.** An Arabic author name misses when it only exists on that field. `isExactMatch` also ignores it.
12. **Arabic folding is incomplete.** `ة`/`ه`, `ى`/`ي`, tatweel (`ـ`), and Persian/Urdu letters (`ی`, `ک`) are not folded.
13. **Latin diacritics are not folded.** Transliterated titles like `Ṣaḥīḥ al-Bukhārī` do not match `sahih bukhari`.
14. **Leading `ال` stripping damages short words.** `الله` becomes `له`, which as a substring matches a large amount of unrelated text.
15. **The TS and Python normalizers differ.** TS strips `ال` only after start-of-string or whitespace (`(^|\s)ال`). Python uses `\bال`, which also strips after punctuation such as `(` or `-`. Python does not lowercase. Stored and query forms can drift apart.
16. **No handling of common spelling variants** (`Bukhari` / `Bukharee` / `البخاري`, `Tirmidhi` / `Tirmizi`, `Abu Dawud` / `Abu Dawood`).

### Filters and UI

17. **Fuzzy Search does nothing.** The server only passes `fuzzy` to the usage alert.
18. **Search Description does nothing.** The server never reads `searchDesc`, but the Info modal tells users to "Enable 'Search Description' to broaden results".
19. **The Filters button is commented out** in `SearchBar.svelte` (around lines 320–337), so `FilterDrawer` cannot be opened. `hasActiveFilters` in `+page.svelte` does not count `searchDesc`.
20. **One book can fill the first page.** Each store listing is its own result, so a popular title shows up as many near-identical cards instead of one card that compares prices.
21. **Pages past the end show "No Books Found".** A `page` beyond the last page returns an empty slice. `+page.svelte` checks `results.length === 0` before it checks whether `total > 0`.
22. **`Pagination` next-button logic compares a page number to an item index** (`pageNum + 1 > helper.end`). It works only by accident. With `total = 0`, `start` is 1 and `end` is 0.

### Robustness and performance

23. **`page` and `show` are not validated.** `parseInt` can yield `NaN`, 0, or a negative number, which gives a negative `$skip` and a Mongo error. `show=100000` is accepted.
24. **Unindexed second lookup.** After `$vectorSearch`, full documents are fetched with `find({ url: { $in: urls } })`. The only index is `(source, url)`, so a `url`-only filter scans the collection. It also doesn't re-check `instock` or `source`, and it collapses duplicate URLs across stores.
25. **Every page change or sort change re-embeds the query** (Voyage cost, plus up to 4 s of latency). There is no cache.
26. **Keyword and vector searches run one after the other.** Once both always run, they should run in parallel.
27. **Unanchored regexes scan the whole collection.** That's acceptable at the current catalog size, but measure it (section 9).
28. **The README is wrong.** It describes Reciprocal Rank Fusion, a `SEARCH_TYPE` env var, and "keyword autocomplete", none of which exist.

## 2. Target module layout

Split `+page.server.ts` into pure, testable modules. Only `vector.ts`, `keyword.ts`, and `index.ts` touch Mongo or Voyage.

```
src/lib/server/search/
  params.ts        parse + clamp URL params
  normalize.ts     normalizeText, tokenize, escapeRegex, tokenRegex
  aliases.ts       curated alias groups + expandAliases
  fuzzy.ts         one-edit regex expansion
  keyword.ts       build + run keyword query
  vector.ts        embed (with cache) + $vectorSearch
  rank.ts          tier assignment, merge, sort (pure)
  group.ts         collapse listings into one result per book (pure)
  index.ts         runSearch(): orchestration
  *.test.ts        vitest unit tests for the pure modules
```

After the split, `+page.server.ts` keeps `get_stores`, `sendUsageAlert`, `load`, and `actions`. `loadSearchProps` becomes: parse params, call `runSearch`, send the usage alert, and return the result.

## 3. Params (`params.ts`)

```ts
export type SearchParams = {
  search: string;          // raw, trimmed
  author: string;          // raw, trimmed
  page: number;            // integer >= 1
  show: 15 | 45 | 75;      // anything else -> 15
  sort: 'rel' | 'low' | 'high'; // anything else -> 'rel'
  exclude: string[];
  fuzzy: boolean;          // fuzzy=true
  searchDesc: boolean;     // searchDesc=true
  exactSearch: boolean;    // exactSearch=true
};
export function parseSearchParams(url: URL): SearchParams;
```

- `page`: `Number.parseInt`. If the result is not finite or is below 1, use 1. The upper clamp happens after the total is known (section 7).
- Cap `search` and `author` at 200 characters each so a pasted paragraph cannot blow up the regex or alias expansion.

## 4. Normalization (`normalize.ts`)

### 4.1 `normalizeText(s: string): string`

This is the single source of truth. Mirror it exactly in Python (section 10). Apply these steps in order:

1. Apply `NFKC`.
2. Fold Latin diacritics: apply `NFD`, remove `\p{M}` only from Latin letters, then apply `NFC`. Arabic harakat are handled in step 4. Removing all `\p{M}` also works, since step 4 would remove the Arabic ones anyway, so either is fine as long as Python matches.
3. Fold Arabic letters: `أ إ آ ٱ` → `ا`, `ؤ` → `و`, `ئ` → `ي`, `ى` → `ي`, `ی` → `ي`, `ة` → `ه`, `ک` → `ك`.
4. Remove harakat `[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]` and tatweel `\u0640`.
5. Lowercase.
6. Replace everything that is not a letter, a digit, or whitespace with a space. This covers punctuation, hyphens, and apostrophes (including `ʿ ʾ ' ’`). Use `[^\p{L}\p{N}\s]` with the `u` flag.
7. Strip a leading `ال` from each word, but only when at least 3 letters remain. That keeps `الله` intact and turns `البخاري` into `بخاري`. Words are split on whitespace, which is now unambiguous because punctuation is gone. This removes the `\b` vs `(^|\s)` mismatch.
8. Collapse runs of whitespace and trim.

### 4.2 `tokenize(normalized: string): string[]`

- Split on whitespace and dedupe while keeping order.
- Drop stopwords only when at least one non-stopword token remains: `al`, `el`, `the`, `a`, `an`, `of`, `and`, `wa`, `fi`. Keep `ibn`, `bin`, `abu`, `umm`; they carry meaning in names.

### 4.3 `escapeRegex(s)` and `tokenRegex(token, opts)`

- `escapeRegex` escapes `[.*+?^${}()|[\]\\]`.
- `tokenRegex` returns a regex **source string** (used in Mongo `$regex` with `$options: 'i'`):
  - Arabic letters become equivalence classes, so rows that still hold the old normalization also match during the backfill window: `ه` → `[هة]`, `ي` → `[يىئی]`, `ا` → `[اأإآٱ]`, `و` → `[وؤ]`, `ك` → `[كک]`. Allow optional tatweel between letters only if tests show stored data has it. The old normalizer never removed tatweel, so it likely does; the safe choice is `ـ*` between Arabic letters.
  - Latin tokens of 3 characters or fewer are anchored to a word start with `(?:^|[^a-z0-9])`, so `ali` does not match `quality`. Longer Latin tokens and all Arabic tokens stay unanchored, because Arabic attaches prefixes like `و`, `ب`, `ل`, `ف`.
  - With `opts.fuzzy`, delegate to `fuzzy.ts` (section 6.4).

## 5. Aliases (`aliases.ts`)

A hand-maintained list of groups. Each group is a set of equivalent normalized token sequences:

```ts
export const ALIAS_GROUPS: string[][] = [
  ['bukhari', 'bukharee', 'bukhary', 'بخاري'],
  ['muslim', 'مسلم'],
  ['tirmidhi', 'tirmizi', 'tirmithi', 'ترمذي'],
  ['abu dawud', 'abu dawood', 'abu daud', 'ابو داود'],
  ['nasai', 'nasaa i', 'نساي'],
  ['ibn majah', 'ibn maja', 'ابن ماجه'],
  ['nawawi', 'nawawee', 'نووي'],
  ['riyad salihin', 'riyadh saliheen', 'riyadus saliheen', 'رياض صالحين'],
  ['quran', 'qur an', 'koran', 'قران'],
  ['tafsir', 'tafseer', 'تفسير'],
  ['hadith', 'hadeeth', 'حديث'],
  ['sahih', 'saheeh', 'صحيح'],
  ['aqidah', 'aqeedah', 'aqida', 'عقيده'],
  ['fiqh', 'فقه'],
  ['seerah', 'sirah', 'sira', 'سيره'],
  ['ibn taymiyyah', 'ibn taymiya', 'ibn taimiyah', 'ابن تيميه'],
  ['ibn qayyim', 'ibn al qayyim', 'ibn qayyim al jawziyya', 'ابن قيم'],
];
```

- Store every entry already passed through `normalizeText`. Add a unit test that asserts `normalizeText(entry) === entry` for every entry.
- `expandAliases(tokens: string[]): string[][]` returns one or more alternative token lists. Match single-token and multi-token aliases greedily, left to right. Cap at 8 alternatives total.
- In the keyword query, each alternative becomes one AND-of-tokens clause, and the alternatives are ORed together.
- The Arabic alias forms help an English query find Arabic titles and the reverse. They are not a translation layer; keep the list short and high-confidence.

## 6. Keyword search (`keyword.ts`)

### 6.1 Match semantics

Let `T` be the title tokens and `A` the author tokens, both after tokenizing and alias expansion.

- **Title clause:** every token in `T` matches `titleNormalized`, in any order.
- **Author clause:** every token in `A` matches `authorNormalized`, or every token in `A` matches `authorArabicNormalized`.
- **Description clause** (only with `searchDesc`): every token in `T` matches the raw `description`. Use escaped tokens with `i`, no equivalence classes and no fuzzy, because descriptions are not normalized. Author tokens never go against descriptions.
- Base filter on every query: `instock: true`, plus `source: { $nin: exclude }` when `exclude` is set.

### 6.2 Queries

Run one aggregation with `$facet`, or two small aggregations in parallel. Either is fine; pick whichever reads cleaner.

- **Primary:** base filter AND (title clause, if `T` is non-empty) AND (author clause, if `A` is non-empty).
- **Title-only** (only when both `T` and `A` are given): base filter AND title clause AND NOT the author clause. This catches books whose author is missing or spelled differently. They rank below primary hits.
- **Description** (only when `searchDesc` and `T` is non-empty): base filter AND description clause AND NOT the title clause.

Each query:

```
$match
$addFields: { _titleLen: { $strLenCP: { $ifNull: ['$titleNormalized', ''] } } }
$sort: { _titleLen: 1, _id: 1 }
$limit: KEYWORD_LIMIT            // 400 primary, 200 title-only, 200 description
$project: { embedding: 0, embeddingModel: 0 }
```

Sorting by title length before the limit keeps the cap deterministic and biased toward concise titles, which are usually the better match. Also return an uncapped `$count` for the primary query so the UI can say "400+".

### 6.3 Exact Search

Exact Search means a contiguous phrase: the whole normalized title string, run through `tokenRegex`-style equivalence classes but as one pattern, must appear in `titleNormalized`. The same applies to the author (against either author field). No aliases, no fuzzy, no vector, no description. Results are ranked with the same keyword tier scoring (section 8).

### 6.4 Fuzzy (`fuzzy.ts`)

- Applies only to Latin tokens of 5 or more characters. Arabic tokens are left as they are, since the folding and equivalence classes already cover most Arabic variation.
- A token `t` of length `n` becomes an alternation `(?:t|v1|v2|...)` of one-edit variants:
  - substitution or deletion at each position `i`: `t[:i] + '.?' + t[i+1:]`
  - insertion at each position `i`: `t[:i] + '.' + t[i:]`
  - adjacent transposition: `t[:i] + t[i+1] + t[i] + t[i+2:]`
- Escape each variant's literal pieces. Cap total variants per query at 120. If the cap is hit, fuzz only the longest tokens first.
- Fuzzy stays off for Exact Search.

## 7. Vector search (`vector.ts`)

- **Query text:** use the raw trimmed input, not the normalized one. When both are present, use `${search}\n${author}` to mirror `_embedding_input`. Otherwise use whichever one is present.
- **Embedding cache:** an in-process LRU `Map` keyed by `${model}|${text}`, with 500 entries and a 1 h TTL. Store it on `globalThis`, as `warm-vector-index.ts` does, so it survives HMR. On a Voyage failure, cache nothing and return `null`.
- **Pipeline:**

```
$vectorSearch: {
  index: 'vector_index', path: 'embedding', queryVector,
  numCandidates: VECTOR_NUM_CANDIDATES,   // 1500 (15 x limit)
  limit: VECTOR_LIMIT,                    // 100
  filter: { instock: true, source?: { $nin: exclude } },
}
$project: { embedding: 0, embeddingModel: 0, _id: 0, score: { $meta: 'vectorSearchScore' } }
```

  Return full documents from this stage and delete the second `find({ url: { $in } })` lookup (problem 24).
- **Score floor:** `VECTOR_SCORE_FLOOR = 0.72`. For cosine indexes, Atlas's `vectorSearchScore` is `(1 + cosine) / 2`, so this is roughly cosine 0.44. The constant needs calibration: when `process.env.SEARCH_DEBUG === 'true'`, log `[search] vector scores` with the top 20 `(score, title)` pairs. Run the smoke queries from section 12, then pick a floor that keeps true matches and drops obvious noise.
- **Shared constants:** move `VECTOR_INDEX_NAME`, `VECTOR_NUM_CANDIDATES`, and `VECTOR_LIMIT` into `vector.ts` and export them. Make `warm-vector-index.ts` import them, so the warmer exercises the same candidate count real queries use.
- **Filters:** Exact Search skips vector entirely. Fuzzy and description do not affect vector.

## 8. Ranking (`rank.ts`, pure)

Input: keyword primary hits, title-only hits, description hits, and vector hits (each with `score`). All are full book docs keyed by `(source, url)`. Dedupe on that pair and keep the highest tier.

### 8.1 Tiers

| Tier | Contents |
|---|---|
| 1 | Keyword primary hits |
| 2 | Keyword title-only hits (only when both title and author were given) |
| 3 | Vector hits with `score >= VECTOR_SCORE_FLOOR` that are not already in tier 1 or 2 |
| 4 | Description hits not already listed |

If tiers 1–4 are all empty and vector returned anything, use the top 10 vector hits regardless of the floor, as tier 3. That way a paraphrase ("book about patience") still shows something.

### 8.2 Order within a tier (`sort=rel`)

Sort descending on this tuple:

1. `phrase`: 1 if the normalized query (title part) is a contiguous substring of `titleNormalized` (after running `titleNormalized` through the new `normalizeText` in JS, so old rows compare fairly). Otherwise 0.
2. `prefix`: 1 if `titleNormalized` starts with the first query token.
3. `coverage`: `queryTitleChars / max(titleChars, 1)`, clamped to 1. Shorter titles that are mostly the query win.
4. `vectorScore`: the doc's vector score if it was also a vector hit, otherwise 0.
5. `price` ascending, as a stable tiebreak.

Author-only queries use the same tuple computed against the matched author field.

### 8.3 Price sorts

For `sort=low` or `sort=high`: take tiers 1–3 (tier 4 too when `searchDesc` is on), drop the tier boundaries, and sort by price. Treat `null` or missing prices as `+Infinity` for `low` and `-Infinity` for `high`, so they always sink to the bottom. The candidate set is the relevant set; loose neighbors below the floor never enter.

### 8.4 Output

```ts
export type RankedBook = BookDoc & { _tier: 1 | 2 | 3 | 4; _rank: number };
export function rankResults(input: RankInput, sort: SearchParams['sort']): RankedBook[];
```

Keep `_tier` on the output (strip it before sending to the client unless `SEARCH_DEBUG`). It makes the tests and the debug logging readable.

## 9. Grouping (`group.ts`, pure)

Collapse listings of the same book after ranking and before pagination.

- **Group key:** `normalizeText(title) + '|' + normalizeText(author ?? authorArabic ?? '')`. Do **not** reuse `book-scraper/title_key.py`: it strips volume and edition markers, which would merge Vol. 1 with Vol. 2.
- **Group rank:** the best (lowest) `_rank` among its members.
- **Primary offer:** the member with the lowest non-null price. Ties go to the best `_rank`. The group's top-level fields are the primary member's fields, so existing `Book` consumers keep working.
- **`offers`:** the other members, sorted by price ascending, as `{ source, price, url, instock }`.
- **Price sorts** order groups by their primary (cheapest) price, both for `low` and `high`.

Add to `src/lib/index.ts`:

```ts
export type Offer = { source: string; price: number | null; url: string; instock: boolean };
export type Book = { /* existing fields */ offers?: Offer[] };
```

## 10. Orchestration (`index.ts`)

```ts
export type SearchResult = {
  results: Book[];
  total: number;        // number of groups
  totalCapped: boolean; // keyword primary count > KEYWORD_LIMIT
  page: number;         // effective page after clamping
  start: number;        // 0 when total is 0
  end: number;
};
export async function runSearch(db: Db, p: SearchParams): Promise<SearchResult>;
```

1. With no title and no author, return an empty result. That matches today's behavior.
2. Run the keyword queries and the vector search in parallel with `Promise.allSettled`. A vector failure means no vector hits. A keyword failure is logged and treated as no keyword hits. Only when both fail does the function throw, which shows the existing error state.
3. Rank, then group.
4. Clamp `page` to `[1, max(1, ceil(total / show))]` and slice.
5. `start = total ? (page - 1) * show + 1 : 0` and `end = min(page * show, total)`.
6. Strip `_tier` and `_rank` (unless debugging) and return.

In `+page.server.ts`, add `searchDesc` to `sendUsageAlert`, both in the message and in the `usage` document.

## 11. Catalog normalization (`../book-scraper`)

1. Replace `sanitize_arabic_text` in `upload.py` with a Python port of `normalizeText` (section 4.1), keeping the name so `enrich_authors.py` keeps working. Use `unicodedata` for NFKC/NFD and the `regex` module (or explicit ranges) for `\p{L}\p{N}`.
2. Add `tests/test_normalize.py` with the same case table as `src/lib/server/search/normalize.test.ts`. Copy the table into both repos, and put a comment at the top of each saying it must stay in sync with the other.
3. Add `backfill_normalized.py`. It iterates `books` in `_id` batches of 1000 and recomputes `titleNormalized`, `authorNormalized`, `authorArabicNormalized`, and `publisherNormalized` with `bulk_write(UpdateOne)`. It skips rows whose values don't change, and it's idempotent and resumable (log the last `_id`).
4. Do not re-embed. Embeddings are built from the raw `title`/`author`, not the normalized fields.

### Deploy order

1. Deploy the frontend changes. The Arabic equivalence classes in `tokenRegex` match both old and new stored forms, so nothing depends on the backfill for Arabic.
2. Right after, deploy the scraper normalizer and run `backfill_normalized.py`. Until it finishes, only Latin-diacritic titles (`Ṣaḥīḥ`) miss the plain-ASCII query. That window is small and accepted.

## 12. UI changes

### `SearchBar.svelte`
- Uncomment the Filters button (around lines 320–337) so `FilterDrawer` is reachable again. The `hasAnyActiveFilter` indicator is already wired.

### `+page.svelte`
- Add `hasSearchDesc: searchParams.get('searchDesc') === 'true'` to `hasActiveFilters` and to `hasAnyActiveFilter`.
- Show the empty state only when `props.total === 0`. The server now clamps `page`, so an empty page with `total > 0` shouldn't happen.
- Pass `props.page` into `Pagination` instead of `clampPageNum(...)`, and delete `clampPageNum`.
- Keep the Info-modal tip about Search Description (it is true now). Add a tip: "Word order and common spellings (Bukhari / Bukharee / البخاري) are handled automatically".

### `Pagination.svelte`
- Accept `totalCapped`. Render the total as `400+` when it's set.
- The next button is disabled when `pageNum >= ceil(total / show)` and calls `setPage(pageNum + 1)`. Prev stays as it is.

### `BookCard.svelte`
- Under the main price, when `book.offers?.length`, show "Also at:" with up to 3 rows of `source – price` (converted with the same `currency.rate`), plus "+N more" that expands in place.
- Each offer row is an `<a href={offer.url} target="_blank" rel="noopener noreferrer">` with `on:click|stopPropagation`. It posts to `/api/book-clicked` with that offer's `source`, `price`, and `url` and the parent's `title`/`author`, reusing the body shape from `handleBookClick`.
- The card click and the bookmark keep using the primary `book.url`.

### `FilterDrawer.svelte`
- No logic changes. Reword the labels to describe the behavior: "Fuzzy search (tolerate one typo per word)" and "Also search descriptions".

## 13. README

Replace the "Semantic (hybrid) search setup" intro and remove `SEARCH_TYPE`. Describe:
- keyword and vector searches running in parallel, then merged in tiers (section 8)
- the raw query text sent to Voyage, in `title\nauthor` form
- the score floor and `SEARCH_DEBUG`
- what Fuzzy Search, Search Description, and Exact Search do
- one result per book, with other stores listed on the card
- `backfill_normalized.py`

## 14. Tests

### Unit (vitest, no Mongo)

- `normalize.test.ts`:
  - hamza forms, `ة`/`ه`, `ى`/`ي`, tatweel, harakat, Persian letters
  - `الله` preserved, `البخاري` → `بخاري`, `(البخاري)` → `بخاري`
  - `Ṣaḥīḥ al-Bukhārī` → `sahih al bukhari`, and tokenize → `['sahih', 'bukhari']`
  - `escapeRegex` on `a(b)*c+?`
  - `tokenRegex('مكتبه')` matches both `مكتبة` and `مكتبه`
  - a short Latin token does not match inside a word
- `aliases.test.ts`: every entry is already normalized; `bukharee` expands to include `بخاري`; the expansion cap is enforced.
- `fuzzy.test.ts`: `bukhary` fuzz matches `bukhari`; tokens under 5 characters are not fuzzed; the variant cap holds.
- `rank.test.ts` with fixture docs:
  - an exact title beats a higher-scoring vector neighbor
  - a swapped word order still lands in tier 1
  - a below-floor neighbor is excluded when keyword hits exist
  - with no keyword hits and all neighbors below the floor, the top 10 neighbors are returned
  - `low` and `high` never include below-floor neighbors
  - null prices sink to the bottom
  - title-only hits rank under primary hits
- `group.test.ts`:
  - three stores of the same title/author become one group, with the cheapest as primary and the other two in `offers` sorted by price
  - Vol. 1 and Vol. 2 stay separate
  - group order follows the best member's rank
- `params.test.ts`: `page=abc`, `page=-3`, `show=1000`, `sort=foo` all fall back to their defaults.

### Manual (dev server, browser)

Run each of these and record the top 5 results before and after the change:

1. an exact Arabic title (e.g. `صحيح البخاري`)
2. `sahih bukhari` and `bukhari sahih`
3. `Bukharee`
4. an Arabic author only, whose name exists only in `authorArabic`
5. a query containing `(` (must not error)
6. Exact Search on with a partial phrase
7. both price sorts on `riyad saliheen`
8. Fuzzy on with `tirmizhi`
9. Search Description on with a word that appears only in descriptions
10. a title sold by several stores (one card, nested prices)
11. `page=999` (clamps to the last page)
12. a paraphrase like `book about patience` (the vector-only fallback)

Also check timing with `SEARCH_DEBUG`: log keyword ms, vector ms, and total ms per request.

## 15. Open decisions and risks

- **Keyword backend.** Unanchored `$regex` on `titleNormalized`, `authorNormalized`, and `description` scans the collection on every search. Measure with `explain('executionStats')` on the primary query. If p95 goes over ~300 ms, move the keyword side to an Atlas Search (`$search`) index with a custom analyzer. That would also replace the hand-rolled fuzzy (`fuzzy: { maxEdits: 1 }`), token-order matching, and relevance scoring, since the cluster is already Atlas. It's a larger change and is left out of this plan on purpose.
- **Score floor calibration.** `0.72` is a starting value. It must be tuned with `SEARCH_DEBUG` output before release.
- **Keyword cap.** Very broad queries (`quran`, `hadith`) match thousands of rows. Only the 400 shortest titles are ranked and price-sorted. That's acceptable for now, and the UI shows `400+`.
- **Grouping key strictness.** Titles that differ only in subtitle or edition text will not merge. That's intentional, since a false merge is worse than a duplicate card.
