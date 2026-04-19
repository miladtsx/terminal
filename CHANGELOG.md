# Changelog

## v0.5 - 2026-04-19

This release improves how the site behaves when a cached or offline copy is older than the latest build.

- The app now checks for a newer version during startup when the user has internet access.
- When a newer build is available, the site shows a popup asking the user to refresh.
- Accepting the refresh clears the local offline snapshot, fetches the newest build, and reloads the page.
- The update path is covered by focused tests so stale cached clients remain a reproducible, inspectable behavior.
