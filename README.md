# Islamic Book Compare

A comprehensive search platform for Islamic books across multiple online bookstores. Find the best prices and availability for Islamic literature from various trusted sources.

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-☕-yellow.svg)](https://www.buymeacoffee.com/aamohammedc)

## Features

-  **Advanced Search**: Search by title, author, or description
-  **Multiple Stores**: Compare prices from various Islamic bookstores
-  **Price Comparison**: Find the best deals across different platforms
-  **Responsive Design**: Works seamlessly on desktop and mobile
-  **Dark Theme**: Easy on the eyes with a modern dark interface
-  **Fast Performance**: Optimized for quick search results

## Tech Stack

- **Frontend**: SvelteKit, TypeScript, Tailwind CSS
- **UI Components**: Flowbite Svelte
- **Backend**: Python FastAPI (book scraper)
- **Database**: MongoDB

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python 3.8+
- MongoDB

### Installation

1. Clone the repository:
```bash
git clone https://github.com/PhantomLel/Islamic-Book-Compare.git
cd Islamic-Book-Compare
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd ../book-scraper
pip install -r requirements.txt
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### How search works

Every search runs two lookups **in parallel** and merges them in tiers:

1. **Keyword search** on the normalized catalog fields (`titleNormalized`, `authorNormalized`, `authorArabicNormalized`). Every word must match, in any order, so `bukhari sahih` finds `Sahih al-Bukhari`. Text is folded before matching (Latin diacritics, Arabic hamza/`ة`/`ى`/tatweel/harakat, leading `ال`), and a short curated alias list handles common spellings (`Bukhari` / `Bukharee` / `البخاري`).
2. **Vector search** (Atlas Vector Search + Voyage embeddings). The query is embedded from the *raw* text you typed, in the same `title\nauthor` shape the documents were embedded with. Query embeddings are cached in memory for an hour.

Results are ranked in tiers: (1) keyword matches on title and author, (2) title matches whose author differs or is missing, (3) vector neighbors scoring at least `VECTOR_SCORE_FLOOR` (`src/lib/server/search/vector.ts`), (4) description matches when *Also search descriptions* is on. Within a tier, results are ordered by phrase match, prefix match, title coverage, vector score, then price. If nothing matches at all, the 10 nearest neighbors are shown so paraphrases like "book about patience" still return something. The price sorts order only the relevant set (tiers 1-3, plus 4 with descriptions on); they never pull in loose neighbors.

Listings of the same book (same title and author) from different stores are collapsed into **one card**, showing the cheapest store with the others listed under "Also at". Broad queries are capped at the 400 shortest matching titles; the result count then shows `N+`.

Filters:

- **Exact Search**: the typed title/author must appear as one contiguous phrase. Keyword only: no aliases, fuzzy, vector, or description search.
- **Fuzzy search**: tolerates one typo per word (Latin words of 5+ letters).
- **Also search descriptions**: adds books whose description contains the words.

Without a Voyage key (or if Voyage is down) search transparently falls back to keyword-only.

To calibrate the score floor or check timings, run with `SEARCH_DEBUG=true`: each search logs the top 20 vector `(score, title)` pairs and the keyword / vector / total milliseconds.

`VECTOR_NUM_CANDIDATES` trades recall for latency. Atlas recommends 10-20x the result limit (100); the default is 1000. This only stays fast because `vector_index` uses scalar quantization (see step 2 below); without it the index does not fit in the cluster's memory and every query takes several seconds.
Search code lives in `src/lib/server/search/`. Run its unit tests with `npm test`.

### Semantic search setup

1. Add your Voyage API key to `.env`:
   ```
   VOYAGE_API_KEY=pa-...
   VOYAGE_MODEL=voyage-4-large    # optional; defaults to voyage-4-large (1024-dim)
   VECTOR_NUM_CANDIDATES=1000     # optional; ANN candidates per vector query (default 1000)   SEARCH_DEBUG=true              # optional; logs vector scores and timings per search
   ```
   The same key is also used by `book-scraper` at ingest time. If the key is missing, search transparently falls back to keyword-only.

2. Create an Atlas Vector Search index named `vector_index` on the `books` collection:
   ```json
   {
     "fields": [
       { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine", "quantization": "scalar" },
       { "type": "filter", "path": "source" },
       { "type": "filter", "path": "instock" }
     ]
   }
   ```

3. Run a one-off backfill from `book-scraper` to embed existing books:
   ```bash
   cd ../book-scraper
   python backfill_embeddings.py
   ```
   Subsequent scraper runs embed new/changed books automatically (cached per title+author, so re-crawls are effectively free).

4. Recompute the normalized search fields whenever the normalizer changes (and once after upgrading to this search):
   ```bash
   cd ../book-scraper
   python backfill_normalized.py --dry-run   # how many rows would change
   python backfill_normalized.py
   ```
   The scraper's `normalize.py` is a port of `normalizeText` in `src/lib/server/search/normalize.ts`; the two must stay identical (both have a test with the same case table). The backfill is idempotent and resumable (`--start-after <last_id>`). It does not touch embeddings. Deploy the frontend first: its Arabic matching accepts both the old and new stored forms, so only Latin-diacritic titles (`Ṣaḥīḥ`) miss plain-ASCII queries until the backfill finishes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you find this project helpful, consider supporting it:

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-☕-yellow.svg)](https://www.buymeacoffee.com/aamohammedc)

Your support helps maintain and improve this project for the Islamic community.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.