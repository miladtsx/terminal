# Technical Details

This document dives into the runtime, command system, assets, and helpers that make the terminal portfolio behave the way it does.

## Stack & build

- Vite serves a modern React app with TypeScript, Tailwind, and Vitest. Installation and scripts are defined in `package.json:1`, including `pnpm dev`, `pnpm build`, and `pnpm test`.
- The app boots from `src/main.tsx:1`, which mounts `<App />`, loads `src/global.css`, and registers the production service worker from `public/service-worker.js:1`.

## Terminal runtime

- `src/App.tsx:1` wires together `<Terminal>` and `<BookingOverlay>`, ensuring the booking modal can be summoned from terminal commands.
- The UI lives in `src/components/terminal/index.tsx:1`. It renders output via `TerminalLineRow`, manages context menus, tab suggestions, easter eggs, notification overlays, and exposes `executeCommand` for clickable command segments.
- `useTerminalController` in `src/hooks/useTerminalController.ts:1` maintains the mutable `TerminalModel` (`src/components/terminal/terminalModel.ts:1`), typing simulations, shared command runs, font previews, intro copy, and history navigation. The controller registers the default commands on first render and exposes hooks for input, key handling, and suggestion state.
- `TerminalLine.tsx:1` renders each `LineSegment`, allowing text, command buttons, copy controls, FAQ/log accordions, and markdown blocks. It also reuses `buildShareLink` so log entries can surface shareable URLs.
- Font loading is orchestrated by `createTerminalFontController` (`src/utils/terminalFonts.ts:1`), which caches the selected font in `localStorage`, swaps the `--terminal-font` CSS variable, and previews fonts during tab completions.
- Notifications rely on `useNotificationOverlay` (`src/hooks/useNotificationOverlay.ts:1`) and the `NotificationOverlay` component (`src/components/NotificationOverlay.tsx:1`) so commands can surface timed messages with progress.

## Command system

- `CommandRegistry` (`src/components/terminal/commandRegistry.ts:1`) stores handlers, descriptions, and subcommand suggestion callbacks. It normalizes names and exposes `suggest`/`suggestSubcommands` for autocomplete.
- `registerDefaultCommands` in `src/components/terminal/defaultCommands.ts:1` defines the built-in portfolio commands: `contact`, `work`, `blog`, `logs`, `faq`, filesystem helpers (`ls`, `cat`, `download`, `verify`), offline controls, font display, resume download, and custom text blocks (`assumptions`, `philosophy`, etc.).
- The default commands leverage the blog/log indexes, file manifest, history store, clipboard helpers, offline client, and font controller exposed via `RegisterDefaultsArgs`. Hooks such as `setLinesFromModel`, `executeCommand`, and `fontController` allow commands to push rich line segments, interact with overlays, and mutate prompt/output state.
- Add new commands by registering them through `CommandRegistry.register`. You can borrow `LineSegment` helpers from `@types` and reuse UI primitives (command buttons, copy buttons, markdown blocks) to enrich the experience.

## Content indexes & assets

- Blog and log entries live under `src/data/blogs` and `src/data/logs` and get imported as raw markdown inside `src/data/blogIndex.ts:1` and `src/data/logsIndex.ts:1`. Those modules parse front matter, sanitize markdown, index tokens for search, and expose helper APIs (`getAll`, `findBySlugOrTitle`, `search`, `linesForSearch`, `listTags`).
- Downloadable assets are described in `src/data/fileManifest.json:1`. The file metadata (name, path, size, SHA256, text flag) feeds `src/data/files.ts:1` helpers (`listFiles`, `findFileByName`, `listTextFiles`) and unlocks `cat`, `open`, `download`, and `verify`.
- Static payloads such as the FAQ flow, case studies, and default suggestions live in `src/components/terminal/defaultCommands.ts:1`, but you can also inject new content by editing the markdown indexes or supplying additional `caseStudies`/`aboutLines` via `TerminalProps`.
- `public/files` mirrors the manifest entries so they can be fetched by the browser. If you add new downloads, update both the manifest and the directory contents.

## Persistence & utilities

- Command history is retained locally via `src/components/terminal/historyStore.ts:1`. It tries IndexedDB first and falls back to an in-memory array; history is capped at 1,000 entries and synced whenever `appendHistory` runs.
- Offline tooling lives in `src/utils/offlineClient.ts:1`. Commands call `getOfflineStatus`, `refreshOfflineResources`, and `disableOffline` to query/clear the service worker cache (`public/service-worker.js:1`) and related IndexedDB/localStorage state.
- `src/utils/shareLink.ts:1` supports the `buildShareLink`/`parseShareCommandsFromLocation` flow, which lets the UI consume `?run=` query parameters to auto-execute whitelisted `blog read` and `logs read` commands.
- Clipboard access, typing simulations, and greeting copy originate from `src/utils/index.ts:1` (which re-exports `clipboard.ts`, `greeting.ts`, and `typingSimulation.ts`). These helpers keep the terminal feel consistent without polluting the core controller.

## Tests & extension points

- Unit tests live under `src/components/terminal/__tests__/Terminal.test.tsx` (and related helpers) to guard command behavior and rendering.
- To customize overlays, look at `src/components/BookingOverlay.tsx:1` and `src/components/NotificationOverlay.tsx:1`. They both accept simple props (`open`, callbacks, payloads) so you can swap in your own modals or messaging systems.
- If you need telemetry, hook into `useTerminalController` by wrapping `executeCommand`, `runCommand`, or the registry handlers—we expose all these hooks through `ControllerReturn`.
- Remember to keep the terminal styling in `src/global.css` in sync with your new segments (e.g., `t-commandLink`, `t-suggest`, `t-contextMenu`). Tailwind/Tw utilities sit alongside the CSS for fine-tuning.

## Summary

Use this document alongside the README to understand how the terminal shells out commands, where data comes from, and how to persist state. If you need to rewrite the experience, start by updating the commands (defaultCommands + commandRegistry) and the data indexes; the controller and model will automatically render your new flow.
