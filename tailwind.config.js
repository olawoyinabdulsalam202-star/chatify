import daisyui from "daisyui";

// Every slate/cyan shade the UI paints with is declared here as a reference to a
// CSS variable instead of a fixed hex. The variable values live per-theme in
// src/index.css.
//
// Why this indirection exists: the entire UI is written in literal Tailwind
// classes (bg-slate-800, text-slate-200, border-slate-700, ...) — hundreds of
// them across the app. Pointing the palette at variables makes every existing
// usage theme-aware without editing a single component. `slate` now holds the
// warm neutral grays and `cyan` the terracotta accent; the names are kept so
// the existing classes keep resolving.
//
// The `<alpha-value>` placeholder is what keeps opacity modifiers working:
// `bg-slate-800/50` compiles to `rgb(var(--c-slate-800) / 0.5)`.
const themedRamp = (name) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
      shade,
      `rgb(var(--c-${name}-${shade}) / <alpha-value>)`,
    ])
  );

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        slate: themedRamp("slate"),
        cyan: themedRamp("cyan"),
        // Semantic aliases for new components — same variables, clearer intent.
        accent: themedRamp("cyan"),
        ink: themedRamp("slate"),
      },
      fontFamily: {
        display: ["var(--font-display)"],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    // The built-in "dark" and "light" names are overridden with Havn palettes so
    // daisyUI's own components (toggles, the avatar online dot, btn-primary) use
    // the terracotta accent and warm surfaces instead of daisyUI's defaults.
    themes: [
      {
        dark: {
          "color-scheme": "dark",
          primary: "#C2410C",
          "primary-content": "#FFF7ED",
          secondary: "#8A7A6B",
          "secondary-content": "#FAF7F2",
          accent: "#C2410C",
          "accent-content": "#FFF7ED",
          neutral: "#272320",
          "neutral-content": "#DED7CD",
          "base-100": "#141311",
          "base-200": "#272320",
          "base-300": "#3C3630",
          "base-content": "#DED7CD",
          info: "#57534E",
          success: "#3F9142",
          warning: "#B45309",
          error: "#DC5050",
        },
      },
      {
        light: {
          "color-scheme": "light",
          primary: "#C2410C",
          "primary-content": "#FFFFFF",
          secondary: "#8A7A6B",
          "secondary-content": "#FFFFFF",
          accent: "#C2410C",
          "accent-content": "#FFFFFF",
          neutral: "#3A332B",
          "neutral-content": "#FAF7F2",
          "base-100": "#FAF7F2",
          "base-200": "#F0EAE1",
          "base-300": "#E0D7CB",
          "base-content": "#3A332B",
          info: "#78716C",
          success: "#3F9142",
          warning: "#B45309",
          error: "#B91C1C",
        },
      },
    ],
  },
};
