---
name: Orval query options need queryKey
description: How to pass react-query options to orval-generated hooks in this repo
---
Passing `{ query: { ... } }` to an orval-generated hook (e.g. `useGetMeineSlots`) fails typecheck unless `queryKey` is included, because the generated `UseQueryOptions` marks it required.

**Why:** orval v8 generates strict `UseQueryOptions` types.

**How to apply:** import the generated key helper and pass it: `useGetX({ query: { queryKey: getGetXQueryKey(), refetchInterval: 10_000 } })`. After editing `lib/api-spec/openapi.yaml`, run `pnpm codegen` in `lib/api-spec`.
