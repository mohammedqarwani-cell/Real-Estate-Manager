import { Font } from '@react-pdf/renderer'

let registered = false

/**
 * Register the Cairo Arabic font for use in PDF documents.
 * Fonts are loaded from jsDelivr CDN (requires internet connection).
 *
 * For offline / production use, download the font files and place them in
 * apps/web/public/fonts/ then change the src to '/fonts/Cairo-Regular.woff'
 */
export function registerArabicFont() {
  if (registered) return
  registered = true

  Font.register({
    family: 'Cairo',
    fonts: [
      {
        src: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.19/files/cairo-arabic-400-normal.woff',
        fontWeight: 'normal',
      },
      {
        src: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.19/files/cairo-arabic-700-normal.woff',
        fontWeight: 'bold',
      },
    ],
  })

  // Disable hyphenation so Arabic words are never split
  Font.registerHyphenationCallback((word) => [word])
}
