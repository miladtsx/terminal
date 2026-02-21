# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds application code (React + TypeScript). Key areas: `components/` for UI, `hooks/` for reusable logic, `stores/` for Zustand state, `utils/` for helpers, `content/` & `data/` for markdown/text and structured data, and `global.css` for Tailwind entry styles.
- Entry points: `main.tsx` bootstraps React; `App.tsx` composes pages/sections.
- Build assets live in `public/`; compiled output goes to `dist/`. Docs and supplemental assets live in `docs/`.

## Build, Test, and Development Commands
- `pnpm dev` — run Vite dev server with hot reload.
- `pnpm build` — production build to `dist/`.
- `pnpm preview` — serve the built site locally for smoke checks.
- `pnpm test` — run Vitest suite (headless). Add `--watch` for TDD loops.
- `pnpm hash-files` — regenerate static file hash map (`scripts/generate-file-hashes.js`) when assets change.

## Coding Style & Naming Conventions
- Language: TypeScript + React (hooks-first). Prefer functional components and `useEffect`-safe patterns.
- Styling: TailwindCSS; keep utility classes readable by grouping layout → color → typography, and extend `src/styles/design-system.css` with reusable `ds-*` helpers (shell wrappers, stacks, grids, etc.)—reuse them via `@apply` before adding bespoke component CSS so each new pattern stays aligned with the shared design system.
- Indentation: 2 spaces; keep imports ordered: react/core, third-party, local absolute, relative.
- Naming: components `PascalCase.tsx`; hooks `useThing.ts`; stores `*.store.ts`; utilities `camelCase`.
- Lint/format: rely on TypeScript + editor formatting; keep `any` to the edges and add lightweight JSDoc when types need context.

## Testing Guidelines
- Framework: Vitest. Place tests alongside source as `*.test.ts(x)` or under `src/__tests__/`.
- Aim to cover critical UI flows, store behaviors, and utility edge cases; favor deterministic tests without DOM flake.
- For new features, add at least a happy-path test and one failure/edge-path test before opening a PR.

## Commit & Pull Request Guidelines
- Follow Conventional Commits seen in history (e.g., `fix(ui): icon overlap`, `refactor(copy): generic`). Use type + scope + concise summary.
- Keep commits small and focused; include tests/docs updates when relevant.
- PRs: describe intent and user impact, list test commands run, attach screenshots/GIFs for UI changes, and link issues/linear tickets if applicable.

## Security & Configuration Tips
- Use Vite env vars with the `VITE_` prefix; avoid committing secrets. Prefer `.env.local` (gitignored).
- Run `pnpm preview` before release to catch asset/hash issues, and re-run `pnpm hash-files` when adding or renaming public files.

# Development Guideline
Whenever developing new feature, if introducing a breaking change, make sure to document on CHANGELOG file. and also always update the property `version` of the [package.json](./package.json) accordingly.
