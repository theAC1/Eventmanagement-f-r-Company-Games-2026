---
name: Expo web e2e testing
description: How to point the Playwright testing subagent at an Expo artifact
---

Expo artifacts bypass the shared Replit proxy, so the `/<slug>/...` path
(e.g. `/mobile/referee`) returns **502** in the testing subagent's browser.

**Rule:** give the testing subagent the Expo dev domain URL directly, with the
base-path prefix DROPPED — `https://<REPLIT_EXPO_DEV_DOMAIN>/referee`, not
`/mobile/referee`. Get the domain from `echo $REPLIT_EXPO_DEV_DOMAIN` in the shell.

**Why:** the Screenshot tool auto-resolves this (it uses `$REPLIT_EXPO_DEV_DOMAIN`
for Expo apps), but the testing subagent defaults to the proxy path and gets 502s
that look like a blank/broken render.

**Also:** first navigation may show a blank page for up to ~30s while Metro does a
cold bundle compile — instruct the tester to wait and reload once.
