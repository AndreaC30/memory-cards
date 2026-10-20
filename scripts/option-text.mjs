/** Texto visible en cada opción del test (primer bloque del contenido, sin recortar en exceso). */
export const OPTION_TEXT_MAX = 720

export function summarizeOptionText(raw) {
  if (!raw) return ""
  const plain = String(raw)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\r\n/g, "\n")
    .trim()
  const firstBlock = (plain.split(/\n\n+/)[0] || plain).replace(/\s+/g, " ").trim()
  if (firstBlock.length <= OPTION_TEXT_MAX) return firstBlock
  const cut = firstBlock.slice(0, OPTION_TEXT_MAX - 1)
  const sp = cut.lastIndexOf(" ")
  return (sp > OPTION_TEXT_MAX * 0.55 ? cut.slice(0, sp) : cut) + "…"
}
