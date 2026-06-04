/**
 * Tailwind configuration extending the default theme with the KnowThyHealth
 * design system. All custom tokens live here so component code stays free
 * of arbitrary values.
 *
 * Companion docs: docs/design-tokens.md
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // ────────────────────────────────────────────────────────────────────
      // Colors
      // ────────────────────────────────────────────────────────────────────
      colors: {
        // Brand plum — used for accents, focus rings, primary actions in
        // small surfaces, A-grade tile, custom-chip pills, etc.
        plum: {
          50: '#FDF8FE',
          100: '#F3E8F5',
          200: '#D8B4DE',
          400: '#8A6092',
          500: '#6D3F73', // canonical brand color
          600: '#5A3460',
          900: '#3A1E40',
        },

        // Ink (near-black) — body text, primary CTA, full-bleed dark surfaces
        ink: {
          DEFAULT: '#1C1917',
          800: '#2A2724',
          700: '#44403C',
        },

        // Stone (warm neutrals) — backgrounds, borders, secondary text
        stone: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#C5C0BC',
          500: '#A8A29E',
          600: '#78716C',
          700: '#57534E',
        },

        // Grade ramp — saturated tiles, paper-white letters
        grade: {
          a: '#6D3F73', // plum (brand signature for strong evidence)
          b: '#4D6638', // sage
          c: '#876B36', // sand
          d: '#874425', // copper
          f: '#6E1E1E', // deep red
        },

        // Tier-state border colors for cards (T2 + T3 outline treatment)
        tier: {
          t2: '#D8B4DE',
          t3: '#6D3F73',
        },

        // Semantic — warnings, errors, the warning banner family
        warn: {
          bg: '#FEF3C7',
          border: '#B45309',
          text: '#7C2D12',
          textBold: '#92400E',
        },
        danger: {
          bg: '#FEE2E2',
          border: '#DC2626',
          text: '#7F1D1D',
          textBold: '#991B1B',
        },

        // Paper — the lightest neutral, used as the page background and
        // as the light text color on dark surfaces
        paper: '#FAFAF9',
      },

      // ────────────────────────────────────────────────────────────────────
      // Typography
      // ────────────────────────────────────────────────────────────────────
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        serif: [
          'Source Serif 4',
          'Source Serif Pro',
          'Georgia',
          'serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },

      // Custom font sizes for headlines/labels that don't fit the default scale
      fontSize: {
        // Display sizes (hero headlines)
        'display-lg': ['44px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['36px', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-sm': ['28px', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        'display-xs': ['22px', { lineHeight: '1.2', letterSpacing: '-0.015em' }],

        // Section labels (the small caps plum labels above headings)
        'section-label': [
          '11px',
          {
            lineHeight: '1.2',
            letterSpacing: '0.12em',
            fontWeight: '500',
          },
        ],
      },

      // ────────────────────────────────────────────────────────────────────
      // Borders & Radii
      // ────────────────────────────────────────────────────────────────────
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },

      // Hairline borders for cards and dividers
      borderWidth: {
        hairline: '0.5px',
      },

      // ────────────────────────────────────────────────────────────────────
      // Spacing — extras beyond the default Tailwind scale
      // ────────────────────────────────────────────────────────────────────
      maxWidth: {
        page: '640px', // landing + loading + most narrow surfaces
        form: '720px', // intake form (wider for 2-col field layout)
        wide: '880px', // results page
      },

      // ────────────────────────────────────────────────────────────────────
      // Effects — focus rings, transitions
      // ────────────────────────────────────────────────────────────────────
      boxShadow: {
        // 3px plum focus ring for inputs (rgba so it works on any bg)
        focus: '0 0 0 3px rgba(109, 63, 115, 0.12)',
        // Subtle elevation for the segmented control's "pressed" state
        seg: '0 1px 2px rgba(0,0,0,0.06), 0 0 0 0.5px #D6D3D1',
        // Soft plum glow used on T3 cards
        'tier-3': '0 0 0 3px rgba(109, 63, 115, 0.08)',
      },

      // ────────────────────────────────────────────────────────────────────
      // Animation — loading dots, pulse rings, breathing headlines
      // ────────────────────────────────────────────────────────────────────
      animation: {
        'dot-pulse': 'dot-pulse 1.4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        'title-breathe': 'title-breathe 3s ease-in-out infinite',
      },
      keyframes: {
        'dot-pulse': {
          '0%, 80%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '40%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'title-breathe': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },

      // ────────────────────────────────────────────────────────────────────
      // Letter spacing — used by the "thy health" baseline + section labels
      // ────────────────────────────────────────────────────────────────────
      letterSpacing: {
        baseline: '0.22em', // logo "thy health" baseline
        label: '0.12em', // section labels
        meta: '0.05em', // small meta caps
      },
    },
  },
  plugins: [],
};
