import type { Config } from 'tailwindcss';

/**
 * UAE Palm Network — design system (gov-modern, light).
 *
 *   Primary:  oasis teal   #124E57  (authority, depth)
 *   Accent:   desert gold  #B08A3E  (recognition, certification — used sparingly)
 *   Success:  palm mint    #2E9E7E
 *   Canvas:   warm sand    #F4F1EA  with white surfaces
 *
 * Semantic token names (brand/ink/cream/mist/muted/line) are kept identical
 * to the inherited codebase so every component repaints without edits.
 * Legacy aliases (forest/amber/terra/lime) map onto the new ramps.
 */

const brandRamp = {
  DEFAULT: '#124E57',
  50:  '#EDF4F4',
  100: '#D4E5E6',
  200: '#A9CBCD',
  300: '#7BAEB2',
  400: '#4F9096',
  500: '#2E747C',
  600: '#1B5F68',
  700: '#124E57',
  800: '#0C3B43',
  900: '#07272D',
};

const goldRamp = {
  DEFAULT: '#B08A3E',
  50:  '#FAF5EA',
  100: '#F1E6CB',
  200: '#E4CF9E',
  300: '#D5B672',
  400: '#C6A050',
  500: '#B08A3E',
  600: '#927030',
  700: '#715624',
  800: '#4D3A18',
  900: '#2A1F0C',
};

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── Primary brand: oasis teal ─────────────────────────
        brand: brandRamp,

        // ── Gold accent (certification / recognition moments) ──
        gold: goldRamp,

        // ── Success: palm mint ────────────────────────────────
        mint: {
          DEFAULT: '#2E9E7E',
          100: '#DDF2EB',
          300: '#8ED4BE',
          500: '#2E9E7E',
          700: '#1E6B55',
        },

        // ── Neutral ramp — warm sand ──────────────────────────
        ink:   '#16282B',
        cream: '#FAF7F1',  // raised warm surface
        mist:  '#F4F1EA',  // body canvas
        muted: '#6E7A78',  // secondary text
        line:  '#E6E1D6',  // borders

        // ── Legacy aliases (existing component refs repaint in-brand) ──
        forest: brandRamp,
        amber: goldRamp,
        terra: goldRamp,
        lime: goldRamp,
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'IBM Plex Sans Arabic', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'Amiri', 'serif'],
        display: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(18, 78, 87, 0.04), 0 2px 8px rgba(18, 78, 87, 0.05)',
        'card-hover': '0 6px 18px rgba(18, 78, 87, 0.10)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
};

export default config;
