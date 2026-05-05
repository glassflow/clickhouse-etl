# Viewing the design files locally

Open `index.html` in a browser by serving this directory as a static site — double-clicking the HTML file won't work because the browser blocks local `file://` JSX/CSS imports.

## Quickstart

From the repo root:

```bash
cd docs/claude_design_handovers/glassflow-revamp-reimagined/project
npx serve .
```

Then open **http://localhost:3000** — the index page lists all 16 screens.

## Alternative (no npx)

```bash
cd docs/claude_design_handovers/glassflow-revamp-reimagined/project
python3 -m http.server 8765
```

Open **http://localhost:8765**.

> If you see "MIME type mismatch" errors in the console when using `python3`, switch to `npx serve .` — it serves `.jsx` files with the correct `application/javascript` type.

## Why a server is needed

The HTML files load JSX component files via `<script src="components/…">`. Browsers block cross-origin/local script loads on `file://` URLs (CORS). A local HTTP server bypasses this.
