import path from 'path'
import fs from 'fs'
import { Font } from '@react-pdf/renderer'

let registered = false

/**
 * Register the Cairo Arabic font using local files from public/fonts/.
 * Used server-side (Node.js API routes) where CDN URLs may not resolve correctly.
 */
export function registerArabicFontServer() {
  if (registered) return
  registered = true

  // Next.js sets process.cwd() to the project root (apps/web).
  // Try multiple candidate roots to be safe in monorepo setups.
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts'),
    path.join(process.cwd(), 'apps', 'web', 'public', 'fonts'),
    path.join(__dirname, '..', '..', '..', 'public', 'fonts'),
    path.join(__dirname, '..', '..', '..', '..', 'public', 'fonts'),
  ]

  let fontsDir: string | null = null
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'cairo-400.woff'))) {
      fontsDir = candidate
      break
    }
  }

  console.log('[PDF fonts] cwd:', process.cwd(), '| fontsDir:', fontsDir)

  if (!fontsDir) {
    // Fallback: use CDN URLs if local files not found
    console.warn('[PDF fonts] Local font files not found, falling back to CDN')
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
  } else {
    Font.register({
      family: 'Cairo',
      fonts: [
        {
          src: path.join(fontsDir, 'cairo-400.woff'),
          fontWeight: 'normal',
        },
        {
          src: path.join(fontsDir, 'cairo-700.woff'),
          fontWeight: 'bold',
        },
      ],
    })
  }

  Font.registerHyphenationCallback((word) => [word])
}
