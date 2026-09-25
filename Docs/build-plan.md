# PseudoChess: Build Plan with Claude Code Prompts

Work through the steps in order, in the VS Code terminal with Claude Code. Each step has:
- **Prompt:** paste into Claude Code
- **Check:** what you verify yourself before moving on
- **Commit:** run after the check passes

Tips:
- For bigger steps, press `Shift+Tab` to switch Claude Code into plan mode first, read the plan, then approve.
- Run `/clear` between phases so each phase starts with a clean context. CLAUDE.md and the spec carry the knowledge across.
- If a step goes wrong, ask Claude Code to fix it before moving on. Never stack new features on failing tests.

---

## Phase 0: Setup

### 0.1 Create the project folder (manual)
```
mkdir pseudochess
cd pseudochess
git init
mkdir docs
```
Copy `pseudochess-spec.md` and this `build-plan.md` into `docs/`. Open the folder in VS Code, open the terminal, run `claude`.

### 0.2 Scaffold
**Prompt:**
```
Read docs/pseudochess-spec.md, especially sections 5 and 6. Scaffold the project in the current folder using Vite with the React + TypeScript template, strict TypeScript, Tailwind CSS, Vitest and chess.js. Create the folder structure from section 6 with empty placeholder files where needed. Add npm scripts: dev, build, preview, test, test:watch. Do not build any game logic yet. Run the build and tests to confirm the setup works.
```
**Check:** `npm run dev` opens a page, `npm test` runs.
**Commit:** `git add . && git commit -m "chore: scaffold vite react ts project"`

### 0.3 CLAUDE.md
**Prompt:**
```
Create CLAUDE.md in the project root with project rules for future sessions:
- The source of truth for rules and AI design is docs/pseudochess-spec.md. Read it before any engine work.
- src/engine must stay pure TypeScript: no React, no DOM, no browser APIs.
- Write or update Vitest tests for every engine change and run them before saying a task is done.
- Keep functions small and typed, no "any".
- Never delete files or folders without asking me first.
- Summarise what changed at the end of each task.
Keep it short.
```
**Commit:** `git commit -am "docs: add CLAUDE.md"`

### 0.4 GitHub (manual)
Create an empty repo `pseudochess` on GitHub, then:
```
git remote add origin https://github.com/MaheshNanavare/pseudochess.git
git branch -M main
git push -u origin main
```

---

## Phase 1: Rules engine

### 1.1 Types and board wrapper
**Prompt:**
```
Implement src/engine/types.ts and src/engine/board.ts. types.ts: Color, PieceType, Move (from, to, promotion, captured), GameResult (ongoing, win for white, win for black, draw, with a reason field), Difficulty. board.ts: a thin wrapper class around chess.js exposing fen(), sideToMove(), allLegalMoves() in chess normal rules, make(move), undo(), inCheck(), isThreefoldRepetition(), halfmoveClock(), pieces(color), load(fen). All other engine code must use this wrapper, never chess.js directly. Add basic tests.
```
**Check:** tests pass.
**Commit:** `git commit -am "feat(engine): types and chess.js board wrapper"`

### 1.2 Forced-capture move generation
**Prompt:**
```
Implement legalMoves(board) in src/engine/rules.ts following section 1 of the spec, "Move legality summary": if any legal move is a capture, return only captures, otherwise return all legal moves. Each promotion option is a separate move. Write tests using FEN positions for: no capture available, one forced capture, several captures to choose from, a capture that is illegal because it leaves the king in check (so it must not force anything), in check where one escape is a capture (only captures returned), en passant as a forced capture, and promotion with capture.
```
**Check:** read the test names and make sure each rule case is covered. Tests pass.
**Commit:** `git commit -am "feat(engine): forced capture legal moves"`

### 1.3 Game result
**Prompt:**
```
Implement getGameResult(board) in src/engine/rules.ts following the spec: a side that is checkmated WINS, a side left with only its king WINS, stalemate is a draw, threefold repetition is a draw, 50-move rule is a draw. Use legalMoves from rules.ts, not chess.js game over logic. Write tests with FEN positions for each outcome, for both white and black.
```
**Check:** tests pass. Double-check the checkmate test expects the mated side to win.
**Commit:** `git commit -am "feat(engine): reverse win conditions and draws"`

