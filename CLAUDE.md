# PseudoChess: project rules

- The source of truth for rules and AI design is `Docs/pseudochess-spec.md`. Read it before any engine work.
- `src/engine` must stay pure TypeScript: no React, no DOM, no browser APIs.
- Write or update Vitest tests for every engine change and run `npm test` before saying a task is done.
- Keep functions small and typed, no `any`.
- Never delete files or folders without asking first.
- Summarise what changed at the end of each task.

Useful commands: `npm run dev`, `npm test`, `npm run build`, `npm run ui:smoke` (needs `npm run preview` running).
