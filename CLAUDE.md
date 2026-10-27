# Booking On Board (StaffBoard)

Next.js App Router, TypeScript strict, Tailwind v4, Supabase ("Mini Project Hub", anon key).
The duty board, one page (route resources, phonebook and on call removed 27 Oct; their addresses
redirect to the board). See README.md.

## Working here
- Checks before any push: `npm run lint`, `npm run type-check`, `npm test` (`node --test`, so
  relative imports inside `src/lib` carry the `.ts` suffix), `npm run build`.
- Rules live in `src/lib/duty/model.ts` (pure, over a key-value interface) and are tested: teams
  and shifts, time ranges, tile status, MCC views and RAG, MOM cover, command fields, and the
  `board_state` shape (`buildBoardState` / `applyBoardState`). Keep the storage keys and the
  stored shapes as they are: the original page in `legacy/` and the hub storage bridge rely on
  them. Unknown command fields (e.g. `strategic`) are carried through, never dropped.
- `src/lib/duty/store.ts` owns sync: publish only after the shared board has loaded; never pull
  over a focused field. `board_snapshots.event_type` accepts change / wipe / manual only.
- Mounted on the Derby Control hub (PotatOS) at `overseer.derbycontrol.co.uk/duty`, which proxies
  `/duty/*` here. `basePath` is `/duty` (`next.config.ts`) on the standalone hostname too; the root,
  `/index.html` and `/storage-bridge.html` redirect there. `public/storage-bridge.html` is
  byte-identical across systems; change all or none. Vercel framework comes from `vercel.json`.
- Overseer is the only way in (27 Oct): the Vercel project has no domain and is reached only through
  `overseer.derbycontrol.co.uk/duty` (PotatOS docs/09 §4.6). The last redirect in `next.config` sends a page
  load without Overseer's `x-overseer-hop` marker to the same address on Overseer. Absolute links
  this system hands out use `https://overseer.derbycontrol.co.uk/duty/…`. Do not add a domain.

## Design language
Autumn Hub house style (`nh9qxw5shd-oss/autumn-hub`, `web/src/`): the stylesheet, `ui.tsx` and
`uiFeedback.tsx` are copied by hand; keep them in step. Network Rail orange brand mark. Mobile
width 390 px with no horizontal scroll.

Writing and commits: no model names or identifiers in code, README, commit messages or PR text.