---

## Phase 2: Evaluation

### 2.1 Scoring function
**Prompt:**
```
Implement src/engine/evaluate.ts exactly as section 3 of the spec: constants, terminalScore, materialGood, pawnAdvanceGood, exposureGood, forcedCaptureGood and evaluate. Put all weights in one exported config object so they can be tuned later. Build attack information once per evaluate call and reuse it. Write tests: evaluate(me) equals minus evaluate(opponent) for the same position, fewer own pieces scores higher, an advanced pawn scores higher than an unmoved pawn, an exposed pawn scores higher than an exposed queen, a queen attacking several enemy pieces scores lower, and terminal positions return the win and loss values.
```
**Check:** tests pass.
**Commit:** `git commit -am "feat(engine): evaluation function"`

---

## Phase 3: Search

### 3.1 Negamax and quiescence
**Prompt:**
```
Implement src/engine/search.ts following section 4 of the spec: negamax with alpha-beta, and quiescence search that follows forced captures with no stand pat, capped at Q_MAX. Add simple move ordering: captures first, then moves that put my pawns under attack. Export findBestMove(board, difficulty) where difficulty maps to depth 3, 4 or 5 as in section 2. Easy picks randomly among the top 3 moves; medium and hard pick the best. Add iterative deepening with a time limit per move (default 2 seconds) so a move is always returned. Write tests: the engine takes a move that gets its own king checkmated when available, avoids a move that checkmates the opponent when another move exists, avoids capturing the opponent's last non-king piece when it has a choice, and always returns a legal move.
```
**Check:** tests pass.
**Commit:** `git commit -am "feat(engine): negamax search with difficulty levels"`

### 3.2 Performance check
**Prompt:**
```
Add a small benchmark script (npm run bench) that runs findBestMove at depths 3, 4 and 5 on the starting position and 3 middlegame FENs, and prints time and nodes searched. Run it and tell me the results. If depth 5 takes more than 3 seconds, suggest the cheapest fixes before changing anything.
```
**Check:** read the numbers. Decide on fixes with Claude Code if needed.
**Commit:** `git commit -am "chore: add engine benchmark"`

---

## Phase 4: AI worker

### 4.1 Web Worker and hook
**Prompt:**
```
Implement src/worker/ai.worker.ts that receives a FEN and difficulty, runs findBestMove, and posts the move back. Implement src/ui/hooks/useAI.ts that creates the worker, sends requests, returns the move with a "thinking" state, and cancels a pending request if a new game starts. Use Vite's native worker import.
```
**Check:** `npm run build` succeeds.
**Commit:** `git commit -am "feat: run AI in web worker"`

---

## Phase 5: UI

### 5.1 Board and moves
**Prompt:**
```
Build the board UI: Board, Square and Piece components plus src/ui/hooks/useGame.ts. Player picks white or black. Tap a piece to select it, legal target squares are highlighted, tap a target to move. Use legalMoves from the engine, so when a capture is forced only capturing pieces can be selected; show a small banner "Capture is forced" in that case. After the player moves, the AI replies through useAI with a "thinking" indicator. Mobile-first layout: board fills the screen width on phones, max 560px on desktop. Use simple SVG pieces from an open-licence set and add the credit to a CREDITS.md file.
```
**Check:** play a few moves on desktop and in Chrome DevTools phone view. Confirm forced captures are enforced.
**Commit:** `git commit -am "feat(ui): playable board vs AI"`

### 5.2 Game flow
**Prompt:**
```
Add PromotionPicker (Queen, Rook, Bishop, Knight), GameOverDialog showing the result and reason in plain words (for example "You win: your king was checkmated"), DifficultySelect (Easy, Medium, Hard), a New Game button, Undo (takes back the player move and the AI reply), and MoveHistory. Highlight the last move on the board.
```
**Check:** play full games at each difficulty. Try to reach each ending: mated, bare king, stalemate.
**Commit:** `git commit -am "feat(ui): promotion, game over, difficulty, undo"`

