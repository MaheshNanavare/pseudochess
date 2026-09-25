# PseudoChess: Game and AI Spec

Android game. Reverse chess with forced captures.

---

## 1. Rules

### Setup
Same as normal chess: same board, same pieces, same starting position, same piece movements.

### Forced captures
- On your turn, if any of your pieces can legally capture an opponent's piece (legal = does not leave your own king in check), you **must** capture.
- If several captures are possible, you choose which one.
- If no capture is available, you play a normal move (including castling), following normal chess rules.

### How you win
1. Your king gets checkmated, or
2. You are left with only your king (your opponent captured all your other pieces).

### How you lose
1. You checkmate the opponent's king, or
2. Your opponent is reduced to only their king.

### Check
- Normal chess rules: a player in check must get out of check (move the king, block, or capture the checking piece).
- The forced-capture rule applies on top: from the moves that get out of check, if any of them is a capture, the player must pick one of those captures (e.g. if the king can escape by capturing, it must capture).
- A capture that does not get out of check is illegal, so it never forces anything.

### Promotion
- Normal promotion: when a pawn reaches the last rank, the player chooses Queen, Rook, Bishop or Knight.
- No promotion to king.

### Draws
- **Stalemate** (no legal moves, not in check) = draw.
- **Threefold repetition** = draw.
- **50-move rule** (50 moves by each side with no capture and no pawn move) = draw.

### Move legality summary
```
legalMoves(board):
    moves = all moves that do not leave own king in check   // normal chess legality, includes check escapes
    captures = moves where a piece is captured
    if captures is not empty: return captures              // forced capture, player picks any
    return moves
```
Each promotion option (Q, R, B, N) is a separate move in the list.

---

## 2. AI opponent

### Search
- Negamax with alpha-beta pruning.
- Move generation returns captures only when any capture exists, otherwise all legal moves. This keeps the branching factor low, so deeper search is cheap.
- Quiescence search at depth 0 that follows forced capture chains to a quiet position (no "stand pat", because captures are mandatory).
- Optional: iterative deepening with a time limit per move, so a legal move is always ready on slow devices.

### Difficulty levels
| Level  | Search depth | Extra |
|--------|--------------|-------|
| Easy   | 3            | Pick randomly from the top 2 to 3 moves |
| Medium | 4            | Best move |
| Hard   | 5            | Best move |

---

## 3. Evaluation function

### Design idea
A piece's real cost in this variant is not its normal chess value. It depends on:
1. **Ease of being captured:** pawns are slow and hard to put in danger, so get rid of them first.
2. **Forced-capture blowback:** long-range pieces (queen, rook, bishop) can be forced to capture many opponent pieces before they die, which pushes the opponent toward bare king (a loss for you).

Sacrifice priority: **Pawn > Knight = Bishop > Rook > Queen** (static), with the queen's danger handled by the forced-capture term.

Every helper returns "how good this is for `side`". Final score = my goodness minus opponent's goodness, so `eval(me) = -eval(opponent)`.

### 3.1 Constants

```
WIN = 100000

// Cost of a piece still being on MY side of the board.
// Higher = I want to get rid of it sooner.
REMAINING_COST = { PAWN: 8, KNIGHT: 5, BISHOP: 5, ROOK: 3, QUEEN: 1, KING: 0 }

// How much damage a piece can do to the opponent if it is forced to capture.
CAPTURE_REACH  = { PAWN: 1, KNIGHT: 2, BISHOP: 3, ROOK: 4, QUEEN: 6, KING: 1 }

W_PAWN_ADVANCE   = 1    // per rank a pawn has moved forward
W_EXPOSED        = 2    // per piece of mine the opponent can capture
W_FORCED_CAPTURE = 1    // per opponent piece I'm threatening, scaled by reach
W_ENDGAME_DANGER = 20   // extra penalty when opponent is close to bare king
DRAW_SCORE       = 0    // stalemate, threefold repetition, 50-move rule
```

### 3.2 Main function

```
function evaluate(board, me, ply):
    opp = opponentOf(me)

    // Terminal states override everything
    t = terminalScore(board, me, ply)
    if t != NONE: return t

    score = 0
    score += materialGood(board, me)      - materialGood(board, opp)
    score += pawnAdvanceGood(board, me)   - pawnAdvanceGood(board, opp)
    score += exposureGood(board, me)      - exposureGood(board, opp)
    score += forcedCaptureGood(board, me) - forcedCaptureGood(board, opp)
    return score
```

### 3.3 Terminal states

