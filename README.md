# Nima Khaki — Engineering portfolio

Static engineering portfolio at [nima0101.github.io](https://nima0101.github.io/), with public open-source evidence and engineering work across systems, backend, data, AI tooling, native applications and delivery.

[GitHub profile](https://github.com/Nima0101) · [Engineering Index](https://github.com/Nima0101/Nima0101/blob/main/ENGINEERING_INDEX.md)

## Site maintenance

The site is plain HTML and CSS, with no client-side JavaScript, external fonts or analytics. Serve this directory with any static HTTP server to preview it. GitHub Pages publishes the root of `main`; `.nojekyll` keeps the static files unchanged.

The project gallery uses seven local, optimized images with selectable descriptions and creator attribution. Keep product-system entries free of source/site links; only public OSS entries link to repositories.

The Engineering Index is the editorial source for the detailed narrative. When it changes, synchronize the corresponding HTML sections, review the opening and project cards, and update the sitemap date only for a substantive change. Validate links, visible text, accessibility, structured data and crawler policy before publishing.

The JSON-LD describes the visible person and public repositories. `robots.txt` allows OAI-SearchBot for search discovery and separately disallows GPTBot. Those are independent crawler preferences; neither policy guarantees indexing or citations.

## Browser verification

The Site checks workflow uses Chromium and axe to check light/dark desktop, tablet and mobile layouts, keyboard skip navigation, horizontal overflow, local fragment links and content with JavaScript disabled. It also checks all seven images for successful loading, alt text, aspect ratio and no upscaling. Manual workflow inputs `site_url` and `profile_url` enable HTTPS live-site and GitHub-rendered README checks. `SITE_URL` and optional `BROWSER_EXECUTABLE` support local verification.

Screenshots and the accessibility report are retained as workflow artifacts. These automated checks complement manual review; they are not a complete accessibility certification. Verification dependencies are isolated under `.github/check` and are not used by the website.
