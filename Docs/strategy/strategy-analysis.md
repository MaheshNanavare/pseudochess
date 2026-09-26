# PseudoChess: strategy analysis

What wins at PseudoChess (reverse chess with forced captures, rules in `Docs/pseudochess-spec.md`), measured by engine self-play and checked move by move on the engine's own rules. The 18 tips on the results page (`src/ui/stats.ts`) come from this analysis.

Done on 26 September 2026 against the engine at commit `e2a71fd`.

---

## Summary

**Opening**
- One-square first pawn moves (a3 to h3) scored **53%** for White against **48%** for two-square ones (a4 to h4), consistently across three independent runs. After a two-square push, an enemy pawn can meet yours at once, and then you must capture.
- A protected offer is a trade, not a gift: after **1.e3 a6?** 2.Bxa6 Black must take back, and Black scored only **40%**.
- In 8 sample games at depth 5, the engine always opened with a one-square pawn move, jumped knights to squares where they could be taken, and lost a queen within the first 9 moves in 5 of the games.
- Specific opening lines matter far less than these mechanics: Black's other replies to 1.e3 and 1.e4 all scored within noise of each other.

**Middlegame**
- With equal material, the side to move scored **54 to 56%**: a free move is worth using to make an offer.
- Uncovering your own long-range piece onto an enemy piece forces you to capture next turn (checked on the board).

**Endgame**
- **Between a fifth and a third of games are drawn** (21% at depth 3, 30% at depth 4), mostly by the 50-move rule (15 to 20% of all games).
- Every stalemate inspected had the same shape: the stalemated side, close to winning, had only its king and **blocked pawns**. Most 50-move draws were bare pawn endings, usually with pawns **locked head-on**.
- A side left holding **the only queen** at the start of the endgame scored about **40%**.
- **Kings make 56% of all endgame captures**, and in 41% of bare-king wins the loser's own king was forced to take the winner's last piece.
- 24 of the 26 checkmates were forced: the mating capture was the only legal move of the player who made it, and so lost.

---

## Method

- **Engine:** the app's own engine (`src/engine`: negamax, alpha-beta, quiescence, spec section 3 weights), playing both sides with the same settings.
- **Variety:** each move is picked at random from the engine's top 2 (`topN: 2`), from a seeded generator (`mulberry32`), so every result can be reproduced.
- **Depth:** 3 unless stated, 4 to confirm findings, 5 for the sample games. Depth 4 is the app's medium level; hard starts at 5.
- **Openings:** either fixed (a first move or a short line, then the engine) or 4 random legal moves (endgame studies).
- **Scoring:** win 1, draw ½, loss 0, from the side being measured. Games stop at 300 to 400 plies (almost none reached it).
- **Noise:** the 95% margin on a score is about ±10 points at 100 games, ±7 at 200 and ±5.7 at 300. Single results inside that margin are treated as noise.

**What this can and cannot show.** Self-play shows what works in engine-versus-engine play, which is what a player faces against the computer here. It is not a proof of best play, and features measured at a snapshot (such as who holds a queen) are correlations, not proven causes. Findings are only used for tips when they are large, repeat across runs or depths, or follow directly from the rules.

---

## 1. Opening

### 1.1 First moves

White's score after each first move, then engine against engine. Two runs at depth 3 (200 and 100 games, different seeds) and one at depth 4 (50 games). Pooled is weighted by games (350 per move).

| First move | Depth 3, 200 games | Depth 3, 100 games | Depth 4, 50 games | Pooled |
|---|---|---|---|---|
| e3 | 60% | 50% | 59% | 57% |
| b3 | 55% | 55% | 56% | 55% |
| h3 | 51% | 62% | 53% | 54% |
| g3 | 52% | 55% | 50% | 53% |
| c3 | 55% | 42% | 64% | 53% |
| Nh3 | 53% | 49% | 54% | 52% |
| a3 | 54% | 50% | 48% | 52% |
| d3 | 51% | 53% | 48% | 51% |
| Nf3 | 50% | 49% | 49% | 50% |
| f4 | 51% | 51% | 39% | 49% |
| h4 | 47% | 47% | 55% | 48% |
| g4 | 47% | 51% | 48% | 48% |
| e4 | 45% | 52% | 53% | 48% |
| Na3 | 49% | 48% | 46% | 48% |
| f3 | 46% | 51% | 46% | 47% |
| d4 | 49% | 44% | 47% | 47% |
| c4 | 46% | 49% | 48% | 47% |
| a4 | 49% | 42% | 50% | 47% |
| b4 | 42% | 49% | 55% | 46% |
| Nc3 | 47% | 44% | 46% | 46% |

