'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA DE ENTRADA IMPRIMIBLE — documento físico (Guía 1.6 · MEJORA 20 Sep 2026)
// Espejo de la plantilla V5 `notaEntradaHtml(d, negocio)`: folio · fecha · proveedor ·
// capturó · notas · tabla (clasificación/cantidad/costo/total) · total · firmas.
//
// ⭐ MEJORA 27 Sep 2026 — ES EL RESPALDO EN CÓDIGO DEL CARRIL DE PLANTILLAS.
// `DocumentoImprimible` lo pinta cuando el tipo `nota_entrada` NO tiene plantilla
// activa en la BD; si el usuario activa la suya, se imprime la plantilla. Por eso
// recibe `datos` con el MISMO vocabulario que la plantilla (lo arma
// `datos-nota-entrada.ts`): los dos caminos imprimen lo mismo.
//
// ⭐ ENCABEZA LA MARCA, NO LA RAZÓN SOCIAL. El papel de operación lo firma la marca
// visible —TENOCHTITLÁN · IMPERIO TECNOLÓGICO—; la razón social (TECH COMPUTER) es
// de los documentos fiscales. Ver `DOCS/EMPRESA/03_MARCA.md` §1 «Arquitectura de
// marca»: TECH COMPUTER = matriz/facturación · TENOCHTITLÁN = marca visible al
// público. Por eso imprime `nombre_comercial`; `razon_social` es el último recurso,
// para no dejar el encabezado vacío.
//
// ⭐ YA NO FORMATEA NI CALCULA. Los importes y la fecha llegan formateados en `datos`:
// el motor de plantillas tampoco formatea, y dos caminos que formatean distinto se
// desincronizan. Y ya no lleva el membrete hardcodeado («TENOCHTITLÁN — IMPERIO
// TECNOLÓGICO»): sale de `empresa_emisora` y viaja dentro de `datos`.
//
// Presentacional: no llama Server Actions; recibe todo resuelto.
// ═══════════════════════════════════════════════════════════════════════════════

import type { VariablesDocumento } from '@/lib/plantillas/motor'

interface NotaEntradaImprimibleProps {
    /** El vocabulario del papel, ya formateado (`datos-nota-entrada.ts` + membrete). */
    datos: VariablesDocumento
}

/** Un valor del vocabulario como texto. Acá tampoco se calcula: la plantilla pinta. */
function texto(valor: unknown): string {
    if (valor === null || valor === undefined) return ''
    return String(valor)
}

export function NotaEntradaImprimible({ datos }: NotaEntradaImprimibleProps) {
    const partidas = Array.isArray(datos.partidas) ? datos.partidas : []
    const logo = texto(datos.logo_url)

    return (
        <div className="text-sm text-black">
            {/* El membrete sale de `empresa_emisora` (P7 de la Guía 2.1). Un logo vacío
                NO se pinta: `<img src="">` apunta a la propia página y la recarga. */}
            {logo ? (
                // ⚠️ `<img>` a propósito, no `next/image`: es un elemento del PAPEL, que
                //    html2canvas rasteriza. El optimizador exige `height` —que distorsionaría
                //    un logo de proporción desconocida— y una allowlist de dominios en
                //    `next.config`; el logo lo elige el usuario y puede venir de cualquier host.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={texto(datos.nombre_comercial)} width={140} className="mb-1" />
            ) : null}
            <div className="text-center text-lg font-bold">
                {texto(datos.nombre_comercial) || texto(datos.razon_social)}
            </div>
            <div className="text-center text-sm font-semibold">Nota de entrada de mercancía</div>

            <div className="mt-3 text-[13px] font-bold">
                FOLIO: {texto(datos.folio)} &nbsp;&nbsp; FECHA: {texto(datos.fecha)}
            </div>
            <div className="text-[13px] font-bold">
                PROVEEDOR: {texto(datos.proveedor) || '—'}
                {texto(datos.capturo) ? ` &nbsp;&nbsp; CAPTURÓ: ${texto(datos.capturo)}` : ''}
            </div>
            {texto(datos.notas) ? (
                <div className="text-[13px] font-bold">NOTAS: {texto(datos.notas)}</div>
            ) : null}

            <table className="mt-3 w-full border-collapse">
                <thead>
                    <tr>
                        <th className="border border-black px-2 py-1 text-left">#</th>
                        <th className="border border-black px-2 py-1 text-left">Clasificación</th>
                        <th className="border border-black px-2 py-1 text-right">Cantidad</th>
                        <th className="border border-black px-2 py-1 text-right">Costo</th>
                        <th className="border border-black px-2 py-1 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {partidas.map((p, i) => (
                        <tr key={`${texto(p.partida)}-${i}`}>
                            <td className="border border-black px-2 py-1 tabular-nums">
                                {texto(p.partida)}
                            </td>
                            <td className="border border-black px-2 py-1">
                                {texto(p.clasificacion) || '—'}
                            </td>
                            <td className="border border-black px-2 py-1 text-right tabular-nums">
                                {texto(p.cantidad)}
                            </td>
                            <td className="border border-black px-2 py-1 text-right tabular-nums">
                                {texto(p.costo)}
                            </td>
                            <td className="border border-black px-2 py-1 text-right tabular-nums">
                                {texto(p.total_linea)}
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={4} className="border border-black px-2 py-1 text-right font-bold">
                            TOTAL
                        </td>
                        <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                            {texto(datos.total)}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="mt-10 text-[13px]">
                ENTREGÓ: ____________________________________ &nbsp;&nbsp; RECIBIÓ:
                ____________________________________
            </div>
        </div>
    )
}