```
function terminalScore(board, me, ply):
    opp = opponentOf(me)

    if onlyKingLeft(board, me):  return  WIN - ply    // I shed everything: I win
    if onlyKingLeft(board, opp): return -WIN + ply    // I stripped them: I lose

    side = board.sideToMove
    if noLegalMoves(board, side):
        if inCheck(board, side):                      // checkmate
            if side == me: return  WIN - ply          // I got mated: I win
            else:          return -WIN + ply          // I mated them: I lose
        else:
            return DRAW_SCORE                         // stalemate

    if isThreefoldRepetition(board): return DRAW_SCORE
    if board.halfmoveClock >= 100:   return DRAW_SCORE  // 50-move rule

    return NONE
```

`WIN - ply` makes the engine prefer faster wins and delay losses.

### 3.4 Material (pieces left = bad)

```
function materialGood(board, side):
    total = 0
    for piece in board.pieces(side):
        total -= REMAINING_COST[piece.type]
    return total
```

### 3.5 Pawn progress

Rewards each step a pawn takes toward the opponent, so the engine gets credit for progress on slow pawns.

```
function pawnAdvanceGood(board, side):
    total = 0
    for pawn in board.pawns(side):
        if side == WHITE: ranksMoved = pawn.rank - 2   // ranks 1 to 8
        else:             ranksMoved = 7 - pawn.rank
        total += min(ranksMoved, 4) * W_PAWN_ADVANCE   // capped to discourage promotion
    return total
```

The cap stops the engine racing pawns to the last rank, since a promoted pawn is a new piece you still have to lose.

### 3.6 Exposure (being capturable = good)

```
function exposureGood(board, side):
    opp = opponentOf(side)
    total = 0
    for piece in board.pieces(side), excluding KING:
        if isAttackedBy(board, piece.square, opp):
            total += W_EXPOSED * REMAINING_COST[piece.type]
    return total
```

Weighted by `REMAINING_COST`, so an exposed pawn scores higher than an exposed queen.

### 3.7 Forced-capture risk (being able to capture = bad)

King included, since it can be forced to capture too.

```
function forcedCaptureGood(board, side):
    opp = opponentOf(side)
    oppLeft = countNonKingPieces(board, opp)
    total = 0
    for piece in board.pieces(side):                  // includes KING
        targets = countOpponentPiecesAttackedBy(board, piece)
        if targets == 0: continue

        risk = targets * CAPTURE_REACH[piece.type] * W_FORCED_CAPTURE
        if oppLeft <= 2:
            risk += targets * W_ENDGAME_DANGER        // close to giving them bare king
        total -= risk
    return total
```

### 3.8 Weight summary

| Component | Weight |
|---|---|
| Terminal (checkmate / bare king) | +/- 100000 |
| Remaining piece cost | Pawn 8, Knight 5, Bishop 5, Rook 3, Queen 1 |
| Pawn advance | 1 per rank, capped at 4 |
| Exposure | 2 x remaining cost per exposed piece |
| Forced-capture risk | targets x reach, +20 per target when opponent has 2 or fewer pieces |

---

## 4. Search pseudocode

```
function negamax(board, depth, alpha, beta, ply):
    t = terminalScore(board, board.sideToMove, ply)
    if t != NONE: return t
    if depth == 0: return quiescence(board, alpha, beta, ply, 0)

    moves = legalMoves(board)          // captures only, if any capture exists
    orderMoves(moves)                  // e.g. moves that expose pawns first
    for move in moves:
        board.make(move)
        score = -negamax(board, depth - 1, -beta, -alpha, ply + 1)
        board.undo(move)
        if score >= beta: return beta  // prune
        alpha = max(alpha, score)
    return alpha


Q_MAX = 8   // safety cap on capture-chain length

function quiescence(board, alpha, beta, ply, qdepth):
    t = terminalScore(board, board.sideToMove, ply)
    if t != NONE: return t
    if not hasForcedCapture(board) or qdepth >= Q_MAX:
        return evaluate(board, board.sideToMove, ply)

    for move in legalMoves(board):     // all captures, no option to skip
        board.make(move)
        score = -quiescence(board, -beta, -alpha, ply + 1, qdepth + 1)
        board.undo(move)
        if score >= beta: return beta
        alpha = max(alpha, score)
    return alpha
```

---

## 5. Tech stack (Option 1: PWA + TWA)