**Groups, per run:**

| | Depth 3, 200 games | Depth 3, 100 games | Depth 4, 50 games |
|---|---|---|---|
| One-square pawn moves (8) | 53.0% | 52.2% | 53.0% |
| Two-square pawn moves (8) | 47.0% | 48.1% | 49.4% |

Pooled over 2,800 games per group: **52.8% against 47.7%**, about 3.8 standard errors apart. The gap holds for centre and flank pawns alike. Knight moves average 49%.

**Single moves are noisy.** c3 swung from 42% to 64% between runs. A separate 300-game check (seed 42) gave 1.e3 50.7%, 1.d3 52.8% and 1.e4 54.7%. So the tip names the pattern, one-square moves, with e3 only as an example (it was near the top in two of three runs).

**Why:** a pawn on the fourth rank can be met by an enemy pawn on the very next move. The two pawns then attack each other, and the side to move, you, must capture. A pawn on the third rank is two moves from that contact.

### 1.2 Black's replies to 1.e3 and 1.e4

300 games each at depth 3. White's score, so Black's is 100 minus it.

| Line | White | Note |
|---|---|---|
| 1.e3 a6 | **60%** | Protected offer: 2.Bxa6 forces bxa6, Nxa6 or Rxa6 |
| 1.e3 c5 | 56% | |
| 1.e3 Nf6 | 56% | |
| 1.e3 b5 | 54% | Forces 2.Bxb5, then Bxd7+ and a recapture (section 1.5) |
| 1.e3 e6 | 53% | |
| 1.e3 d5 | 51% | |
| 1.e4 a6 | 55% | Protected offer again |
| 1.e4 e5 | 52% | |
| 1.e4 b5 | 50% | |
| 1.e4 d5 | 49% | 2.exd5 is forced, then Qxd5 |

Only …a6 stands out, and it stands out for being bad: it offers a pawn that three of Black's own pieces protect, so the "gift" becomes a trade.

### 1.3 Opening plans for White

