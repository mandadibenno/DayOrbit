# DayOrbit

**Your life. Your people. Your space.** Plan your day privately, and share lists, plans and money only with the people you choose.

- **Spaces**: a private *My Space* for every person, plus shared Family, Friends, Couple, Office or custom spaces. Things you add stay in the space you add them to. You always see which space you're in.
- **Lists**: to-dos (with dates and who's doing them) and a shared shopping list that updates live for everyone.
- **Money**: bills with repeat and "mark paid", daily spending with a breakdown by category, and **Split Bills** with trips and events.
  - Split costs equally, by exact amounts, by percentage or by shares, among only the people who shared each cost.
  - The app suggests the fewest payments to settle up. Payments made by UPI or cash are recorded; the app never moves money.
  - "Older costs" from before trips and events existed can be moved into a trip, or deleted by the owner.
- **Health** (always private): medicines with daily check-off, and a cycle tracker.
  - The cycle tracker has a cycle ring, a phase guide, a daily log (flow, feelings, body, note), a calendar with predictions, and insights such as averages, regularity, cycle-length chart and symptom patterns.
  - Reminders appear on Home and can be made discreet. You can download your data as CSV.
  - In a Couple space you can choose to share your period dates and/or next-period estimate with your partner. Nothing else is ever shared.
- **Invites**: owners create invite links; people *ask to join* and the owner approves. Couple spaces hold two people.
- Light/dark themes, the Orbi mascot, works on phones and desktops, and installs as an app (PWA).

Stack: **React 18 + Vite** (plain JavaScript and CSS) on the front end. The back end is **Supabase**: Postgres with row-level security, SQL functions, auth and realtime.

---

## 1. Try it in 2 minutes (demo mode, no backend)

```bash
npm install
npm run dev
```

Open http://localhost:5173 and tap **Try the demo with sample data**. Demo mode keeps everything in your browser's local storage. It follows the same rules as the real database, so every screen works. Use **Menu → Reset demo data** to start over.

Demo mode is used automatically when no Supabase keys are set, or when `VITE_DEMO=1`.

## 2. Connect your own Supabase back end

1. Create a project at [supabase.com](https://supabase.com).
2. **Create the database.** Pick one way:
   - **Supabase CLI:** `supabase link --project-ref <your-ref>`, then `supabase db push`.
   - **SQL editor:** paste and run each file in `supabase/migrations/` in order (`…0001_schema.sql`, `…0002_security.sql`, `…0003_functions.sql`).
3. **Auth → URL configuration**
   - **Site URL:** where the app will live, e.g. `https://<you>.github.io/<repo>/`.
   - **Redirect URLs:** add that URL and `http://localhost:5173/`. Sign-up confirmation and password-reset links come back here.
4. **Keys:** copy `.env.example` to `.env.local` and fill in values from **Project Settings → API**:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   Only ever use the **anon** key in the app. Never put the `service_role` key in front-end code or in `.env.local`; row-level security is what protects the data.
5. `npm run dev`, then create an account. A new person gets a profile and their own My Space automatically.

## 3. Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` tests, builds and publishes on every push to `main`.

1. In the GitHub repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Go to **Settings → Secrets and variables → Actions** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without them, the site deploys in demo mode.
3. Push to `main`. The app uses hash URLs (`/#/home`), so it needs no server rewrites, and `base: './'` makes it work from any sub-path.

## 4. Tests

```bash
npm test          # money split maths and cycle estimates (Vitest)
npm run test:db   # migrations + security + every SQL function on a throwaway local Postgres
```

`test:db` needs PostgreSQL 15+ binaries (`initdb`, `pg_ctl`, `psql`) and must run as a normal (non-root) user, for example `sudo -u postgres bash scripts/test-db.sh`. It covers the following:

- Paisa-exact splits in all four methods.
- Trip balances.
- Settle-up.
- Duplicate-tap protection.
- Invites and approval.
- Privacy between spaces.
- Health privacy and partner sharing (including that sharing stops when someone leaves).
- Older-cost deletion with count checks.
- Ownership transfer, leaving and deleting spaces.

## How it's built

```
src/
  main.jsx, App.jsx            routes (hash router), auth gate, onboarding redirect
  styles/                      tokens.css (colours per space, light/dark), base.css, app.css
  lib/
    api.js                     every data call the screens use, in plain words
    backend/supabase.js        Supabase implementation (RLS does the access control)
    backend/demo.js            local-storage implementation with the same rules (demo mode)
    split.js                   split maths (mirrors the SQL exactly) + balances + settle-up
    cycle.js                   cycle averages, phases, predictions, patterns
    money.js, dates.js, …
  context/                     Auth, Space (current space + members + features), Toasts, Shell
  components/                  AppShell (nav), QuickAdd, SpaceSwitcher, CycleRing, Orbi, …
  pages/                       Home, Lists, money/*, health/*, spaces/*, Menu, Calendar, Profile
supabase/
  migrations/                  schema, row-level security, SQL functions
  tests/                       local auth shim + backend test script
public/                        manifest, service worker, icons
```

### Privacy and security model
- **Row-level security on every table.**
  - People only see spaces they belong to, and only those spaces' data.
  - Profiles are visible only to people you share a space with.
  - Phone, age and gender live in a separate table only you can read.
- **Health data is owner-only.** A partner can only read what you chose to share, through `get_shared_cycle()`. The function checks that sharing is on and that you're both still in the couple space, and returns just the scopes you allowed.
- **Changes with rules go through SQL functions** that check everything on the server: membership, ownership, split totals, couple size and invite expiry.
  - These changes include creating spaces, invites and approvals, splitting costs, deleting older costs, and sharing.
  - Errors come back as stable codes, which the app turns into friendly sentences.
- **Money is integer paise.** Splits use largest-remainder rounding, so shares always add up exactly. The JavaScript preview and the database use the same algorithm.
- **Saving twice can't double-charge:** each new cost or payment carries a request id that the database keeps unique.

### Good to know
- Reminders (bills, cycle, daily check-in) show inside the app on Home; there are no push notifications.
- To-dos and shopping update live across devices via Supabase Realtime (set up by the migration).
- Cycle predictions are estimates from past cycles. They are not medical advice and must not be used to prevent pregnancy; the app says this wherever predictions appear.
