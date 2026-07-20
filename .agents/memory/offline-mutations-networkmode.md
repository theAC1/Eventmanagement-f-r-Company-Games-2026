---
name: Offline mutations & TanStack networkMode
description: Why a custom offline queue must force networkMode 'always' on react-query mutations.
---

# Offline queue + TanStack Query mutations

TanStack Query v5 defaults to `networkMode: 'online'`. When `navigator.onLine`
is false, a `useMutation` is **paused** — it never fires and never calls
`onError`, so the mutate button spins forever.

**Rule:** if you roll your own offline queue that relies on `onError` to enqueue
a failed submit, set `networkMode: 'always'` on that mutation
(`useCreateErgebnis({ mutation: { networkMode: 'always' } })`). Then the request
actually attempts, fails with a network error offline, and your queue handles it.

**Why:** referee score offline queue (mobile app) hung on submit until this was
set; the tester saw a stuck spinner and an empty localStorage queue.

**How to apply:** any Expo/web mutation whose failure path feeds a manual
offline/retry queue. Idempotency is enforced server-side via a client-generated
`commitId` on POST /api/ergebnisse (retries with same commitId return the
existing row instead of duplicating).