White follows a short plan (each move played as soon as it is legal, within White's first 12 moves), then the engine takes over. 300 games each at depth 3, margin about ±5.7.

| Plan | White | Plan completed |
|---|---|---|
| 1.e3, then Qh5 | 56.3% | 300 of 300 |
| 1.e4 only | 54.7% | 300 of 300 |
| 1.d3 only | 52.8% | 300 of 300 |
| 1.e3, then Qg4 | 50.8% | 300 of 300 |
| 1.e3 only (control) | 50.7% | 300 of 300 |
| 1.e3, then Ba6 | 50.7% | 146 of 300 |
| 1.e3, Nf3, Be2 | 50.5% | 7 of 300 |
| 1.e3, Nf3, Be2, castle | 50.5% | 0 of 300 |
| a4 and h4 | 48.5% | 294 of 300 |
| e4 and d4 | 48.0% | 281 of 300 |
| 1.e3, Nc3, Nf3 | 45.5% | 292 of 300 |
| 1.e3, then Qf3 | 45.0% | 300 of 300 |

None differs from the control beyond noise. Two results are about the game itself rather than the plan:
- **Ba6 never happens as a plan.** After 1.e3 the engine as Black usually answers …b5 or …a6 at once, pushing a pawn into the bishop's newly opened path. The 146 "completed" games are ones where Bxa6 was already White's forced capture, which is why the result matches the control exactly.
- **Castling never happened.** The position turns tactical long before the king's side is clear, so there is no evidence either way on castling.

### 1.4 How the engine opens at depth 5

Eight sample games, first nine moves:

```
1.g3 c6 2.Na3 b5 3.Nxb5 cxb5 4.h3 Qc7 5.c3 Qxg3 6.fxg3 b4 7.cxb4 Nh6 8.Qc2 Nf5 9.Qxf5 h6
1.g3 b6 2.b3 f6 3.f3 h6 4.Bg2 f5 5.Ba3 f4 6.gxf4 e5 7.Bxf8 exf4 8.Bxg7 h5 9.Bxh8 h4
1.f3 Nf6 2.g4 Nxg4 3.fxg4 g6 4.b3 g5 5.c3 c6 6.Bb2 a6 7.a3 b6 8.Kf2 Ra7 9.d3 Ra8
1.b3 b6 2.f3 Nh6 3.Ba3 Nf5 4.Bxe7 Nxe7 5.d3 f6 6.g3 f5 7.e4 fxe4 8.fxe4 Nf5 9.exf5 Ba3
1.c3 Na6 2.Qa4 Nb4 3.Qxb4 c6 4.Qxe7+ Kxe7 5.g3 b6 6.a3 f6 7.b3 a6 8.d4 h6 9.Bxh6 gxh6
1.f3 Nf6 2.c4 Ng4 3.fxg4 b5 4.cxb5 g5 5.b6 cxb6 6.Qc2 Bb7 7.Qxh7 Rxh7 8.Nh3 Rxh3 9.gxh3 Bxh1
1.c3 Na6 2.Qa4 c6 3.Qxc6 dxc6 4.g4 Qxd2+ 5.Bxd2 Bxg4 6.b4 Nxb4 7.cxb4 Bxe2 8.Bxe2 c5 9.bxc5 g5
1.f3 Nf6 2.b4 c5 3.bxc5 Ne4 4.fxe4 f5 5.exf5 b6 6.cxb6 Qxb6 7.f6 Qxb1 8.Rxb1 exf6 9.Rxb8 Rxb8
```

- **Every first move is a one-square pawn move** (g3, f3, b3, c3), matching section 1.1. It likes f3 more than the depth-3 statistics do.
- **Queens go early:** six queens are captured by move 9 across the eight games, for example 2.Qa4 then 4.Qxe7+ Kxe7, and …Qxg3 fxg3.
- **Knights jump straight to squares where they can be taken:** …Na6-b4, …Nh6-f5, Na3 inviting …b5.
- **Bishops get dragged into long capture chains:** Ba3xf8xg7xh8 in game 2 is White's bishop forced to take three times.

### 1.5 Forced opening sequences checked on the board

| Sequence | What the engine allows |
|---|---|
| 1.e3 b5 | White's only move is 2.Bxb5. After a quiet reply (2…e6) the only move is 3.Bxd7+, and Black must take back (Bxd7, Kxd7, Nxd7 or Qxd7). Black sheds two pawns for one bishop. |
| 1.e3 e6 2.b4 | The mirror for White: Black's only move is 2…Bxb4, and after a quiet 3.Nf3 the only move is 3…Bxd2+. |
| 1.e3 a6 | White's only move is 2.Bxa6, then Black's only moves are bxa6, Nxa6 and Rxa6. |

The …b5 chain is a real forced sequence but it did not help Black (54% for White, section 1.2), so it is not a tip.

---

## 2. Middlegame

- **Tempo.** At the start of the endgame with equal material, the side to move scored 56% at depth 3 and 54% at depth 4 (144 and 67 games). A side with no forced capture should use the move to make an offer; a quiet move hands the opponent a free turn to force a capture on you.
- **Look behind before you move.** In `4k3/8/8/6n1/8/8/3P3P/2B1K3 w`, White has no capture; after d3 and a quiet reply, White's only move is Bxg5+, because the pawn move uncovered the c1 bishop.
- **Chained gifts.** In `3rk3/8/8/8/8/2N5/3B3P/4K3 w`, after Nd5 Rxd5 White has a free move (no capture), and after h3 Black's only move is Rxd2: the rook landed attacking a second piece.

---

## 3. Endgame

### 3.1 How games end

Random 4-move openings, then engine against engine.

| | Depth 3, 800 games | Depth 4, 400 games |
|---|---|---|
| Win, all pieces lost (bare king) | 609 (76%) | 275 (69%) |
| Draw, 50-move rule | 120 (15%) | 81 (20%) |
| Draw, stalemate | 30 (4%) | 13 (3%) |
| Draw, repetition | 19 (2%) | 27 (7%) |
| Win, checkmated | 22 (3%) | 4 (1%) |

### 3.2 What predicts the result once the endgame starts

A snapshot is taken when both sides are down to 4 or fewer pieces besides the king, then compared with the final result. "Same count" means equal material at the snapshot.

| Feature of a side at the snapshot | Depth 3 | Depth 4 |
|---|---|---|
| Fewer pieces than the opponent | 58% (n 420) | 57% (n 254) |
| More pieces than the opponent | 42% (n 420) | 43% (n 254) |
| **Holds a queen, opponent has none** | **38%** (n 57) | **42%** (n 38) |
| No queen, opponent has one | 62% (n 57) | 58% (n 38) |
| **Same count, side to move** | **56%** (n 144) | **54%** (n 67) |
| Same count, not to move | 44% (n 144) | 46% (n 67) |
| Same count, more pawns | 48% (n 89) | 51% (n 43) |
| Same count, more queens, rooks and bishops | 49% (n 87) | 45% (n 39) |
| Has a blocked pawn | 51% (n 396) | 49% (n 242) |
| King in the centre (c3 to f6) | 53% (n 181) | 51% (n 120) |

The queen and the move are the features that matter at both depths. Pawns, long-range pieces and a central king make no clear difference. A blocked pawn does not lower the score on average, but it is behind the draws below.

### 3.3 Stalemates

In all 24 stalemates inspected (12 at each depth), the stalemated side had **only its king and 1 to 3 blocked pawns**, usually just one, so it was close to winning. The other side, usually with far more material, took its king's last moves away. Two examples, both confirmed as stalemate by the engine:

- `2Q5/k7/2K5/p7/P7/P7/8/8 b`: Black has a king and a blocked a5 pawn, and every king square is covered.
- `8/7p/7k/R7/7P/8/PP2K3/6R1 b`: Black's own king on h6 blocks the h7 pawn.

### 3.4 50-move draws

400 games at depth 3 gave 59 draws by the 50-move rule. What was left on the board:

| Material (one side vs the other) | Draws |
|---|---|
| pawn vs pawn | 36 |
| pawn vs 2 pawns | 8 |
| 2 pawns vs 2 pawns | 4 |
| other pawn-only endings | 4 |
| endings with a piece | 6 |
| full material (both sides shuffling) | 1 |

52 of 59 were bare pawn endings. In 11 of the 14 sampled, pawns were **locked head-on**, such as `k7/5K2/8/p7/P7/8/8/8 w` (a4 against a5). Neither king will go near an enemy pawn, since capturing it could hand the other side the win, and a locked pawn cannot move, so the game runs out the 50 moves. In the other 3 samples, a pawn or a knight could still move, but neither side would bring it into contact.

### 3.5 Who makes the captures

400 games at depth 3, 293 of them won on a bare king.

| Piece | Share of captures once both sides have 4 or fewer pieces | Share of game-ending captures |
|---|---|---|
| King | **56%** | **41%** |
| Rook | 13% | 22% |
| Pawn | 17% | 13% |
| Bishop | 6% | 10% |
| Queen | 3% | 9% |
| Knight | 4% | 5% |

In the endgame the king is the main capturer. The opponent parks unprotected pieces next to it, and it must take them, often the last one.

### 3.6 Checkmates

20 of the 22 checkmates at depth 3 and all 4 at depth 4 were **forced**: the mating move was a capture and the only legal move of the player who had to make it, and who therefore lost. Checkmate wins come from forced captures (the back-rank trap), not from the opponent choosing to mate.

### 3.7 Queen timing

When each side lost its queen, against that side's result. Depth 3, 500 games (1,000 sides); depth 4, 200 games (400 sides).

| Queen captured | Depth 3 | Depth 4 |
|---|---|---|
| By move 10 | 56% (n 434) | 54% (n 190) |
| Moves 11 to 20 | 53% (n 385) | 51% (n 142) |
| After move 20 | 47% (n 91) | 56% (n 41) |
| Never | 13% (n 90) | 7% (n 27) |

The "never" row is biased by the rules: a bare-king win requires losing the queen at some point. Among sides that lost her, depth 3 shows earlier as better (56% to 47%), but depth 4 does not repeat the trend. The firmer evidence against keeping her is section 3.2 (about 40% for a lone queen in the endgame, at both depths).

---

## 4. Rule checks behind the tactical tips

Each position was set up in the engine and its legal moves listed. The ones marked ✓ are also Vitest tests in `src/ui/__tests__/stats.test.ts`.

| Tip | Position | What the engine allows |
|---|---|---|
| Back-rank trap ✓ | `4r1k1/5ppp/8/8/8/3N4/5PPP/6K1 w` | After Ne1, Black's only move is Rxe1#, and White wins (checkmated) |
| En passant is forced ✓ | `4k3/8/8/8/3p4/8/4P2P/4K3 w` | After e4, Black's only move is dxe3 |
| Their king must capture ✓ | `4k3/3N3p/8/8/8/8/7P/4K3 b` | Only Kxd7; with a white bishop on b5 guarding d7, no capture at all |
| Check limits captures ✓ | `4k3/8/3p4/p3R3/1P6/8/8/4K3 b` | Only dxe5; axb4 is illegal while in check. With the rook on h5 instead (no check), axb4 is forced |
| Protected offer ✓ | Start, 1.e3 a6 | 2.Bxa6 is forced, then Black must take back |
| Pawn contact | `4k3/8/8/4p3/8/3P4/7P/4K3 w` | After d4, Black's only move is exd4 |
| Unprotected gifts | `4k3/8/2p5/8/4P3/2N5/7P/4K3 w` | After Nd5 cxd5, White's only move is exd5: the gift became a trade |

---

## 5. From findings to tips

The 18 tips on the results page, in rotation order, and what each rests on.

| Tip | Evidence | Strength |
|---|---|---|
| Give away only unprotected pieces | Rule check (section 4), 1.e3 a6 at 40% | Strong |
| Opening: one-square pawn moves like e3 | First moves, three runs (1.1) | Strong |
| Forced to capture? Take with a piece they can take back | Follows from forced capture | Rule |
| Middlegame: make an offer when no capture is forced | Side to move 54 to 56% (3.2) | Moderate |
| Push a pawn into contact | Rule check | Rule |
| Endgame: don't let your last pawns get blocked | Stalemates (3.3), 50-move draws (3.4) | Strong |
| Knights are easy to give away | Your tip; engine's knight play (1.4) | Moderate |
| Opening: an early offer must be unprotected (1.e3 a6?) | 1.2 and the rule check | Strong |
| Chain your gifts | Rule check (section 2) | Rule |
| Middlegame: look behind a piece before moving it | Rule check (section 2) | Rule |
| Their king must capture too | Rule check | Rule |
| Endgame: kings make most captures | Capture shares (3.5) | Strong |
| Check with a piece they can capture | Rule check | Rule |
| Opening: plan to lose your queen early | Lone queen 38 to 42% (3.2), depth-5 play (1.4), queen timing at depth 3 only (3.7) | Moderate, the weakest of the set |
| En passant is forced too | Rule check | Rule |
| Opening: develop pieces where their pawns can take them | Depth-5 play (1.4), forced capture | Moderate |
| Back-rank trap | Rule check; 24 of 26 checkmates were forced (3.6) | Strong |
| Promote to a piece that attacks none of theirs | Follows from forced capture | Rule |

---

## 6. Ideas tested and rejected

| Idea | Result |
|---|---|
| Offer the bishop on a6 early (1.e3, 2.Ba6) | Never arises: Black pushes a pawn into the bishop's path first (1.3) |
| Castle early | Never happened in 300 games; untested (1.3) |
| Knights first (e3, Nc3, Nf3) | 45.5%, no better than the control (1.3) |
| Early queen sorties (Qh5, Qg4, Qf3) | 56%, 51%, 45%: mixed, no pattern (1.3) |
| …b5 against 1.e3 to shed two pawns | Forced, but White still scored 54% (1.2, 1.5) |
| e4 and d4 early | 48.0% (1.3) |
| Early flank pawns (a4, h4) | 48.5% (1.3) |
| "More pawns is a burden in the endgame" | No effect at equal material (3.2) |
| "A central king loses in the endgame" | No effect (3.2) |
| "Walk your king out to get mated" (an earlier tip) | Not supported: a central king made no difference (3.2), and checkmates came from forced captures (3.6) |

---

## 7. Open questions

- **Depth.** Most games ran at depth 3, and the hard level searches deeper. The main findings held at depth 4, but not every detail has been rechecked at 5 and above.
- **Human play.** People make different mistakes from the engine. Tips about forced sequences hold for anyone; the statistical ones describe engine play.
- **Castling and king safety.** These never came up in self-play, so they are still open.
- **Individual first moves.** The per-move scores are too noisy to rank moves. It would take roughly 2,000 games per move to separate a 3-point difference.
- **The queen.** Whether to give her away early is the weakest recommendation. A targeted test, such as an engine variant that values losing the queen early, would settle it.

---

## 8. Reproducing

All runs used the self-play helpers in `scripts/selfplay.ts` (`playGame`, `randomOpening`, `mulberry32`) and `findBestMove` from `src/engine/search.ts`, with `{ depth, minDepth: depth, timeLimitMs: 1e9, topN: 2, random }` for both sides.

| Study | Setup | Seeds |
|---|---|---|
| First moves | Fixed first move, then engine | 5000 (200 games), 1000 (100 games, and 50 at depth 4) |
| Black's replies | Fixed two-move line, then engine, 300 games each | 5000 |
| Opening plans | White's plan moves played when legal (first 12 moves), 300 games each | 42 |
| Endgame snapshot | 4 random moves, snapshot at 4 or fewer pieces each | 7 (depth 3), 11 (depth 4) |
| 50-move draws | 4 random moves, material at the draw | 99000 + game |
| Capture shares | 4 random moves, piece making each capture | 31337 + game |
| Queen timing | 4 random moves, ply when each queen fell | 1 (depth 3), 2 (depth 4) |
| Depth-5 samples | From the start, 18 plies | 777 + game |
