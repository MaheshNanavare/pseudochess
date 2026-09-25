import {
  START_FEN,
  type Color,
  type Move,
  type MoveInput,
  type Piece,
  type PieceType,
  type PromotionPiece,
  type Square,
} from './types';

/*
 * Fast 0x88 board with integer-encoded moves, make/unmake and incremental
 * Zobrist hashing. Replaces the chess.js wrapper (spec section 5: "only
 * board.ts needs replacing"). The public object API (allLegalMoves, make,
 * undo, fen, pieces, history...) is unchanged for the UI; the search uses
 * the integer API (forcedMoves, makeMove, unmakeMove) directly.
 *
 * Square index = rank * 16 + file (a1 = 0, h8 = 119). Off-board: sq & 0x88.
 * Piece code = colour | type, colour 0 (white) or 8 (black), type 1..6.
 */

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export const WHITE = 0;
export const BLACK = 8;

export const KNIGHT_OFFSETS = [33, 31, 18, 14, -33, -31, -18, -14] as const;
export const KING_OFFSETS = [17, 16, 15, 1, -1, -15, -16, -17] as const;
export const BISHOP_DIRS = [17, 15, -17, -15] as const;
export const ROOK_DIRS = [16, -16, 1, -1] as const;

/* Move encoding: from(7) | to(7) | promo(3) | captured(3) | piece(3) | flags */
export const FLAG_EP = 1 << 23;
export const FLAG_CASTLE = 1 << 24;
export const FLAG_DOUBLE = 1 << 25;
export const mFrom = (m: number): number => m & 0x7f;
export const mTo = (m: number): number => (m >>> 7) & 0x7f;
export const mPromo = (m: number): number => (m >>> 14) & 7;
export const mCaptured = (m: number): number => (m >>> 17) & 7;
export const mPiece = (m: number): number => (m >>> 20) & 7;

function encode(from: number, to: number, piece: number, captured: number, promo: number, flags: number): number {
  return from | (to << 7) | (promo << 14) | (captured << 17) | (piece << 20) | flags;
}

const TYPE_OF: readonly PieceType[] = ['p', 'p', 'n', 'b', 'r', 'q', 'k'];
const CODE_OF: Record<PieceType, number> = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
const FILES = 'abcdefgh';
const PROMOTIONS = [QUEEN, ROOK, BISHOP, KNIGHT] as const;

export function squareName(sq: number): Square {
  return `${FILES[sq & 7]}${(sq >> 4) + 1}` as Square;
}

export function squareIndex(name: string): number {
  return (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
}

const colorCode = (c: Color): number => (c === 'w' ? WHITE : BLACK);
const colorName = (code: number): Color => (code === WHITE ? 'w' : 'b');

/* Castling rights */
const WK = 1;
const WQ = 2;
const BK = 4;
const BQ = 8;
const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[4] = 15 & ~(WK | WQ);
CASTLE_MASK[0] = 15 & ~WQ;
CASTLE_MASK[7] = 15 & ~WK;
CASTLE_MASK[116] = 15 & ~(BK | BQ);
CASTLE_MASK[112] = 15 & ~BQ;
CASTLE_MASK[119] = 15 & ~BK;

/* Zobrist keys: two 32-bit halves, deterministic seed. */
function makeRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  };
}
const rand = makeRandom(0x5eed);
const Z_PIECE_LO = new Int32Array(16 * 128).map(() => rand());
const Z_PIECE_HI = new Int32Array(16 * 128).map(() => rand());
const Z_CASTLE_LO = new Int32Array(16).map(() => rand());
const Z_CASTLE_HI = new Int32Array(16).map(() => rand());
const Z_EP_LO = new Int32Array(8).map(() => rand());
const Z_EP_HI = new Int32Array(8).map(() => rand());
const Z_SIDE_LO = rand();
const Z_SIDE_HI = rand();

export const GEN_ALL = 0;
export const GEN_CAPTURES = 1;
export const GEN_QUIETS = 2;

export class Board {
  /** Piece codes by 0x88 square. Read-only outside this class. */
  readonly squares = new Int8Array(128);
  /** Side to move: WHITE (0) or BLACK (8). */
  stm = WHITE;
  castling = 0;
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  hashLo = 0;
  hashHi = 0;
  /** Non-king piece count per colour, indexed by colour >> 3. */
  readonly nonKing = new Int32Array(2);
  readonly kings = new Int32Array(2);

