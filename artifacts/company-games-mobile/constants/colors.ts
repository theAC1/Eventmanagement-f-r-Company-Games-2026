/**
 * Semantic design tokens for the Company Games 2026 mobile app.
 *
 * Mirrors the web app's dark "zinc" theme (zinc-950 background, zinc-800
 * borders, emerald accent) so both artifacts share one visual identity.
 * The palette is intentionally dark-only: the same values are used for the
 * `light` and (implicit) dark scheme so the app always renders dark.
 */

const dark = {
  // Legacy aliases
  text: '#fafafa',
  tint: '#10b981',

  // Core surfaces (zinc-950 / zinc-50)
  background: '#09090b',
  foreground: '#fafafa',

  // Cards / elevated surfaces (zinc-900)
  card: '#18181b',
  cardForeground: '#fafafa',

  // Primary action color — emerald-500
  primary: '#10b981',
  primaryForeground: '#052e16',

  // Secondary interactive surfaces (zinc-800)
  secondary: '#27272a',
  secondaryForeground: '#fafafa',

  // Muted / subdued elements (zinc-400)
  muted: '#18181b',
  mutedForeground: '#a1a1aa',

  // Accent highlights (zinc-800)
  accent: '#27272a',
  accentForeground: '#fafafa',

  // Destructive
  destructive: '#ef4444',
  destructiveForeground: '#fafafa',

  // Borders and inputs (zinc-800)
  border: '#27272a',
  input: '#27272a',

  // Extra semantic colors used across screens
  success: '#10b981',
  warning: '#f59e0b',
  gold: '#f59e0b',
  silver: '#a1a1aa',
  bronze: '#c2703c',
};

const colors = {
  light: dark,
  dark,
  radius: 12,
};

export default colors;
