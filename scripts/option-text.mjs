/** Texto visible en cada opción del test (primer bloque del contenido, sin recortar en exceso). */
export const OPTION_TEXT_MAX = 720

/** Opciones en packs de examen: más cortas, estilo cuestionario. */
export const EXAM_OPTION_MAX = 240

export function summarizeOptionText(raw, max = OPTION_TEXT_MAX) {
  if (!raw) return ""
  const plain = String(raw)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\r\n/g, "\n")
    .trim()
  const firstBlock = (plain.split(/\n\n+/)[0] || plain).replace(/\s+/g, " ").trim()
  if (firstBlock.length <= max) return firstBlock
  const cut = firstBlock.slice(0, max - 1)
  const sp = cut.lastIndexOf(" ")
  return (sp > max * 0.55 ? cut.slice(0, sp) : cut) + "…"
}

export function examOptionText(raw) {
  return summarizeOptionText(raw, EXAM_OPTION_MAX)
}
