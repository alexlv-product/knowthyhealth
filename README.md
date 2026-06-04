# KnowThyHealth — Design System & Frontend Architecture

> **What this document is:** A handoff guide that captures the architectural decisions, conventions, and current state of the KnowThyHealth frontend codebase. Treat this as the source of truth for any decision not visible in the code itself.

---

## What is KnowThyHealth?

A personalized wellness and longevity research surface. The user provides demographic context — gender and age are required; lifestyle baseline, optional condition, and concerns refine the output — and the system returns top-N evidence-graded recommendations from current literature for someone of that profile.

**The core thesis the product exists to deliver:** Studies are designed around a defined population (that's good science); but those findings get extrapolated by media, the wellness industry, and even medical professionals to people who resemble nothing of the study subjects. KnowThyHealth re-narrows the research back to who it actually studied, and grades each finding by the strength of its evidence.

---

## Stack

- **Framework:** React 18 + Vite 6 + TypeScript
- **Styling:** Tailwind CSS 3 (with custom token extension — see `tailwind.config.js`)
- **State:** React state + `sessionStorage` for form persistence (no Redux, no Zustand, no react-hook-form)
- **Icons:** `@tabler/icons-react`
- **Backend:** Node 22 + Express 4 (separate repo / deployment)
- **Deployment:** Vercel (frontend), Railway (backend) — both pull from this monorepo

---

## Quick start

```bash
# Install
npm install
npm install @tabler/icons-react

# Dev
npm run dev

# Build
npm run build
```

### Environment variables

Frontend uses `VITE_API_BASE_URL` to point at the backend. Set this in:
- **Local:** `.env.local` at the repo root (gitignored)
- **Vercel:** Project settings → Environment Variables
- **Backend (Railway):** `process.env.PORT` must match Railway's public networking port (3000). `FRONTEND_URL` must be set without a trailing slash.

### Fonts

The frontend loads three brand fonts from Google Fonts via `@import` in `src/index.css`:
- Inter (sans, weights 400/500/600)
- Source Serif 4 (serif, weights 400/500, italic)
- JetBrains Mono (mono, weights 400/500)

For production performance, add these `<link>` tags to `index.html` before the existing head content:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

The `@import` in `index.css` will still work without these, just slightly slower on first paint.

---

## Project structure

```
.
├── docs/
│   ├── README.md                     ← this file
│   └── design-tokens.md              ← canonical design system reference
├── src/
│   ├── components/
│   │   ├── ui/                       ← primitives (Button, Card, Chip, etc.)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Checkbox.tsx
│   │   │   ├── Chip.tsx
│   │   │   ├── GradeTile.tsx
│   │   │   ├── Input.tsx             ← exports Input, Textarea, Select
│   │   │   ├── Logo.tsx
│   │   │   ├── Pill.tsx
│   │   │   ├── SectionLabel.tsx
│   │   │   ├── SegmentedControl.tsx
│   │   │   └── index.ts              ← barrel export
│   │   └── features/                 ← composite components (BUILD NEXT)
│   ├── lib/
│   │   └── cn.ts                     ← class-name merge utility
│   ├── pages/                        ← top-level routes (BUILD NEXT)
│   └── index.css                     ← Tailwind layers + base + utilities
├── tailwind.config.js                ← design token extension
└── package.json
```

---

## Two-tier component architecture

This was a deliberate decision after considering three options (flat, feature-grouped, atomic+features). The codebase uses **atomic + features**:

### `src/components/ui/` — primitives
The smallest reusable visual building blocks. Each component:
- Has no business logic (no API calls, no domain-specific state)
- Knows about styling, basic state, and variants
- Can be used in any feature
- Is documented with prop types and JSDoc explaining when to use each variant

**Examples:** Button, Card, Chip, GradeTile, Input, Logo, Pill, SectionLabel, SegmentedControl.

### `src/components/features/` — composites *(not built yet)*
Domain-aware components that compose primitives. Each:
- Knows about the product (advice cards, intake form sections, error states)
- May have local state (tier expansion, form field state)
- Reads from the primitives layer, never the other direction
- Can be used by pages

**Examples that need to be built:**
- `AdviceCard.tsx` — domain advice card with three-tier expand/collapse state machine
- `IntakeFormSection.tsx` — wraps a card with a SectionLabel + sub-label
- `DomainGroup.tsx` — results page section: domain header + array of AdviceCards
- `WarningBanner.tsx` / `DisclaimerBanner.tsx` — the two banner styles at the top of results
- `LoadingPhases.tsx` — the four-phase progress card
- `ErrorPage.tsx` — full-page error layout with hang/tavily/503/network variants
- `IntakeRecap.tsx` — horizontal chip row showing the user's intake
- `LandingHero.tsx` — hero section with thesis, subhead, CTA, trust signals
- `LandingHowItWorks.tsx` — three-step explainer
- `LandingSamples.tsx` — one-card-per-grade demonstration
- `LandingMethodology.tsx` — grade definitions
- `LandingFooterCTA.tsx` — dark final CTA block

### `src/pages/` — page-level shells *(not built yet)*
Top-level routes. Each page imports from features and lays them out. Examples:
- `Landing.tsx`
- `IntakeForm.tsx`
- `Loading.tsx`
- `Results.tsx`
- `ErrorStates.tsx` (or per-state pages)

---

## Design system

See `docs/design-tokens.md` for the canonical specs. The short version:

### Palette: Graphite Plum
- **Brand plum** `#6D3F73` — primary accent (A-grade tile, focus rings, active segments, checkbox check, citation brackets)
- **Ink** `#1C1917` — body text, primary CTA, dark surfaces
- **Stone** family — warm neutrals for backgrounds, borders, secondary text
- **Grade ramp** — saturated tiles: plum / sage / sand / copper / deep red
- **Semantic** — amber (warnings, hang state, Tavily degraded) and red (doctor warning, 503)

### Typography
- `font-sans` → Inter (UI)
- `font-serif` → Source Serif 4 (editorial headlines, grade letters)
- `font-mono` → JetBrains Mono (citations, diagnostics)

### Voice rule
**"Thy" appears only in the brand name (KnowThyHealth) and the logo lockup baseline ("thy health"). All product copy uses modern English — "your", "you".** This was tried both ways during design and locked as name-only.

### Layout widths
- `max-w-page` (640px) — landing, loading, narrow surfaces
- `max-w-form` (720px) — intake form
- `max-w-wide` (880px) — results page

---

## State management

### Form state
React `useState` + `sessionStorage`. The reason:
- 7 fields with mostly-optional validation — react-hook-form is overkill
- URL params would expose intake data in the URL, undercutting the "no data stored" pitch
- sessionStorage persists across hard reloads within a tab (so 503 retries don't lose data) but doesn't persist across tab closes (so privacy holds)

**Implementation pattern when building the form:**

```ts
const [intake, setIntake] = useState<Intake>(() => {
  const stored = sessionStorage.getItem('kth-intake');
  return stored ? JSON.parse(stored) : initialIntake;
});

useEffect(() => {
  sessionStorage.setItem('kth-intake', JSON.stringify(intake));
}, [intake]);
```

Wrap this in a custom hook `useIntakeStorage()` when you build the IntakeForm feature.

### Tier expansion state (advice cards)
Each `AdviceCard` owns its own tier state (`useState<1 | 2 | 3>`). Cards are independent — opening one doesn't close another. No global state needed.

### Results page state
Whatever the API returns lives in page-level state after the form submits. Loading and error states are derived from the request lifecycle. No global state needed for v1.

---

## Routing (not yet built)

The product has these routes:
- `/` — Landing
- `/intake` — Form
- `/results` — Results (consumes form data via sessionStorage)
- Error states render in-place at `/results` rather than separate routes (cleaner browser back-button behavior)

Use `react-router-dom` v6+ when adding routing. The single page app pattern means Vercel needs a `vercel.json` rewrite rule:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## What's currently locked

### Design surfaces (all desktop + mobile)
- ✅ Logo system (mark + full lockup with `[1]` superscript or dot fallback)
- ✅ Color palette and grade ramp
- ✅ Input system (text, textarea, select with custom chevron, segmented control, chips, checkbox)
- ✅ Landing page (hero / how it works / samples / methodology / dark footer CTA)
- ✅ Intake form (required spine + optional refinements + condition warning)
- ✅ Results page (domain-grouped cards + three-tier progressive disclosure + summary card + intake recap)
- ✅ Loading state (four-phase progress card + breathing headline + pulse ring)
- ✅ Failure states: Tavily degraded, Claude 503, network unreachable, hang (45s+)

### Code
- ✅ Tailwind config with full token extension
- ✅ Global CSS (font imports, base layer, utility classes)
- ✅ All UI primitive components (10 components in `ui/`)
- ✅ `cn` class-name utility
- ✅ Design tokens documentation

---

## What's still ahead

### Immediate next steps (when ready)
1. **Build feature components** — start with `AdviceCard` (most complex, sets patterns for the rest)
2. **Build page-level shells** — Landing first (simplest, validates the system end-to-end)
3. **Wire up sessionStorage hook** for intake persistence
4. **Add routing** with react-router-dom
5. **Integrate with backend** — replace mock data with API calls to the Express backend

### Punted decisions (need to revisit)
- **Dark mode** — tokens are mode-aware ready but no dark-mode pass has been done on the surfaces. Add a `dark:` variant pass across components when you decide to ship dark mode.
- **Symptom chip presets** — the current list (Fatigue / Sleep issues / Joint pain / Digestive issues / Anxiety / Headaches / Weight management / Skin concerns) is a placeholder. Curate this with actual user research.
- **Status page** — `status.knowthyhealth.app` is referenced in the network failure state but doesn't exist yet. If you want to make this real, [statuspage.io](https://statuspage.io) or [betteruptime.com](https://betteruptime.com) handle it cheaply.
- **"Why this happens" link** in the Tavily degraded banner — needs a destination (could be a methodology section anchor or a small modal).
- **PRD has stale specs** — the v1.3 PRD specifies traffic-light grade colors (A=green, B=blue, etc.) but the design uses saturated brand ramp (A=plum, B=sage, C=sand, D=copper, F=deep red). Update the PRD changelog when convenient.

---

## Conventions

### Component file conventions
- One component per file, PascalCase filename matches export name
- Use `forwardRef` when the component might need a ref (Button, Input, Card, Chip, Checkbox)
- Export type interfaces only if a parent needs them (e.g., `Grade` is exported because feature components need to type their props)
- Keep JSDoc terse but explain *when* to use each variant, not just *what* it does

### Styling conventions
- **Prefer Tailwind utility classes** over inline styles
- **Use design token names** (e.g., `text-plum-500`) not hex codes (avoid `text-[#6D3F73]`)
- **Arbitrary values are okay** for one-off pixel values that don't merit a token (e.g., `py-[11px]` for input padding) but if you see the same arbitrary value repeated 3+ times, add it as a token
- **`cn()`** for conditional classes; avoid template literal concatenation

### State conventions
- Local state in components when possible
- Custom hooks for state that's reused (e.g., `useIntakeStorage`)
- No global state libraries until you have a concrete need

---

## Architecture decisions log

These are the calls that shaped the codebase. Captured here so you don't have to re-litigate them.

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Variant logic across components benefits from prop typing; the cost is minimal at this scale |
| Styling | Tailwind + extended config | Production-grade approach; arbitrary values stay rare; tokens are reusable |
| State (form) | React + sessionStorage | URL params would leak intake data; react-hook-form is overkill for 7 fields |
| Icons | `@tabler/icons-react` | Matches the mockup vocabulary exactly; tree-shakes |
| Component org | Atomic + features (`ui/` + `features/`) | UI primitives get reused; separation makes the system legible |
| Form library | None | The form has light validation; useState handles it |
| Routing | (Pending) react-router-dom | When pages are built |
| Dark mode | Pending | Tokens are mode-aware ready |
| Voice | "Thy" only in name + logo baseline | Tried both ways; modern English everywhere else reads cleaner |
| Tier model | Three accordion states in-place (Model A) | After comparing three depth models, this gave the best progressive disclosure with lowest cognitive tax once tier indicators were added |
| Grade ramp | Saturated tiles, paper-white letters | Tinted-pastel versions had A/B indistinguishability problems; saturation solved this |
| Error diagnostics | Removed | Initially exposed stage names + request IDs; flagged as security risk (pipeline architecture leak). Now only a short opaque support reference for users who want to report issues |
| Domains in results | Variable per response | The system decides which domains have research worth surfacing for this profile; not a fixed taxonomy |

---

## When you bring on a developer

If/when someone else touches this codebase, hand them:
1. This README
2. `docs/design-tokens.md`
3. A walkthrough of the `ui/` primitives — they're small, easy to read, and tell you 80% of the visual system in 10 files
4. The current Figma file or mockup references (the visualizer renders in this design conversation can be exported)

The two questions they'll likely ask first:
- **"Where do I put X?"** — `ui/` for reusable visual primitives, `features/` for product-specific composites, `pages/` for routes
- **"What's the color for Y?"** — `docs/design-tokens.md`, then `tailwind.config.js`

---

## Acknowledgments

The visual identity, copy, and UX architecture were designed iteratively through a long working session that locked the following key positions:

- **Brand thesis (locked):** *"Research is rigorous and specific. Knowing when it applies to you? That's powerful."* (with "powerful" italicized)
- **Hero subhead (locked):** *"Studies are designed around a defined population; that's how variables get controlled and findings get isolated. The breakdown is downstream — those findings get extrapolated by media, the wellness industry, and even medical professionals, to people who resemble nothing of the study subjects. KnowThyHealth surfaces the research done on people like you — your gender, your age — and grades each finding by the strength of its evidence, so you get the information you actually need."*
- **Primary CTA (locked):** "Try it on yourself →"
- **Secondary text link (locked):** "Not sure? Here's what you might expect"
- **Footer CTA (locked):** "See what the research has to say about you."

These appear throughout the design and should not change without revisiting the whole framing.
