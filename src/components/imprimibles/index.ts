// ═══════════════════════════════════════════════════════════════════════════════
// KIT · FAMILIA `imprimibles/` — puerta única (N1 de la Guía 0.8)
//
// Un módulo NUNCA importa de un path interno: se importa desde
// `@/components/imprimibles`.
//
// Nació con la PROMOCIÓN del contenedor `DocumentoImprimibleDialog`
// (27 Sep 2026 · carril PROMOCIÓN de `actualizar-guia` · contrato agregado
// 27 Sep 2026): nació en la Guía 1.6 (BLOQUE 12) viviendo en `components/entradas/`
// y subió al kit porque lo consumen las guías 1.4 · 1.6 · 1.7 · 1.8.
//
// ⭐ Guía 2.1 P6 (27 Sep 2026) — la familia se completa:
//   · `DocumentoImprimible` — EL PUNTO DE INVOCACIÓN por `tipo`. NACE DIRECTO aquí
//     (sus ≥2 consumidores son anteriores a su existencia; precedente
//     `SelectorUbicacionCascada`).
//   · `CuerpoDocumento` — el ÚNICO punto del proyecto que inyecta HTML en el DOM.
//
// El alcance del carril de plantillas vive en `DOCS/SISTEMA_IMPRESION.md`.
// ═══════════════════════════════════════════════════════════════════════════════

export { DocumentoImprimibleDialog } from './DocumentoImprimibleDialog'
export { DocumentoImprimible } from './DocumentoImprimible'
export { CuerpoDocumento } from './CuerpoDocumento'
