// The font catalogue behind the Settings page dropdown.
//
// Fonts are loaded from Google Fonts *on demand* — only the family a user
// actually picks is ever fetched, so a user who never opens Settings pays
// nothing. The stylesheet is injected once per family and then cached by the
// browser across visits.
//
// `id` is what gets stored on the user record, so it must stay stable — don't
// rename ids, only labels. `system: true` means no network request is needed.
// `w2` marks families that ship a 700 weight; those are requested as
// "wght@400;700" so bold text renders with a real bold rather than the
// browser's synthesised (smeared) fake bold. Families without it are 400-only,
// and asking for a weight Google doesn't have returns a 400 and no font at all.

const FALLBACKS = {
  sans: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  serif: "ui-serif, Georgia, Cambria, Times New Roman, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  display: "ui-sans-serif, system-ui, sans-serif",
  handwriting: "cursive",
};

// [id, label, category, isGoogle, hasBold]
const RAW = [
  // --- System / no download -------------------------------------------
  ["sans", "Default (system)", "sans", false],
  ["serif", "Serif (system)", "serif", false],
  ["mono", "Mono (system)", "mono", false],
  ["Arial", "Arial", "sans", false],
  ["Verdana", "Verdana", "sans", false],
  ["Tahoma", "Tahoma", "sans", false],
  ["Trebuchet MS", "Trebuchet MS", "sans", false],
  ["Georgia", "Georgia", "serif", false],
  ["Times New Roman", "Times New Roman", "serif", false],
  ["Courier New", "Courier New", "mono", false],

  // --- Sans ------------------------------------------------------------
  ["Inter", "Inter", "sans", true, true],
  ["Roboto", "Roboto", "sans", true, true],
  ["Open Sans", "Open Sans", "sans", true, true],
  ["Lato", "Lato", "sans", true, true],
  ["Montserrat", "Montserrat", "sans", true, true],
  ["Poppins", "Poppins", "sans", true, true],
  ["Raleway", "Raleway", "sans", true, true],
  ["Nunito", "Nunito", "sans", true, true],
  ["Nunito Sans", "Nunito Sans", "sans", true, true],
  ["Work Sans", "Work Sans", "sans", true, true],
  ["Rubik", "Rubik", "sans", true, true],
  ["Karla", "Karla", "sans", true, true],
  ["Mulish", "Mulish", "sans", true, true],
  ["Manrope", "Manrope", "sans", true, true],
  ["DM Sans", "DM Sans", "sans", true, true],
  ["Barlow", "Barlow", "sans", true, true],
  ["Heebo", "Heebo", "sans", true, true],
  ["Assistant", "Assistant", "sans", true, true],
  ["Cabin", "Cabin", "sans", true, true],
  ["Quicksand", "Quicksand", "sans", true, true],
  ["Josefin Sans", "Josefin Sans", "sans", true, true],
  ["Source Sans 3", "Source Sans 3", "sans", true, true],
  ["PT Sans", "PT Sans", "sans", true, true],
  ["Ubuntu", "Ubuntu", "sans", true, true],
  ["Fira Sans", "Fira Sans", "sans", true, true],
  ["Noto Sans", "Noto Sans", "sans", true, true],
  ["Titillium Web", "Titillium Web", "sans", true, true],
  ["Exo 2", "Exo 2", "sans", true, true],
  ["Asap", "Asap", "sans", true, true],
  ["Chivo", "Chivo", "sans", true, true],
  ["Overpass", "Overpass", "sans", true, true],
  ["Public Sans", "Public Sans", "sans", true, true],
  ["Red Hat Display", "Red Hat Display", "sans", true, true],
  ["Plus Jakarta Sans", "Plus Jakarta Sans", "sans", true, true],
  ["Figtree", "Figtree", "sans", true, true],
  ["Outfit", "Outfit", "sans", true, true],
  ["Sora", "Sora", "sans", true, true],
  ["Urbanist", "Urbanist", "sans", true, true],
  ["Lexend", "Lexend", "sans", true, true],
  ["Epilogue", "Epilogue", "sans", true, true],
  ["Space Grotesk", "Space Grotesk", "sans", true, true],
  ["Archivo", "Archivo", "sans", true, true],
  ["Hind", "Hind", "sans", true, true],
  ["Oxygen", "Oxygen", "sans", true, true],
  ["Catamaran", "Catamaran", "sans", true, true],
  ["Signika", "Signika", "sans", true, true],
  ["Kanit", "Kanit", "sans", true, true],
  ["Prompt", "Prompt", "sans", true, true],
  ["Mukta", "Mukta", "sans", true, true],

  // --- Serif -----------------------------------------------------------
  ["Merriweather", "Merriweather", "serif", true, true],
  ["Playfair Display", "Playfair Display", "serif", true, true],
  ["Lora", "Lora", "serif", true, true],
  ["PT Serif", "PT Serif", "serif", true, true],
  ["Noto Serif", "Noto Serif", "serif", true, true],
  ["Crimson Text", "Crimson Text", "serif", true, true],
  ["Libre Baskerville", "Libre Baskerville", "serif", true, true],
  ["Bitter", "Bitter", "serif", true, true],
  ["Arvo", "Arvo", "serif", true, true],
  ["Cardo", "Cardo", "serif", true, true],
  ["Neuton", "Neuton", "serif", true, true],
  ["Vollkorn", "Vollkorn", "serif", true, true],
  ["Cormorant Garamond", "Cormorant Garamond", "serif", true, true],
  ["EB Garamond", "EB Garamond", "serif", true, true],
  ["Spectral", "Spectral", "serif", true, true],
  ["Source Serif 4", "Source Serif 4", "serif", true, true],
  ["Zilla Slab", "Zilla Slab", "serif", true, true],
  ["Roboto Slab", "Roboto Slab", "serif", true, true],
  ["Domine", "Domine", "serif", true, true],
  ["Frank Ruhl Libre", "Frank Ruhl Libre", "serif", true, true],
  ["Tinos", "Tinos", "serif", true, true],
  ["Gelasio", "Gelasio", "serif", true, true],
  ["Literata", "Literata", "serif", true, true],

  // --- Mono ------------------------------------------------------------
  ["Fira Code", "Fira Code", "mono", true, true],
  ["JetBrains Mono", "JetBrains Mono", "mono", true, true],
  ["Source Code Pro", "Source Code Pro", "mono", true, true],
  ["IBM Plex Mono", "IBM Plex Mono", "mono", true, true],
  ["Space Mono", "Space Mono", "mono", true, true],
  ["Inconsolata", "Inconsolata", "mono", true, true],
  ["Roboto Mono", "Roboto Mono", "mono", true, true],
  ["Ubuntu Mono", "Ubuntu Mono", "mono", true, true],
  ["Cousine", "Cousine", "mono", true, true],
  ["Overpass Mono", "Overpass Mono", "mono", true, true],
  ["Red Hat Mono", "Red Hat Mono", "mono", true, true],
  ["Azeret Mono", "Azeret Mono", "mono", true, true],
  ["DM Mono", "DM Mono", "mono", true, true],

  // --- Display ---------------------------------------------------------
  ["Oswald", "Oswald", "display", true, true],
  ["Bebas Neue", "Bebas Neue", "display", true],
  ["Anton", "Anton", "display", true],
  ["Teko", "Teko", "display", true, true],
  ["Righteous", "Righteous", "display", true],
  ["Comfortaa", "Comfortaa", "display", true, true],
  ["Fredoka", "Fredoka", "display", true, true],
  ["Baloo 2", "Baloo 2", "display", true, true],
  ["Lobster", "Lobster", "display", true],
  ["Alfa Slab One", "Alfa Slab One", "display", true],

  // --- Handwriting -----------------------------------------------------
  ["Dancing Script", "Dancing Script", "handwriting", true, true],
  ["Pacifico", "Pacifico", "handwriting", true],
  ["Caveat", "Caveat", "handwriting", true, true],
  ["Satisfy", "Satisfy", "handwriting", true],
  ["Great Vibes", "Great Vibes", "handwriting", true],
  ["Shadows Into Light", "Shadows Into Light", "handwriting", true],
  ["Indie Flower", "Indie Flower", "handwriting", true],
  ["Permanent Marker", "Permanent Marker", "handwriting", true],
  ["Kalam", "Kalam", "handwriting", true, true],
  ["Amatic SC", "Amatic SC", "handwriting", true, true],
];

