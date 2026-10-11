# Booking On Board (Duty Board)

Live duty board for Derby Control: who is booked on for every MOM, S&T, OLE and D&P team, route
resources for the MCC areas and MOM sections, the control phonebook and the on-call view.

## Pages (all under `/duty`)
- **Duty board** (`/duty`): every team in four columns. Green when the shift on now has a name,
  red when it has none or its times have passed, grey when nothing is booked. Open a team to set
  names, phones (filled from the phonebook), shift times (presets or custom From/To) and job notes.
  MOM teams can switch shift format.
- **Route resources** (`/duty/resources`): MCC area resource levels (main view, with Saturday and
  Sunday preloads that take over at the weekend), an override per area, critical works and
  mitigation; MOM section cover; the command structure per area.
- **Phonebook** (`/duty/phonebook`): shared contacts behind name autocomplete and phone auto-fill.
  Adding a name already in the book replaces its details.
- **On call** (`/duty/on-call`): placeholder for rostered on-call cover, as in the original.

## Data
- Working copy in browser storage under the original keys (`booking_on_board_light_v1_`,
  `mcc_v1_`, `mom_v1_`), so the original page and this one read and write the same board.
- Shared copy in Supabase (Mini Project Hub): `board_state` (one row per board, same shape as
  before), `board_snapshots` (change log), `mcc_command_state` and `contacts`.
- On open the shared board is loaded first; edits publish 800 ms after the last change and only
  once the shared copy has loaded, so a blank browser can never overwrite the live board. The
  shared copy is re-read every 10 seconds when it has changed, unless someone is typing.

## Hosting
Vercel, `basePath` `/duty` (`/` redirects there). Mounted on the Derby Control hub (PotatOS) at
`overseer.derbycontrol.co.uk/duty`. The original single page is kept in `legacy/` for reference.

## Development
```
npm install
npm run dev        # http://localhost:3000/duty
npm run lint && npm run type-check && npm test && npm run build
```