  private uMove: number[] = [];
  private uCaptured: number[] = [];
  private uCastling: number[] = [];
  private uEp: number[] = [];
  private uHalf: number[] = [];
  private uLo: number[] = [];
  private uHi: number[] = [];
  /** Hash of every position since load, current one last (for repetition). */
  private histLo: number[] = [];
  private histHi: number[] = [];
  private publicHistory: Move[] = [];

  constructor(fen: string = START_FEN) {
    this.load(fen);
  }

  /* ------------------------------------------------------------------ */
  /* FEN                                                                 */
  /* ------------------------------------------------------------------ */

  load(fen: string): void {
    const parts = fen.trim().split(/\s+/);
    const [placement, side = 'w', castling = '-', ep = '-', half = '0', full = '1'] = parts;
    const rows = (placement ?? '').split('/');
    if (rows.length !== 8) throw new Error(`Invalid FEN: ${fen}`);

    this.squares.fill(0);
    this.nonKing.fill(0);
    let whiteKings = 0;
    let blackKings = 0;
    for (let r = 0; r < 8; r++) {
      let file = 0;
      for (const ch of rows[r]!) {
        if (ch >= '1' && ch <= '8') {
          file += Number(ch);
          continue;
        }
        const type = CODE_OF[ch.toLowerCase() as PieceType];
        if (!type || file > 7) throw new Error(`Invalid FEN: ${fen}`);
        const color = ch === ch.toLowerCase() ? BLACK : WHITE;
        const sq = (7 - r) * 16 + file;
        this.squares[sq] = color | type;
        if (type === KING) {
          this.kings[color >> 3] = sq;
          if (color === WHITE) whiteKings++;
          else blackKings++;
        } else {
          this.nonKing[color >> 3]!++;
        }
        file++;
      }
      if (file !== 8) throw new Error(`Invalid FEN: ${fen}`);
    }
    if (whiteKings !== 1 || blackKings !== 1) throw new Error(`Invalid FEN (kings): ${fen}`);

    this.stm = side === 'b' ? BLACK : WHITE;
    this.castling =
      (castling.includes('K') ? WK : 0) |
      (castling.includes('Q') ? WQ : 0) |
      (castling.includes('k') ? BK : 0) |
      (castling.includes('q') ? BQ : 0);
    this.ep = ep === '-' ? -1 : squareIndex(ep);
    this.halfmove = Number(half) || 0;
    this.fullmove = Number(full) || 1;

    this.uMove = [];
    this.uCaptured = [];
    this.uCastling = [];
    this.uEp = [];
    this.uHalf = [];
    this.uLo = [];
    this.uHi = [];
    this.publicHistory = [];
    this.computeHash();
    this.histLo = [this.hashLo];
    this.histHi = [this.hashHi];
  }

