# Gopher — website and clickable demo

Gopher is a student-to-student platform for errands, equipment rentals, and
academic resource exchange (BSBA Marketing Management class project, Ateneo de
Naga University).

This folder is the **frontend only**. It is a clickable demo:

- Every screen works, using sample data saved in your browser.
- The other students (go-runners, lenders, sellers, support) are simulated.
- **No real money moves, and nothing you type leaves your device.**

## Open it

1. **Easiest.** Double-click `index.html` (the landing page) or `app.html`
   (the demo app).
2. **Recommended: a local server**, which gives the same result as a hosted
   site. In this folder, run:

   ```bash
   python3 -m http.server 8090
   ```

   Then open <http://localhost:8090> (landing page) or
   <http://localhost:8090/app.html> (demo app).

Each way of opening the site (double-click, localhost, a hosted link) keeps its
own separate demo data.

## Who you can be

| Persona | Role | Good for |
|---|---|---|
| **Bea S.** | 3rd year, BS Accountancy | Booking errands, renting gear, buying reviewers |
| **Migs R.** | 2nd year, BS Civil Engineering | Earning as a go-runner, lending a tripod |
| New student | Sign up with any email, then upload a student ID or matriculation form (**Use sample** makes a fake one) | The sign-up and student-verification flow: "in review" for a few seconds, then verified |

## Presenting

- **The Demo panel** sits to the right of the phone on a laptop. On a phone,
  tap the **DEMO** chip. It has:
  - **Playing as:** switch between Bea and Migs.
  - **Scenarios:** each one resets the data and jumps to its starting screen.
    1. Print it before class (Bea)
    2. Rent a tripod (Bea)
    3. Buy a reviewer (Bea)
    4. Earn between classes (Migs)
    5. List a ring light (Migs)
    6. When something goes wrong (Bea reports a missing drink)
  - **Auto / Manual:** in Manual, the other students act only when you press
    **Next step**, or the **N** key. Chat replies stay automatic.
  - **Reset demo data.**
- **Use Manual mode on stage**, so each step happens when you're ready to
  explain it. The dashed **"Demo · …"** button on a booking does the same
  thing as Next step.
- **Forms have a "Use sample" button**, so you never need to type during a
  presentation.
- **URL shortcuts:** `app.html?as=bea`, `app.html?scenario=print`
  (also `tripod`, `reviewer`, `runner`, `lend`, `problem`), `?sim=manual`,
  `?reset=1`.
- **Before presenting:** reset, zoom the browser until the phone fills the
  screen, and keep a screen recording as a backup.

## Change things

| What | Where |
|---|---|
| Colors (brand blue is `--blue-400`, `#5CB6F6`) | `css/tokens.css` |
| Logo | `assets/brand/` (see below) |
| Prices, service fee, cancellation fee, payment methods, categories, campus spots, simulator timing | `js/config.js` |
| Sample students, listings, bookings, reviews | `js/seed.js` |
| Landing page, help, Terms, Privacy copy | `index.html`, `help.html`, `terms.html`, `privacy.html` |
| App screen text | `js/views/*.js` |

- **Prices are pilot placeholders**, based on the survey:
  - errands from ₱20
  - rentals from ₱15 a day
  - ₱5 service fee
  - go-runners and lenders keep 100% of their fee

  Replace them with the group's final pricing structure in `js/config.js`.
- **Payments:** `PAYMENT_METHODS` in `js/config.js` lists GCash and cash on
  hand-off. Remove `'cash'` to make Gopher digital-only. The paper currently
  says both (Chapter IV *Behaviors* vs. the Graph 21 write-up), so pick one.

## Logo files (`assets/brand/`)

| File | Use |
|---|---|
| `logo.svg` / `gopher-logo.png` (2760×810) | Blue logo, transparent background: website, paper, slides |
| `logo-white.svg` / `gopher-logo-white.png` | White logo for blue or dark backgrounds |
| `logo-mark.svg` / `gopher-mark.png` (1024×1024) | The gopher face in a circle: app icon, stickers |
| `gopher-profile-photo.png` (1080×1080) | Instagram, Facebook and TikTok profile photo |

- **Also generated from the mark:** `assets/favicon.svg`,
  `assets/favicon-32.png` and `assets/apple-touch-icon.png`.
- **The logo is a vector redraw** of the group's hand-drawn logo, so it's sharp
  at any size. The blue was matched by eye. If the group has the exact hex
  code, change `#5CB6F6` in the SVGs and in `css/tokens.css`.

## Put it online (optional)

Every file is static; there's no server code.

- **Netlify Drop:** drag this folder onto <https://app.netlify.com/drop> to get
  a free link. Good for letting classmates test it on their phones.
- **GitHub Pages:** push the folder to a repository and turn on Pages. The
  empty `.nojekyll` file is already here.

## Check that everything works

With the local server running, open:

- <http://localhost:8090/tests.html>: 21 checks on the data and the simulator.
  They cover pricing, all five demo scripts, cancellations, permissions,
  hand-off codes, and escaping of typed text.
- <http://localhost:8090/tests-ui.html>: 9 click-through tests that press the
  real buttons in the app.

Both use their own separate data, so they never touch your demo data.

## What's simulated

- **Accounts:** sign-up and the student ID / matriculation check. The photo is only previewed on your device; it's never saved or sent.
- **Payments:** GCash and Gopher Hold. There is never a real GCash screen, and
  the demo never asks for a number or MPIN.
- **Other students' actions:** go-runners accepting and delivering, lenders
  confirming, chat replies, ratings, support tickets.
- **Other features:** notifications, the digital reviewer "reader", the
  waitlist and contact forms.

A real launch needs a backend (accounts, database, payments) and a legal review
of `terms.html` and `privacy.html`. They are sample text written for a class
project and are **not legal advice**.

For a later backend: every screen talks to the data only through
`js/store.js`, whose functions already return promises. A Firebase or
Supabase version can provide the same functions without changing the screens.

## Files

```
index.html  help.html  terms.html  privacy.html   site pages
app.html                                          the demo app
tests.html  tests-ui.html                         automated checks (not linked from the site)
assets/     brand/ (logo), fonts/ (Plus Jakarta Sans + license), favicons
css/        tokens.css  base.css  components.css  site.css  app.css
js/         config.js  util.js  icons.js  seed.js  store.js  sim.js  ui.js  router.js
            demo.js  app.js  diag.js  site.js  views/ (one file per app screen)
```

## Credits

- **Font:** Plus Jakarta Sans (SIL Open Font License), in `assets/fonts/OFL.txt`.
- **Icons:** Lucide v1.48.0 (ISC License). The notice is at the top of
  `js/icons.js`.
- All people in the demo are fictional.
