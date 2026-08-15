import { Fraunces, Inter, IBM_Plex_Mono, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";

// Latin display/body/mono stack — ported 1:1 from the prototype's Google
// Fonts link (Fraunces + Inter + IBM Plex Mono).
export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

// Script fonts for the mandatory non-Latin locales. Loaded unconditionally
// via next/font (which subsets + self-hosts at build time) but only
// referenced by the CSS variable chain when `data-locale="si"|"ta"` is set
// on <html> (see globals.css), so Latin-only visitors never pay for glyphs
// they don't render.
export const notoSansSinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-noto-si",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const notoSansTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  variable: "--font-noto-ta",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const fontVariables = [
  fraunces.variable,
  inter.variable,
  plexMono.variable,
  notoSansSinhala.variable,
  notoSansTamil.variable,
].join(" ");
