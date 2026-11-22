# Design

Brand from lotfybronze.com and its logo: **bronze `#A26E55`**, ink `#323232`, deep navy `#181B31`; **Forum** for headings, **Roboto** for text (self-hosted via `@fontsource`).
The shell and the rules follow Production-Control:

- A deep sidebar (the site's navy) down the left, resting as a strip of icons and opening over the page on hover, or kept open with its pin; a white top bar with the place's name, light/dark and the account. Below 1024 px a drawer (☰).
- Calm grey pages, white work surfaces; bronze is the accent — actions, the lit place, focus — never the chrome.
- Which bronze when (each passes WCAG AA for its job, both themes): `--brand` borders, bars, dots; `--brand-fill` under white text; `--brand-ink` for bronze text; `--brand-light` a tint behind it.
- Status colours are kept apart from the brand: ok / warn / bad / info / neutral, always with a label.
- One type scale (11 label · 12 · 13 data floor · 14 · 22 title · 28 KPI); a 4 px spacing step; three radii.
- Every list sits in `DataTable`: sticky head, sort by a head, one search, Excel of exactly what is shown, PDF via print, rows become cards on a phone.
- One bar of filters over a page (`FilterBar`), kept in the address so a link shares the view.
- Charts: thin marks, recessive grid, one axis, a legend only for two series, a hover tooltip on each; the categorical colours (`--viz-*`) were checked with the dataviz validator in light and dark.
- Dark mode is selected, not flipped: its own steps of each token.
