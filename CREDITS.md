# Credits

## Chess pieces
SVG pieces by **Colin M.L. Burnett** ("Cburnett"), from Wikimedia Commons
(`Chess_{k,q,r,b,n,p}{l,d}t45.svg`). Multi-licensed by the author under GFDL / BSD / GPL;
PseudoChess uses them under the **BSD licence**.
Source: https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces

## Typeface
**Bricolage Grotesque** by Mathieu Triay, SIL Open Font License 1.1, bundled locally via
`@fontsource-variable/bricolage-grotesque` so the app works offline.

## Music and sound effects
- Background music (`public/audio/home.mp3`, `public/audio/game.mp3`) generated with Google Gemini
  for this project.
- Capture sound effects synthesised in the app from recipes designed with Google Gemini
  (`src/ui/captureSounds.ts`).

## Libraries
- React (MIT), Vite (MIT), Tailwind CSS (MIT), Workbox via vite-plugin-pwa (MIT).
- chess.js (BSD-2-Clause) is used only in tests, as a reference oracle for the move generator.
