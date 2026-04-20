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

### Semantic (hybrid) search setup

Search uses Atlas Vector Search fused with the existing keyword autocomplete via Reciprocal Rank Fusion. To enable it:

1. Add your Voyage API key to `.env`:
   ```
   VOYAGE_API_KEY=pa-...
   VOYAGE_MODEL=voyage-4-large    # optional; defaults to voyage-4-large (1024-dim)
   SEARCH_TYPE=hybrid             # 'hybrid' | 'vector' | 'keyword' (A/B testing)
   ```
   The same key is also used by `book-scraper` at ingest time. If the key is missing, search transparently falls back to keyword-only. `SEARCH_TYPE` lets you flip between the three search backends at deploy-time without code changes.

2. Create an Atlas Vector Search index named `vector_index` on the `books` collection:
   ```json
   {
     "fields": [
       { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine" },
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you find this project helpful, consider supporting it:

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-☕-yellow.svg)](https://www.buymeacoffee.com/aamohammedc)

Your support helps maintain and improve this project for the Islamic community.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.