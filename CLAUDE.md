# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PseudoChess is reverse chess with forced captures: you win by getting your king checkmated or by losing every piece except your king, and if you can capture you must. It ships as an offline-capable PWA (Vite + React 19 + TypeScript + Tailwind 4, `vite-plugin-pwa`) packaged for the Microsoft Store with PWABuilder.

## Project rules

- The source of truth for rules and AI design is `Docs/pseudochess-spec.md`. Read it before any engine work.
- `src/engine` must stay pure TypeScript: no React, no DOM, no browser APIs.
- Write or update Vitest tests for every engine change and run `npm test` before saying a task is done.
- Keep functions small and typed, no `any`.
- Never delete files or folders without asking first.
- Summarise what changed at the end of each task.

## Commands

- `npm run dev`: dev server. `npm run build`: type-check (`tsc --noEmit`) then production build to `dist/`. `npm run lint`: type-check only.
- `npm test`: all Vitest tests (`src/**/*.test.ts`, 60 s timeout because search tests are slow). One file: `npx vitest run src/engine/__tests__/rules.test.ts`; one test: add `-t "name"`.
- `npm run ui:smoke`: headless Playwright smoke test (desktop and phone, drag and drop, keyboard, resume after reload, settings, privacy page). Needs `npm run preview` running. `npm run screenshots` needs it too.
- Engine tooling (run with `tsx`, Node only): `npm run bench -- [sec] [depths]`, `npm run selfplay -- [games] [depth] [cfgA] [cfgB]`, `npm run tune -- [pairs] [depth] [seed]` (Elo of weight variants vs `DEFAULT_WEIGHTS`).
- `npm run icons` regenerates app icons and Store art; `npm run sfx:preview` renders the synthesised sounds to WAV in `test-results/sfx`.
- No Python on this machine: drive Playwright and other tooling from Node.

## Architecture

**Engine (`src/engine`)**, public API in `index.ts`:
- `board.ts` is a custom 0x88 board with Zobrist hashing. Internally moves are packed integers (`mFrom`, `mTo`, `mPromo`, `mCaptured`, `mPiece`, `FLAG_*`) with `makeMove`/`unmakeMove` for search; the string-typed API (`make`, `undo`, `history`, `allLegalMoves`, `pieces`) converts to `Move` objects for the UI. It is verified by perft and by differential tests against chess.js, which is a dev-only test oracle and must not be imported by app code.
- `rules.ts` applies the variant: `legalMoves` returns only captures when any capture exists (`board.forcedMoves()`), and `getGameResult` implements the reversed win conditions (checkmated or bare king wins; stalemate, threefold, fifty-move and bare kings draw).
- `evaluate.ts` scores from the point of view of `me` (positive = good for `me`), with tunable `EvalWeights`/`DEFAULT_WEIGHTS`; terminal states override the static score.
- `search.ts`: iterative deepening with a transposition table, quiescence over capture chains (`qMax`) and a soft time limit. `DIFFICULTY_SETTINGS` defines easy/medium/hard (easy picks among the top 3 moves; hard always completes depth 5, then deepens while time allows). Weight and depth choices are backed by self-play results in `Docs/strategy/`.
- `draw.ts`: whether the computer accepts a draw offer.

**AI worker (`src/worker`)**: `useAI` (`src/ui/hooks/useAI.ts`) posts an `AIRequest` (start FEN plus the moves played, so the worker has repetition history) to `ai.worker.ts`, which rebuilds the `Board` and calls `findBestMove`. Replies carry a request id so stale replies after undo or a new game are ignored. Types live in `protocol.ts`.

**UI (`src/ui`, `src/App.tsx`)**:
- `App.tsx` switches between the `home`, `game` and `stats` screens and owns preferences and dialogs.
- `useGame` holds the one mutable `Board` in a ref, with a `version` counter as the React change signal; `takeSnapshot` derives everything the components render (pieces, legal and forced moves, result, history). It also autosaves the game and records finished games, triggers the AI reply, and auto-plays a forced single move when that preference is on.
- `storage.ts` persists preferences, the game in progress (as a move list, replayed on load) and game history in `localStorage`.
- `text.ts` holds user-facing wording, including screen-reader move descriptions. `forcedCapture.ts` explains why an attempted move was refused.
- Sound is synthesised in code (`sound.ts`, `pieceSounds.ts`), using the project skill `.claude/skills/game-sound-design`. Music is MP3s in `public/audio`, cached at runtime by the service worker rather than precached.

## Deployment and Store

- `.github/workflows/deploy.yml` tests, builds and publishes `dist/` to GitHub Pages on every push to `master` (DNS: CNAME `pseudochess` → `maheshnanavare.github.io` at names.co.uk; the custom domain is set in the repo's Pages settings, since Actions deploys ignore `public/CNAME`). The site must be served from the root of `pseudochess.maheshnanavare.co.uk` because the manifest `id`, `start_url` and `scope` are `/`; the `github.io/pseudochess/` path renders blank by design.
- The Store app is a PWABuilder package that loads the live site, so a push to `master` updates installed Store apps with no new submission. A new `.msixbundle` (with a higher version than the last one uploaded, starting from 1.0.0) is only needed when the manifest's name, icons or other identity details change. Changing the site's URL or manifest `id` would break the Store app.
- The PWA manifest and Workbox config are in `vite.config.ts`. `iarc_rating_id` is not set yet; add it once the Partner Center age rating gives an IARC ID.
- In Partner Center the product is a **Game** (category Board). PWABuilder packages always declare the restricted capability `runFullTrust`; Partner Center warns about it and asks for a justification in Submission options, which is expected.
- Store listing text, assets and PWABuilder steps are in `Docs/microsoft-store-listing.md`. Store images (`store-assets/`: 1:1 box art, 16:9 hero, 2:3 poster, screenshots; plus `public/screenshots/`) come from `npm run icons` and `npm run screenshots`, so regenerate them rather than editing them by hand. Partner Center rejects images that aren't the exact pixel sizes it asks for.
- Never commit signing keys or `.msix`/`.msixbundle`/`.appxbundle` packages (they are already listed in `.gitignore`).
