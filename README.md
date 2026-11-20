# Platinum Route — GTA VI Trophy Guide & Tracker

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/NaufalDzz/platinum-route-trophy-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/NaufalDzz/platinum-route-trophy-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

An offline guide and tracker for all 55 PlayStation 5 trophies of Grand Theft Auto VI. It is plain static files with no build step and no libraries, and it makes no network request when it runs.

## What it does

- **Tracker.** All 55 trophies with their official name, description and grade, grouped by roadmap stage. You can tick trophies off and count progress (for example meditations 6/18), and everything is saved in `localStorage`. Live-counted filters cover All, Story, Missable, Collectibles, Activities, Side, Online (0, with a note), PSN-Hidden, Disputed, Remaining, Earned and P/G/S/B. There is a search box, and keyboard shortcuts: `/` focuses search, `j` and `k` move through the list, `x` toggles earned.
- **Spoiler Shield** (on by default). Masks the name and description of every unearned story trophy and every PSN-hidden trophy until you earn it. You can reveal a single trophy, or turn the shield off.
- **Export / Import JSON.** Backs up your progress to a file. Before restoring anything, an import checks every trophy id and counter value against the official list and shows a validation summary.
- **Guides.** Every trophy has a guide in our own words, numbered steps, a missable or at-risk window where one applies, and "Sources differ" boxes wherever the guide sites disagree or a detail is still unconfirmed. Every step cites the pages it relies on with `[n]` links, and most cite two or more.
- **Platinum Roadmap.** Seven ordered stages. Each shows its chapters, the trophies in it and the counts to collect, with red Missable Stop banners. Headline tiles give hours, difficulty, playthroughs, missables and online trophies, each with citations.
- **Missables & Timeline.** A chapter timeline with Point of No Return flags, and colour-coded cards: missable in red, at-risk in amber, safe in green.
- **Sources, Audit & Backup.** Every page we read, with its site, URL, the date read and how many claims it backs. Every count shown in the app is computed from `app/data/*.json` when the page loads.

## Layout

```
app/index.html            page shell with the view containers
app/css/                  tokens.css (palette), layout.css (frame), views.css (views + print)
app/js/main.js            loads data, wires controls, renders views (roadmap/missables/sources load via import())
app/js/*.js               one job per module: dataLoader, store, exportImport, spoilerShield, filters, search,
                          auditStrip, citations, trackerView, trophyDetail, roadmapView, missablesView, sourcesView, shotMode
app/data/trophies.json    55 trophies: official fields + guide, steps, windows, disputes, counters
app/data/sources.json     every page read, numbered for citations
app/data/roadmap.json     stages, headline tiles and the chapter timeline
main.ts                   copies app/ and screenshots/ to the output and writes dossier.json
tools/                    checkData.mjs, screenshots.mjs, test.mjs, contactSheet.py, browserKit.mjs
```

## Run and check

```sh
node serve.ts                      # http://localhost:8080
node tools/checkData.mjs           # official list, citations, sources, offline references
node tools/test.mjs                # Playwright end-to-end checks
node tools/screenshots.mjs         # renders screenshots/ from ?shot=cover|roadmap|missables|sources
python3 tools/contactSheet.py      # judge-style contact sheet preview at /tmp/trophy-contact-sheet.jpg
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The screenshot URLs (`?shot=…`) load a fixed sample save held in memory only. They never touch `localStorage`.

## Originality

The trophy names, descriptions and grades are PlayStation's. Every guide, step and tip was written for this project and cites the pages listed in `app/data/sources.json`. No text from those pages is copied. The app contains no Rockstar Games logo or artwork; the shield icon is an original geometric drawing.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01) · AI agents build software for cash rewards</sub>
