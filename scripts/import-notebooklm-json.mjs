/**
 * Importa JSON NotebookLM → data/notebooklm/ + pack suelto en public/exams/.
 * Luego: node scripts/build-exam-packs.mjs (mezcla en test-01…06 y simulacros).
 *
 * Uso: node scripts/import-notebooklm-json.mjs "C:\ruta\preguntas_datadog.json"
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { notebookLmEsToStandard } from '../src/notebooklm-format.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const input = process.argv[2]
if (!input) {
  console.error('Uso: node scripts/import-notebooklm-json.mjs <archivo.json>')
  process.exit(1)
}

const raw = JSON.parse(readFileSync(input, 'utf8'))
const std = notebookLmEsToStandard(raw)

const dataDir = join(root, 'data', 'notebooklm')
mkdirSync(dataDir, { recursive: true })
const dataPath = join(dataDir, 'preguntas_datadog.json')
copyFileSync(input, dataPath)

const pack = {
  id: 'notebooklm-datadog',
  title: std.title || 'NotebookLM — Datadog',
  type: 'test20',
  description: std.description || `${std.questions.length} preguntas NotebookLM.`,
  passPercent: std.passPercent ?? 70,
  count: std.questions.length,
  domains: {
    essential: 'Conceptos esenciales',
    infra: 'Infraestructura y Agent',
    network: 'Red y configuración',
    collection: 'Recolección de datos',
    troubleshoot: 'Troubleshooting',
    viz: 'Visualización y uso',
  },
  questions: std.questions,
}

const out = join(root, 'public', 'exams', 'notebooklm-datadog-20.json')
writeFileSync(out, JSON.stringify(pack, null, 2), 'utf8')
console.log(`OK: ${pack.count} preguntas`)
console.log(`  Fuente: ${dataPath}`)
console.log(`  Pack:   ${out}`)
console.log('Siguiente: node scripts/build-exam-packs.mjs')