  fen(): string {
    const rows: string[] = [];
    for (let r = 7; r >= 0; r--) {
      let row = '';
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.squares[r * 16 + f]!;
        if (!p) {
          empty++;
          continue;
        }
        if (empty) row += empty;
        empty = 0;
        const ch = TYPE_OF[p & 7]!;
        row += p & BLACK ? ch : ch.toUpperCase();
      }
      if (empty) row += empty;
      rows.push(row);
    }
    let castling = '';
    if (this.castling & WK) castling += 'K';
    if (this.castling & WQ) castling += 'Q';
    if (this.castling & BK) castling += 'k';
    if (this.castling & BQ) castling += 'q';
    const ep = this.epHashFile() >= 0 ? squareName(this.ep) : '-';
    return `${rows.join('/')} ${colorName(this.stm)} ${castling || '-'} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  /* ------------------------------------------------------------------ */
  /* Hashing                                                             */
  /* ------------------------------------------------------------------ */

  /** File of the en passant square if a capture onto it is possible, else -1. */
  private epHashFile(): number {
    const ep = this.ep;
    if (ep < 0) return -1;
    const pawn = this.stm | PAWN;
    const a = this.stm === WHITE ? ep - 15 : ep + 15;
    const b = this.stm === WHITE ? ep - 17 : ep + 17;
    if ((!(a & 0x88) && this.squares[a] === pawn) || (!(b & 0x88) && this.squares[b] === pawn)) return ep & 7;
    return -1;
  }

  private computeHash(): void {
    let lo = 0;
    let hi = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      const p = this.squares[sq]!;
      if (p) {
        lo ^= Z_PIECE_LO[p * 128 + sq]!;
        hi ^= Z_PIECE_HI[p * 128 + sq]!;
      }
    }
    if (this.stm === BLACK) {
      lo ^= Z_SIDE_LO;
      hi ^= Z_SIDE_HI;
    }
    lo ^= Z_CASTLE_LO[this.castling]!;
    hi ^= Z_CASTLE_HI[this.castling]!;
    const epFile = this.epHashFile();
    if (epFile >= 0) {
      lo ^= Z_EP_LO[epFile]!;
      hi ^= Z_EP_HI[epFile]!;
    }
    this.hashLo = lo;
    this.hashHi = hi;
  }

  /* ------------------------------------------------------------------ */
  /* Attacks                                                             */
  /* ------------------------------------------------------------------ */

  /** Is `sq` attacked by any piece of colour `by` (WHITE or BLACK)? */
  attacked(sq: number, by: number): boolean {
    const s = this.squares;
    // Pawns attack diagonally forward, so look backwards from the target.
    const pawn = by | PAWN;
    if (by === WHITE) {
      if ((!((sq - 15) & 0x88) && s[sq - 15] === pawn) || (!((sq - 17) & 0x88) && s[sq - 17] === pawn)) return true;
    } else if ((!((sq + 15) & 0x88) && s[sq + 15] === pawn) || (!((sq + 17) & 0x88) && s[sq + 17] === pawn)) {
      return true;
    }
    const knight = by | KNIGHT;
    for (const o of KNIGHT_OFFSETS) {
      const t = sq + o;
      if (!(t & 0x88) && s[t] === knight) return true;
    }
    const king = by | KING;
    for (const o of KING_OFFSETS) {
      const t = sq + o;
      if (!(t & 0x88) && s[t] === king) return true;
    }
    const bishop = by | BISHOP;
    const rook = by | ROOK;
    const queen = by | QUEEN;
    for (const d of BISHOP_DIRS) {
      for (let t = sq + d; !(t & 0x88); t += d) {
        const p = s[t]!;
        if (p) {
          if (p === bishop || p === queen) return true;
          break;
        }
      }
    }
    for (const d of ROOK_DIRS) {
      for (let t = sq + d; !(t & 0x88); t += d) {
        const p = s[t]!;
        if (p) {
          if (p === rook || p === queen) return true;
          break;
        }
      }
    }
    return false;
  }

  isInCheck(): boolean {
    return this.attacked(this.kings[this.stm >> 3]!, this.stm ^ BLACK);
  }

  /* ------------------------------------------------------------------ */
  /* Move generation                                                     */
  /* ------------------------------------------------------------------ */

  private generatePseudo(out: number[], mode: number): void {
    const s = this.squares;
    const us = this.stm;
    const them = us ^ BLACK;
    const wantCaptures = mode !== GEN_QUIETS;
    const wantQuiets = mode !== GEN_CAPTURES;

    for (let from = 0; from < 128; from++) {
      if (from & 0x88) {
        from += 7;
        continue;
      }
      const p = s[from]!;
      if (!p || (p & BLACK) !== us) continue;
      const type = p & 7;

      if (type === PAWN) {
        const dir = us === WHITE ? 16 : -16;
        const rank = from >> 4;
        const promoRank = us === WHITE ? 6 : 1; // rank the pawn moves FROM to promote
        if (wantQuiets) {
          const one = from + dir;
          if (!s[one]) {
            if (rank === promoRank) {
              for (const pr of PROMOTIONS) out.push(encode(from, one, PAWN, 0, pr, 0));
            } else {
              out.push(encode(from, one, PAWN, 0, 0, 0));
              const startRank = us === WHITE ? 1 : 6;
              if (rank === startRank && !s[one + dir]) out.push(encode(from, one + dir, PAWN, 0, 0, FLAG_DOUBLE));
            }
          }
        }
        if (wantCaptures) {
          for (const side of [dir - 1, dir + 1]) {
            const to = from + side;
            if (to & 0x88) continue;
            const target = s[to]!;
            if (target && (target & BLACK) === them && (target & 7) !== KING) {
              if (rank === promoRank) {
                for (const pr of PROMOTIONS) out.push(encode(from, to, PAWN, target & 7, pr, 0));
              } else {
                out.push(encode(from, to, PAWN, target & 7, 0, 0));
              }
            } else if (to === this.ep && !target) {
              out.push(encode(from, to, PAWN, PAWN, 0, FLAG_EP));
            }
          }
        }
        continue;
      }

      if (type === KNIGHT || type === KING) {
        const offsets = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS;
        for (const o of offsets) {
          const to = from + o;
          if (to & 0x88) continue;
          const target = s[to]!;
          if (!target) {
            if (wantQuiets) out.push(encode(from, to, type, 0, 0, 0));
          } else if ((target & BLACK) === them && (target & 7) !== KING && wantCaptures) {
            out.push(encode(from, to, type, target & 7, 0, 0));
          }
        }
        if (type === KING && wantQuiets) this.generateCastling(out, from);
        continue;
      }

      const diag = type === BISHOP || type === QUEEN;
      const straight = type === ROOK || type === QUEEN;
      for (let i = 0; i < 8; i++) {
        const d = i < 4 ? BISHOP_DIRS[i]! : ROOK_DIRS[i - 4]!;
        if ((i < 4 && !diag) || (i >= 4 && !straight)) continue;
        for (let to = from + d; !(to & 0x88); to += d) {
          const target = s[to]!;
          if (!target) {
            if (wantQuiets) out.push(encode(from, to, type, 0, 0, 0));
            continue;
          }
          if ((target & BLACK) === them && (target & 7) !== KING && wantCaptures) {
            out.push(encode(from, to, type, target & 7, 0, 0));
          }
          break;
        }
      }
    }
  }

  private generateCastling(out: number[], from: number): void {
    const s = this.squares;
    const us = this.stm;
    const them = us ^ BLACK;
    const home = us === WHITE ? 4 : 116;
    if (from !== home) return;
    const kingSide = us === WHITE ? WK : BK;
    const queenSide = us === WHITE ? WQ : BQ;
    if (!(this.castling & (kingSide | queenSide)) || this.attacked(home, them)) return;
    if (this.castling & kingSide && !s[home + 1] && !s[home + 2] && s[home + 3] === (us | ROOK)) {
      if (!this.attacked(home + 1, them) && !this.attacked(home + 2, them)) {
        out.push(encode(home, home + 2, KING, 0, 0, FLAG_CASTLE));
      }
    }
    if (this.castling & queenSide && !s[home - 1] && !s[home - 2] && !s[home - 3] && s[home - 4] === (us | ROOK)) {
      if (!this.attacked(home - 1, them) && !this.attacked(home - 2, them)) {
        out.push(encode(home, home - 2, KING, 0, 0, FLAG_CASTLE));
      }
    }
  }

  /** Legal moves under normal chess rules, as integer codes. */
  generateLegal(mode: number = GEN_ALL): number[] {
    const pseudo: number[] = [];
    this.generatePseudo(pseudo, mode);
    const legal: number[] = [];
    const us = this.stm;
    for (const m of pseudo) {
      this.makeMove(m);
      if (!this.attacked(this.kings[us >> 3]!, this.stm)) legal.push(m);
      this.unmakeMove();
    }
    return legal;
  }

  /** Forced-capture legal moves: legal captures if any exist, otherwise all legal moves. */
  forcedMoves(): number[] {
    const captures = this.generateLegal(GEN_CAPTURES);
    return captures.length > 0 ? captures : this.generateLegal(GEN_QUIETS);
  }

  /* ------------------------------------------------------------------ */
  /* Make / unmake                                                       */
  /* ------------------------------------------------------------------ */

  makeMove(m: number): void {
    const s = this.squares;
    const from = mFrom(m);
    const to = mTo(m);
    const us = this.stm;
    const them = us ^ BLACK;
    const piece = s[from]!;
    const capSq = m & FLAG_EP ? (us === WHITE ? to - 16 : to + 16) : to;
    const captured = s[capSq]!;

    this.uMove.push(m);
    this.uCaptured.push(captured);
    this.uCastling.push(this.castling);
    this.uEp.push(this.ep);
    this.uHalf.push(this.halfmove);
    this.uLo.push(this.hashLo);
    this.uHi.push(this.hashHi);

    let lo = this.hashLo ^ Z_SIDE_LO ^ Z_CASTLE_LO[this.castling]!;
    let hi = this.hashHi ^ Z_SIDE_HI ^ Z_CASTLE_HI[this.castling]!;
    const oldEp = this.epHashFile();
    if (oldEp >= 0) {
      lo ^= Z_EP_LO[oldEp]!;
      hi ^= Z_EP_HI[oldEp]!;
    }

    if (captured) {
      s[capSq] = 0;
      lo ^= Z_PIECE_LO[captured * 128 + capSq]!;
      hi ^= Z_PIECE_HI[captured * 128 + capSq]!;
      this.nonKing[them >> 3]!--;
    }

    const promo = mPromo(m);
    const placed = promo ? us | promo : piece;
    s[from] = 0;
    s[to] = placed;
    lo ^= Z_PIECE_LO[piece * 128 + from]! ^ Z_PIECE_LO[placed * 128 + to]!;
    hi ^= Z_PIECE_HI[piece * 128 + from]! ^ Z_PIECE_HI[placed * 128 + to]!;

    if ((piece & 7) === KING) {
      this.kings[us >> 3] = to;
      if (m & FLAG_CASTLE) {
        const rook = us | ROOK;
        const rookFrom = to > from ? from + 3 : from - 4;
        const rookTo = to > from ? from + 1 : from - 1;
        s[rookFrom] = 0;
        s[rookTo] = rook;
        lo ^= Z_PIECE_LO[rook * 128 + rookFrom]! ^ Z_PIECE_LO[rook * 128 + rookTo]!;
        hi ^= Z_PIECE_HI[rook * 128 + rookFrom]! ^ Z_PIECE_HI[rook * 128 + rookTo]!;
      }
    }

    this.castling &= CASTLE_MASK[from]! & CASTLE_MASK[to]!;
    lo ^= Z_CASTLE_LO[this.castling]!;
    hi ^= Z_CASTLE_HI[this.castling]!;

    this.ep = m & FLAG_DOUBLE ? (from + to) >> 1 : -1;
    this.halfmove = (piece & 7) === PAWN || captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.stm = them;

    const newEp = this.epHashFile();
    if (newEp >= 0) {
      lo ^= Z_EP_LO[newEp]!;
      hi ^= Z_EP_HI[newEp]!;
    }
    this.hashLo = lo;
    this.hashHi = hi;
    this.histLo.push(lo);
    this.histHi.push(hi);
  }

  unmakeMove(): void {
    const m = this.uMove.pop();
    if (m === undefined) return;
    const s = this.squares;
    const captured = this.uCaptured.pop()!;
    this.castling = this.uCastling.pop()!;
    this.ep = this.uEp.pop()!;
    this.halfmove = this.uHalf.pop()!;
    this.hashLo = this.uLo.pop()!;
    this.hashHi = this.uHi.pop()!;
    this.histLo.pop();
    this.histHi.pop();

    const us = this.stm ^ BLACK;
    const them = this.stm;
    this.stm = us;
    if (us === BLACK) this.fullmove--;

    const from = mFrom(m);
    const to = mTo(m);
    const piece = mPromo(m) ? us | PAWN : s[to]!;
    s[from] = piece;
    s[to] = 0;
    if (captured) {
      const capSq = m & FLAG_EP ? (us === WHITE ? to - 16 : to + 16) : to;
      s[capSq] = captured;
      this.nonKing[them >> 3]!++;
    }
    if ((piece & 7) === KING) {
      this.kings[us >> 3] = from;
      if (m & FLAG_CASTLE) {
        const rookFrom = to > from ? from + 3 : from - 4;
        const rookTo = to > from ? from + 1 : from - 1;
        s[rookFrom] = us | ROOK;
        s[rookTo] = 0;
      }
    }
  }

  /** Threefold repetition over the positions since load (same side to move, since last irreversible move). */
  isThreefoldRepetition(): boolean {
    const n = this.histLo.length - 1;
    const lo = this.hashLo;
    const hi = this.hashHi;
    const stop = Math.max(0, n - this.halfmove);
    let count = 1;
    for (let i = n - 2; i >= stop; i -= 2) {
      if (this.histLo[i] === lo && this.histHi[i] === hi && ++count >= 3) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Object API (UI, tests)                                              */
  /* ------------------------------------------------------------------ */

  sideToMove(): Color {
    return colorName(this.stm);
  }

  inCheck(): boolean {
    return this.isInCheck();
  }

  halfmoveClock(): number {
    return this.halfmove;
  }

  nonKingCount(color: Color): number {
    return this.nonKing[colorCode(color) >> 3]!;
  }

  /** Every move that is legal under normal chess rules (no forced capture filter). */
  allLegalMoves(): Move[] {
    const codes = this.generateLegal(GEN_ALL);
    return codes.map((m) => this.toMove(m, codes));
  }

  /** Converts an integer move of the side to move into a described Move. */
  toMove(m: number, legal: number[] = this.generateLegal(GEN_ALL)): Move {
    const move: Move = {
      from: squareName(mFrom(m)),
      to: squareName(mTo(m)),
      color: colorName(this.stm),
      piece: TYPE_OF[mPiece(m)]!,
      san: this.san(m, legal),
    };
    if (mCaptured(m)) move.captured = TYPE_OF[mCaptured(m)]!;
    if (mPromo(m)) move.promotion = TYPE_OF[mPromo(m)] as PromotionPiece;
    return move;
  }

  /** Finds the legal move matching `input`, or undefined. */
  findMove(input: MoveInput, legal: number[] = this.generateLegal(GEN_ALL)): number | undefined {
    const from = squareIndex(input.from);
    const to = squareIndex(input.to);
    const promo = input.promotion ? CODE_OF[input.promotion] : 0;
    return legal.find((m) => mFrom(m) === from && mTo(m) === to && mPromo(m) === (mPromo(m) ? promo || QUEEN : 0));
  }

  make(input: MoveInput): Move {
    const legal = this.generateLegal(GEN_ALL);
    const m = this.findMove(input, legal);
    if (m === undefined) throw new Error(`Illegal move: ${input.from}${input.to}${input.promotion ?? ''}`);
    const move = this.toMove(m, legal);
    this.makeMove(m);
    this.publicHistory.push(move);
    return move;
  }

  undo(): Move | null {
    const move = this.publicHistory.pop();
    if (!move) return null;
    this.unmakeMove();
    return move;
  }

  history(): Move[] {
    return [...this.publicHistory];
  }

  pieceAt(square: Square): Piece | undefined {
    const p = this.squares[squareIndex(square)]!;
    return p ? { color: colorName(p & BLACK), type: TYPE_OF[p & 7]!, square } : undefined;
  }

  pieces(color?: Color): Piece[] {
    const out: Piece[] = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      const p = this.squares[sq]!;
      if (!p) continue;
      const c = colorName(p & BLACK);
      if (color === undefined || c === color) out.push({ color: c, type: TYPE_OF[p & 7]!, square: squareName(sq) });
    }
    return out;
  }

  isAttacked(square: Square, by: Color): boolean {
    return this.attacked(squareIndex(square), colorCode(by));
  }

  /** Standard algebraic notation, including + and # suffixes. */
  private san(m: number, legal: number[]): string {
    const from = mFrom(m);
    const to = mTo(m);
    const piece = mPiece(m);
    let san: string;
    if (m & FLAG_CASTLE) {
      san = to > from ? 'O-O' : 'O-O-O';
    } else {
      const capture = mCaptured(m) !== 0;
      if (piece === PAWN) {
        san = capture ? `${FILES[from & 7]}x` : '';
      } else {
        san = TYPE_OF[piece]!.toUpperCase();
        const rivals = legal.filter((o) => o !== m && mPiece(o) === piece && mTo(o) === to && mFrom(o) !== from);
        if (rivals.length > 0) {
          const sameFile = rivals.some((o) => (mFrom(o) & 7) === (from & 7));
          const sameRank = rivals.some((o) => mFrom(o) >> 4 === from >> 4);
          if (!sameFile) san += FILES[from & 7];
          else if (!sameRank) san += String((from >> 4) + 1);
          else san += squareName(from);
        }
        if (capture) san += 'x';
      }
      san += squareName(to);
      if (mPromo(m)) san += `=${TYPE_OF[mPromo(m)]!.toUpperCase()}`;
    }
    this.makeMove(m);
    if (this.isInCheck()) san += this.generateLegal(GEN_ALL).length === 0 ? '#' : '+';
    this.unmakeMove();
    return san;
  }
}
