# PseudoChess

Reverse chess with forced captures. Normal board, pieces and moves, but you **win** by getting your
king checkmated or by losing every piece except your king. If you can capture, you must.

Built as an installable, offline-capable PWA (Vite + React + TypeScript), packaged for the
Microsoft Store with PWABuilder. See `Docs/pseudochess-spec.md` and `Docs/build-plan.md`.

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Engine unit tests (Vitest) |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run ui:smoke` | Headless Playwright smoke test against the preview server |
| `npm run icons` | Regenerate PNG icons from `public/icons/icon.svg` |
| `npm run bench -- [sec] [depths]` | Engine speed benchmark, e.g. `npm run bench -- 30 3,4,5,6,7` |
| `npm run selfplay -- [games] [depth] [cfgA] [cfgB]` | Engine vs engine, for tuning weights |

## Layout
- `src/engine/` – pure TypeScript rules, evaluation and search (no DOM). `board.ts` is a custom
  0x88 move generator verified by perft and by differential tests against chess.js (dev-only oracle).
- `src/worker/` – runs the AI search in a Web Worker
- `src/ui/` – React components and hooks
