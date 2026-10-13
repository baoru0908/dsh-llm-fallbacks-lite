import { defineConfig } from 'tsdown'

export default defineConfig({
  name: 'dsh-llm-fallbacks',
  entry: ['./.build/host/index.js'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  fixedExtension: false,
  deps: {
    neverBundle: ['cordis', /^@deepseek-ai\//],
    onlyBundle: false,
  },
  dts: false,
  clean: true,
  outputOptions: {
    comments: false,
  },
})
