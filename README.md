# Don't Forget — Multi-Category Tracker

A personal tracker for anime, books, movies/TV, budget/purchases, assignments, and goals/ideas — so nothing you meant to follow up on gets lost.

## Structure

```
index.html          Dashboard — totals across every category
anime.html           
books.html            Each page is thin HTML: just a shell + a
movies.html           schema config passed to initTracker()
budget.html
assignments.html
goals.html
style.css            All styling (sidebar, forms, cards, dashboard)
app.js                Shared engine: sidebar, generic CRUD/render
                       logic, dashboard aggregation
```

No build step, no dependencies — plain HTML/CSS/JS.

## How it works

Every category page (e.g. `books.html`) just declares a **schema** and calls `initTracker(schema)`:

```js
initTracker({
  key: "books",
  storeKey: "books_v1",       // localStorage key — keep unique per category
  eyebrow: "Personal Log",
  title: "Reading List",
  sub: "...",
  fields: [ ... ],             // form fields, first one is treated as the "title"
  statuses: [ ... ],           // optional — omit for categories with no status
  hasRating: true,              // optional star rating
  priceField: "price",          // optional — adds ₦ price + budget total
  dueField: "dueDate",           // optional — adds due-date badges + sort
  tagField: "tags",              // optional — which field drives the filter chips
});
```

`app.js` handles the rest: rendering the form, saving to `localStorage`, filtering, sorting, export/import, and the card grid.

## Adding a new category (e.g. "Podcasts")

1. Add it to `CATEGORY_LIST` in `app.js` (controls sidebar nav).
2. Add it to the array passed to `initDashboard(...)` in `index.html`.
3. Copy any existing page (e.g. `books.html`), rename to `podcasts.html`, and edit the `initTracker({...})` config to match your fields.

No changes to `app.js`'s engine logic needed for a typical category.

## Run locally

```bash
npx serve .
```
or just open `index.html` directly in a browser.

## Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. Import at [vercel.com/new](https://vercel.com/new).
3. Framework preset: **Other** — no build command needed.
4. Deploy.

## Data storage

Each category's entries live under its own `localStorage` key (e.g. `anime_shelf_v1`, `budget_v1`), scoped **per browser/device** — visiting the deployed URL on a different device or browser starts a fresh, separate list.

- Use **Export JSON** on any page to back up that category.
- Use **Import JSON** to merge or replace entries, including moving data to another device.
- For real cross-device sync, you'd need a backend (Vercel KV, Supabase, etc.) — ask if you want that added later.
