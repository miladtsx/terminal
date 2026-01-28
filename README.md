# Terminal Portfolio

A single-page, terminal-style personal site built with React + Vite. Fork it, drop in your details, and publish to GitHub Pages in a few minutes.

- Prerequisites: Node 18+ and pnpm (`npm i -g pnpm`).
- Fork this repo on GitHub, then clone your fork: `git clone --depth 1 https://github.com/miladtsx/terminal && cd terminal`.
- Install and run locally: `pnpm install && pnpm dev` (open the shown localhost URL).

## Customize your copy

- **Commands & content:** Edit `src/components/terminal/defaultCommands.ts` to change text, links, or add/remove commands.
- **Blogs/notes:** Replace markdown in `src/data/blogs` and `src/data/logs` (indexes live in the matching `*Index.ts` files).
- **Downloads:** Put files in `public/files` and list them in `src/data/fileManifest.json`.
- **Branding:** Tweak colors/typography in `src/global.css`. The landing intro lives in `src/hooks/useTerminalController.ts`.

## Deploy to GitHub Pages (recommended)

Current workflow at `.github/workflows/deploy-pages.yml` automatically deploys to github pages, you just need to enable it if it's not:
1. In GitHub: Settings → Pages → Source = “GitHub Actions”. Pages will publish to `https://<username>.github.io/terminal/`.

## Useful scripts

- `pnpm dev` – start the site locally
- `pnpm build` – production build to `dist/`
- `pnpm preview` – serve the build locally
- `pnpm test` – run the Vitest suite

## Need more?

- Deeper technical notes live in `docs/technical-details.md`.
- If you changed the repository name from `terminal` to anything else, pages would fail to load assets, double-check the `base` path in `vite.config.js` matches your repository name.
