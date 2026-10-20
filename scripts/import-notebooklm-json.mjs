/**
 * Añade un JSON de preguntas (formato NotebookLM) al banco de estudio en data/notebooklm/.
 * Luego: node scripts/build-exam-packs.mjs (reparte el banco en tests y simulacros).
 *
 * Uso: node scripts/import-notebooklm-json.mjs "C:\ruta\preguntas.json"
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { notebookLmEsToStandard } from '../src/notebooklm-format.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const input = process.argv[2]
if (!input) {
  console.error('Uso: node scripts/import-notebooklm-json.mjs <archivo.json>')
  process.exit(1)
}

const std = notebookLmEsToStandard(JSON.parse(readFileSync(input, 'utf8')))
if (!std.questions?.length) {
  console.error('El JSON no tiene preguntas[] con el formato esperado.')
  process.exit(1)
}

const dataDir = join(root, 'data', 'notebooklm')
mkdirSync(dataDir, { recursive: true })
const dataPath = join(dataDir, basename(input))
copyFileSync(input, dataPath)

console.log(`OK: ${std.questions.length} preguntas → ${dataPath}`)
console.log('Siguiente: node scripts/build-exam-packs.mjs')
