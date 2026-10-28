import daisyui from "daisyui";

// Same themed-ramp indirection as the main frontend: every slate/cyan shade
// points at a CSS variable declared per-theme in src/index.css, so the admin
// app paints with the exact Havn palette (warm neutral grays + terracotta
// accent) without hardcoding hex anywhere.
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
    ],
  },
};