### 5.3 How to play
**Prompt:**
```
Add a HowToPlay screen using the rules from section 1 of the spec in short, simple sentences. Show it automatically on first visit and from a "?" button afterwards.
```
**Commit:** `git commit -am "feat(ui): how to play screen"`

### 5.4 Polish
**Prompt:**
```
Review the UI for mobile use: tap target sizes, portrait and landscape layouts, dark mode, and accessibility (aria labels on squares, visible focus states). List issues first, then fix them.
```
**Commit:** `git commit -am "style(ui): mobile and accessibility polish"`

---

## Phase 6: PWA

### 6.1 Installable and offline
**Prompt:**
```
Set up vite-plugin-pwa: web app manifest (name PseudoChess, short name PseudoChess, standalone display, portrait orientation, theme and background colours matching the app), icons at 192, 512 and a maskable 512 in public/icons, and a service worker that caches everything so the game works fully offline. Generate simple placeholder icons if none exist. Build and preview, then tell me how to test installability in Chrome DevTools.
```
**Check:** Lighthouse in Chrome DevTools shows the app as installable. Turn off network, reload, game still works.
**Commit:** `git commit -am "feat: PWA with offline support"`

---

## Phase 7: Deploy

### 7.1 Vercel (manual + prompt)
1. Push to GitHub: `git push`
2. In Vercel, import the `pseudochess` repo (framework: Vite).
3. In the project's domain settings, add `pseudochess.maheshnanavare.co.uk` and add the DNS record Vercel shows.

**Prompt (if anything fails):**
```
The Vercel build failed with this error: [paste error]. Fix it without changing game logic.
```
**Check:** the live site works on your phone and can be installed from the browser.

---

## Phase 8: Google Play

### 8.1 Play Console (manual)
- Create a Google Play developer account ($25 one-time).
- Start recruiting at least 12 testers now (classmates, students, friends). They need to stay opted in to the closed test for 14 days in a row before you can apply for production.

### 8.2 Build the Android package
**Prompt:**
```
Help me package the live PWA at https://pseudochess.maheshnanavare.co.uk for Google Play with Bubblewrap. Walk me through installing @bubblewrap/cli, running bubblewrap init against the manifest URL into the android folder, and bubblewrap build. Package id: uk.co.maheshnanavare.pseudochess. Explain each prompt Bubblewrap asks. Remind me to back up the signing key safely and never commit it to git; add it to .gitignore.
```
Then:
**Prompt:**
```
Create public/.well-known/assetlinks.json using the SHA-256 fingerprint from my signing key [paste fingerprint], and make sure Vercel serves it with the right content type. Redeploy and tell me how to verify it.
```
**Check:** the installed app opens full screen with no browser address bar (that means Digital Asset Links works).

### 8.3 Closed test and release (manual)
- Upload the .aab to a closed testing track, add testers, share the opt-in link.
- Prepare store listing: icon, feature graphic, 2+ phone screenshots, short and full description, privacy policy URL.
- After 14 days with 12+ testers, apply for production access.

**Prompt (for the listing):**
```
Write a Google Play store listing for PseudoChess: short description (max 80 characters), full description in simple words, and a basic privacy policy page stating the app collects no personal data. Add the privacy policy as a route or static page on the site.
```

---

## Phase 9: Microsoft Store

### 9.1 PWABuilder (manual)
- Register as an individual developer at storedeveloper.microsoft.com (free, ID verification).
- Go to pwabuilder.com, enter the live URL, fix any warnings it lists, then generate the Windows package and submit it in Partner Center.

**Prompt (if PWABuilder shows warnings):**
```
PWABuilder reported these issues for my PWA: [paste]. Fix them.
```

---

## Phase 10: After launch

- Add PseudoChess to maheshnanavare.co.uk with the live link, Play Store link and GitHub repo.
- Tune AI weights with self-play:

**Prompt:**
```
Add a self-play script (npm run selfplay) that plays N games between two weight configs from evaluate.ts at depth 4 and prints wins, losses and draws for each. Run 50 games of the current weights against a version with pawn REMAINING_COST 10 instead of 8, and report which is stronger.
```
