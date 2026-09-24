# cURL Viewer

Static HTML/CSS/JS app — paste a curl command, run it in-browser, and inspect the response (normal or streaming) as pretty-printed JSON. No build step, no dependencies.

## Files

- [index.html](index.html) — two-column layout: request panel (left), response panel (right)
- [app.js](app.js) — curl command parser, fetch execution, streaming logic, JSON pretty-printer
- [style.css](style.css) — dark theme, toggle switch, syntax highlighting colors

## Run the dev server

This is a static site, so any local HTTP server works. Serve it on port 8934:

```bash
cd "/Users/arunabharjun/Documents/AI POCs/Listings AI Onboarding/CURL Viewer" && python3 -m http.server 8934
```

Then open http://localhost:8934/index.html.

To stop it:

```bash
pkill -f "http.server 8934"
```

## Notes

- Requests run client-side via `fetch`, so cross-origin APIs without CORS headers will be blocked by the browser — this is a browser limitation, not a bug in the app.
- Streaming mode treats each chunk as a snapshot (not a byte delta). A chunk that's an additive extension of the current one (string grew, object kept old fields, array grew) replaces it in place; a non-additive chunk means the current block is done, and the new chunk starts as the next block. The final view combines all completed blocks.