export const FONTS = RAW.map(([id, label, category, google, bold]) => ({
  id,
  label,
  category,
  google: Boolean(google),
  bold: Boolean(bold),
}));

const FONT_BY_ID = new Map(FONTS.map((f) => [f.id, f]));

export const FONT_CATEGORIES = [
  { key: "sans", label: "Sans-serif" },
  { key: "serif", label: "Serif" },
  { key: "mono", label: "Monospace" },
  { key: "display", label: "Display" },
  { key: "handwriting", label: "Handwriting" },
];

// Legacy values: before this catalogue existed, fontFamily was one of exactly
// three strings. Those are still in the database on existing accounts and must
// keep working, so they're real entries in the list above rather than special
// cases here.
export function isKnownFont(id) {
  return FONT_BY_ID.has(id);
}

// Resolves a stored id to a CSS font-family stack.
//
// Anything unrecognised falls back to the default stack instead of being
// interpolated into CSS. That matters: this value comes back from the API and
// is written into a style property, so echoing an arbitrary stored string there
// would let a tampered record inject CSS. Only ids in the catalogue above can
// ever reach the DOM.
export function getFontStack(id) {
  const font = FONT_BY_ID.get(id);
  if (!font) return FALLBACKS.sans;
  if (!font.google) {
    if (font.id === "sans") return FALLBACKS.sans;
    if (font.id === "serif") return FALLBACKS.serif;
    if (font.id === "mono") return FALLBACKS.mono;
    return `"${font.id}", ${FALLBACKS[font.category]}`;
  }
  return `"${font.id}", ${FALLBACKS[font.category]}`;
}

const loaded = new Set();

// Injects the Google Fonts stylesheet for one family, once.
export function loadFont(id) {
  const font = FONT_BY_ID.get(id);
  if (!font || !font.google || loaded.has(id) || typeof document === "undefined") return;
  loaded.add(id);

  const family = id.replace(/ /g, "+");
  const weights = font.bold ? ":wght@400;700" : "";

  const link = document.createElement("link");
  link.rel = "stylesheet";
  // display=swap renders immediately in the fallback and swaps when the font
  // arrives, so a slow font never leaves the UI blank.
  link.href = `https://fonts.googleapis.com/css2?family=${family}${weights}&display=swap`;
  document.head.appendChild(link);
}
