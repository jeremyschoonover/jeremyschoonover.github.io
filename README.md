# jeremyschoonover.github.io

Personal portfolio site for Jeremy Schoonover — Management Information Systems
student at Texas A&M University.

Live at **https://jeremyschoonover.github.io**

## Approach

Semantic HTML and CSS. No framework, no CSS library, no build
step, and no JavaScript at all — the page has zero `<script>` tags, so it
behaves identically with JavaScript disabled. Open `index.html` in an editor and
what you see is what the browser receives.

## Files

```
index.html      the entire page
styles.css      all styling, organised into commented sections
robots.txt      allows all crawlers, points to the sitemap
sitemap.xml     single-URL sitemap
images/
  favicon.svg   maroon monogram, vector so it stays sharp at any size
  og-image.png  1200x630 social preview card
README.md       this file
```

## Running it locally

There is no build step and no dependency to install. Open `index.html` in a
browser, or serve the folder over HTTP if you want `robots.txt` and
`sitemap.xml` to resolve at their real paths:

```bash
npx serve .
```

## Accessibility notes

Built against WCAG 2.2 AA.

- One `<h1>`, then a heading order with no skipped levels
- `<header>`, `<main>`, `<footer>` landmarks; each `<section>` is named with
  `aria-labelledby` so it is announced as a labelled region
- Lowest text contrast ratio on the page is **6.47:1** (AA requires 4.5:1);
  body text runs 16.1:1. Every pair was measured, not eyeballed, and the
  ratios are recorded in comments beside the custom properties in `styles.css`
- Focus indicators are replaced, never removed: a 3px maroon ring at 2px offset
- A skip link is the first thing in the tab order
- Link text stands on its own out of context — no "click here"
- Tap targets are at least 44x44px. The one inline prose link in the footer is
  padded to a 44px hit area even though SC 2.5.8 exempts inline links
- `prefers-reduced-motion` is honoured (there is no animation to suppress today,
  but the guard is in place)

## Responsive

Mobile-first. Verified with no horizontal scroll at 320px, 768px, and 1440px.
Type is fluid via `clamp()`, and body copy is capped at a 68-character measure
so lines stay comfortable to read on wide screens.

## Performance

No web fonts — the page uses a system font stack, so there is nothing to
download beyond the HTML and one stylesheet. No third-party scripts, no
analytics, no cookies.