One web codebase, published to the web, Google Play and Microsoft Store.

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict mode) | Type safety for the engine, matches existing React/TS skills |
| Build tool | Vite | Fast, simple static build. No server needed, so Next.js is unnecessary here |
| UI | React + Tailwind CSS | Existing skills, quick mobile-first layout |
| Chess legality | chess.js | Handles check, castling, en passant, promotion, repetition and halfmove clock. Wrapped by our own forced-capture and win/loss logic |
| AI | Own engine (negamax + alpha-beta + quiescence) | Custom variant scoring, see sections 3 and 4 |
| Threading | Web Worker | AI search runs off the main thread so the board never freezes |
| Tests | Vitest (unit), Playwright (optional end-to-end) | Engine logic tested before any UI |
| PWA | vite-plugin-pwa | Manifest, icons, service worker, offline play |
| Hosting | Vercel, on a subdomain e.g. pseudochess.maheshnanavare.co.uk | Already have a Vercel account and the domain |
| Google Play | Bubblewrap (Trusted Web Activity) + Digital Asset Links | Wraps the live PWA into an Android app bundle (.aab) |
| Microsoft Store | PWABuilder | Packages the same PWA for Windows |
| Version control | Git + GitHub | Commit after each build step |

### Engine boundary rule
Everything in `src/engine/` is pure TypeScript with no React, no DOM and no browser APIs. It only talks to chess.js. This keeps it testable and reusable later (VS Code extension, Chrome extension, other front ends).

If chess.js turns out too slow for depth 5, only `src/engine/board.ts` needs replacing with a faster custom move generator. Nothing else changes.

---

## 6. Project structure

```
pseudochess/
  CLAUDE.md                     // project rules for Claude Code
  docs/
    pseudochess-spec.md         // this file
    build-plan.md
  public/
    icons/                      // app icons (192, 512, maskable)
    pieces/                     // SVG piece set (open licence, credited)
    .well-known/
      assetlinks.json           // links the domain to the Play Store app
  src/
    engine/                     // pure TS, no React
      types.ts                  // Color, Move, GameResult, Difficulty
      board.ts                  // thin wrapper around chess.js (make, undo, moves)
      rules.ts                  // legalMoves with forced capture, getGameResult
      evaluate.ts               // scoring function (section 3)
      search.ts                 // negamax, quiescence, iterative deepening, difficulty
      index.ts                  // public API of the engine
      __tests__/
        rules.test.ts
        evaluate.test.ts
        search.test.ts
    worker/
      ai.worker.ts              // runs search.ts off the main thread
    ui/
      components/
        Board.tsx
        Square.tsx
        Piece.tsx
        PromotionPicker.tsx
        GameOverDialog.tsx
        DifficultySelect.tsx
        MoveHistory.tsx
        HowToPlay.tsx
      hooks/
        useGame.ts              // game state, player moves, results
        useAI.ts                // talks to the worker
    App.tsx
    main.tsx
    index.css
  android/                      // generated by Bubblewrap (twa-manifest.json, .aab)
  vite.config.ts
  tsconfig.json
  package.json
```

---

## 7. Implementation notes

- **Speed:** build one attack map per side at the start of `evaluate` and reuse it in 3.6 and 3.7. This function runs thousands of times per move.
- **Tuning:** weights are starting guesses. Tune by self-play: a depth-4 bot with weights A plays 50 games against weights B, keep the winner.
- **Promotion:** generate all four options (Q, R, B, N) as separate moves and let the search pick. Under this scoring the AI will often prefer a Knight or Bishop, since they have lower capture reach than a Queen.
- **Repetition detection:** chess.js tracks position history, so use its threefold repetition check. It stays correct during search as long as every `make` is paired with an `undo`.
- **50-move rule:** use the halfmove clock from chess.js (reset on any capture or pawn move). It will rarely trigger here because captures are forced and frequent.
- **Ignore chess.js "game over":** it follows normal chess (e.g. insufficient material is a draw, checkmate is a loss). Use only `getGameResult` in `rules.ts`.

---

## 8. Publishing notes

- **Google Play:** one-time $25 developer fee. Personal accounts created after 13 November 2023 must run a closed test with at least 12 testers opted in continuously for 14 days before applying for production access. Plan to recruit testers early.
- **Microsoft Store:** free registration for individual developers, with ID verification. Package with PWABuilder.
- **Portfolio:** once live on the subdomain, add it to maheshnanavare.co.uk.

---

## 9. Next steps

- [x] Decide the open rule questions in section 1
- [x] Choose tech stack (Option 1: PWA + TWA, see section 5)
- [ ] Follow docs/build-plan.md
- [ ] Build rules engine (board, move generation with forced captures, win/loss detection) with unit tests
- [ ] Implement evaluation + negamax
- [ ] Build UI and difficulty selection
- [ ] Tune weights via self-play
