/**
 * Convierte JSON de NotebookLM (español) a pack en public/exams/.
 * Uso: node scripts/import-notebooklm-json.mjs "C:\ruta\preguntas_datadog.json"
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { notebookLmEsToStandard } = await import(
  pathToFileURL(join(root, 'src', 'quiz.js')).href
)

const input = process.argv[2]
if (!input) {
  console.error('Uso: node scripts/import-notebooklm-json.mjs <archivo.json>')
  process.exit(1)
}

const raw = JSON.parse(readFileSync(input, 'utf8'))
const std = notebookLmEsToStandard(raw)
const pack = {
  id: 'notebooklm-datadog',
  title: std.title || 'NotebookLM — Datadog',
  type: 'test20',
  description: std.description || `${std.questions.length} preguntas importadas desde NotebookLM.`,
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
console.log(`OK: ${pack.count} preguntas → ${out}`)
