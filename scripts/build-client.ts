/**
 * Client bundle build: emits the closure-factory CJS artifact the dsh web
 * loader consumes — `window.__ModuleLoader__.load({ id: 'dsh-llm-fallbacks',
 * factory: (require) => { … return module.exports; } })`. Externals resolve
 * through the loader module table (the platform seed entries — in 0.1.2 the
 * former runtime exemption is folded into the `@deepseek-ai/dsh-client-store`
 * platform module, the client half's one VALUE import); everything else
 * inlines.
 */

import { build } from 'tsdown'
import { basename, dirname, join, resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const ID = 'dsh-llm-fallbacks'
const ENTRY = 'src/client/index.ts'
const OUT_DIR = 'dist/client'
const OUT_FILE = 'index.js'

export const CLIENT_EXTERNALS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
]

function hashClass(local: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < local.length; i++) {
    h ^= local.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `_${h.toString(16).padStart(8, '0')}_${local}`
}

function styleInjectionContents(cssText: string, tagId: string): string {
  return [
    `const css = ${JSON.stringify(cssText)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
    `  const tag = document.createElement('style');`,
    `  tag.dataset.plugin = ${JSON.stringify(ID)};`,
    `  tag.dataset.pluginCss = tagId;`,
    `  tag.textContent = css;`,
    `  document.head.appendChild(tag);`,
    `}`,
  ].join('\n')
}

function hashSelectorTokens(cssText: string, classMap: Record<string, string>): string {
  let out = ''
  let i = 0
  let selectorStart = 0
  while (i < cssText.length) {
    if (cssText[i] === '{') {
      out += cssText.slice(selectorStart, i).replace(/\.[A-Za-z_][A-Za-z0-9_-]*/g, (match) => {
        const local = match.slice(1)
        const hashed = hashClass(local)
        classMap[local] = hashed
        return `.${hashed}`
      })
      let depth = 1
      const blockStart = i + 1
      i++
      while (i < cssText.length && depth > 0) {
        if (cssText[i] === '{') depth++
        else if (cssText[i] === '}') depth--
        i++
      }
      const blockEnd = depth === 0 ? i - 1 : i
      out += `{${hashSelectorTokens(cssText.slice(blockStart, blockEnd), classMap)}}`
      selectorStart = i
    } else {
      i++
    }
  }
  out += cssText.slice(selectorStart)
  return out
}

function cssModuleContents(fileId: string): string {
  const source = readFileSync(fileId, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const classMap: Record<string, string> = {}
  const css = hashSelectorTokens(source, classMap)
  const tagId = `${ID}/${basename(fileId)}`
  return [
    styleInjectionContents(css, tagId),
    `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

await build({
  config: false,
  name: `${ID}/client`,
  entry: { index: ENTRY },
  outDir: OUT_DIR,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    onlyBundle: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: OUT_FILE,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
  plugins: [
    {
      name: 'dsh-client-bundle-purity',
      resolveId(source: string) {
        if (source.startsWith('@deepseek-ai/') && !CLIENT_EXTERNALS.includes(source)) {
          throw new Error(
            `client bundle purity: value import of ${source} is not in CLIENT_EXTERNALS — type-only peers must stay type-only (use \`import type\`)`,
          )
        }
        return null
      },
    },
    {
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? resolve(dirname(importer), source) : source
        return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      load(id: string) {
        if (!id.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = id.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        return cssModuleContents(fileId)
      },
    },
  ],
})

const outFile = join(OUT_DIR, OUT_FILE)
if (!existsSync(outFile)) {
  throw new Error(`client bundle build: expected ${outFile} — check the tsdown config (entry/entryFileNames/outDir)`)
}

console.log(`build-client: ${ENTRY} -> ${outFile} (closure-factory CJS, tsdown)`)
