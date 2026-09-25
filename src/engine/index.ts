export { Board } from './board';
export { legalMoves, getGameResult, hasForcedCapture, onlyKingLeft } from './rules';
export { evaluate, staticScore, DEFAULT_WEIGHTS, type EvalWeights } from './evaluate';
export { findBestMove, DIFFICULTY_SETTINGS, type SearchOptions, type SearchResult } from './search';
export * from './types';
