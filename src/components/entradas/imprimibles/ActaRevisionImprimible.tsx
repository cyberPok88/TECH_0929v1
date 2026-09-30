'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ACTA DE REVISIÓN IMPRIMIBLE — el papel que se firma (Guía 1.6 · MEJORA 34)
//
// ⭐ Pedido (usuario, 25 Sep 2026): *«agregar el botón de ver resultado … y otro de imprimir
// revisión»* + *«las plantillas se usarán mucho, cada etapa tendrá su plantilla para imprimir»*.
//
// ⭐ MEJORA 41 (29 Sep 2026) — ES EL RESPALDO EN CÓDIGO DEL CARRIL DE PLANTILLAS.
// `DocumentoImprimible` lo pinta cuando el tipo `acta_revision` NO tiene plantilla activa en
// la base; si el usuario activa la suya, se imprime la plantilla. Por eso recibe **`datos`**
// —el vocabulario que arma `datos-acta-revision.ts`— y **ya no** las entidades del dominio:
// los dos caminos imprimen lo mismo.
//
// ⭐ YA NO FORMATEA NI CALCULA: las fechas, los totales y el `—` de cada celda llegan
// resueltos (el motor de plantillas tampoco formatea — ley L6). Y **ya no lleva el membrete
// hardcodeado** («TENOCHTITLÁN — IMPERIO TECNOLÓGICO»): sale de `empresa_emisora` y viaja
// dentro de `datos`.
//
// ⚠️ Sigue en pie el hueco DECLARADO (no inventado): la BD **no guarda quién revisó** —la
// entrada tiene `creado_por`, no `reviso_por`; el actor vive en `transiciones_etapa`—, así que
// el acta imprime la **línea para firmar** en vez de un nombre que no existe.
//
// Presentacional: no llama Server Actions; recibe todo resuelto.
// ═══════════════════════════════════════════════════════════════════════════════

import type { VariablesDocumento } from '@/lib/plantillas/motor'

interface ActaRevisionImprimibleProps {
    /** El vocabulario del papel, ya formateado (`datos-acta-revision.ts` + el membrete). */
    datos: VariablesDocumento
}

/** Un valor del vocabulario como texto. Acá tampoco se calcula: la plantilla pinta. */
function texto(valor: unknown): string {
    if (valor === null || valor === undefined) return ''
    return String(valor)
}

/** La bandera de fila: `true` en el dato (o `'true'` si el valor viajó como texto). */
function esVerdadero(valor: unknown): boolean {
    return valor === true || valor === 'true'
}

export function ActaRevisionImprimible({ datos }: ActaRevisionImprimibleProps) {
    const lineas = Array.isArray(datos.lineas) ? datos.lineas : []
    const logo = texto(datos.logo_url)

    return (
        <div className="text-sm text-black">
            {/* El membrete sale de `empresa_emisora` (P7 de la Guía 2.1). Un logo vacío NO se
                pinta: `<img src="">` apunta a la propia página y la recarga. */}
            {logo ? (
                // ⚠️ `<img>` a propósito (no `next/image`): es un elemento del PAPEL, que
                //    html2canvas rasteriza. El optimizador exige `height` —y distorsionaría
                //    un logo de proporción desconocida— y una allowlist de dominios.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={texto(datos.nombre_comercial)} width={140} className="mb-1" />
            ) : null}
            <div className="text-center text-lg font-bold">
                {texto(datos.nombre_comercial) || texto(datos.razon_social)}
            </div>
            <div className="text-center text-sm font-semibold">
                Acta de revisión técnica de mercancía
            </div>

            <div className="mt-3 text-[13px] font-bold">
                FOLIO: {texto(datos.folio)} &nbsp;&nbsp; RECEPCIÓN: {texto(datos.fecha_recepcion)}{' '}
                &nbsp;&nbsp; FIN DE REVISIÓN: {texto(datos.fecha_fin_revision)}
            </div>
            <div className="text-[13px] font-bold">
                PROVEEDOR: {texto(datos.proveedor) || '—'}
                {texto(datos.capturo) ? ` &nbsp;&nbsp; CAPTURÓ: ${texto(datos.capturo)}` : ''}
            </div>

            <table className="mt-3 w-full border-collapse">
                <thead>
                    <tr>
                        <th className="border border-black px-2 py-1 text-left">Partida / producto</th>
                        <th className="border border-black px-2 py-1 text-right">Recibidas</th>
                        <th className="border border-black px-2 py-1 text-right">Aprobadas</th>
                        <th className="border border-black px-2 py-1 text-right">DEV</th>
                    </tr>
                </thead>
                <tbody>
                    {lineas.map((l, i) =>
                        esVerdadero(l.es_partida) ? (
                            <tr key={`p-${i}`} className="bg-black/5">
                                <td className="border border-black px-2 py-1 font-bold">
                                    {texto(l.etiqueta)}
                                </td>
                                <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                                    {texto(l.recibidas)}
                                </td>
                                <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                                    {texto(l.aprobadas)}
                                </td>
                                <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                                    {texto(l.dev)}
                                </td>
                            </tr>
                        ) : (
                            <tr key={`l-${i}`}>
                                <td className="border border-black px-2 py-1 pl-6">
                                    {texto(l.etiqueta)}
                                </td>
                                <td className="border border-black px-2 py-1 text-right tabular-nums">
                                    {texto(l.recibidas)}
                                </td>
                                <td className="border border-black px-2 py-1 text-right tabular-nums">
                                    {texto(l.aprobadas)}
                                </td>
                                <td className="border border-black px-2 py-1 text-right tabular-nums">
                                    {texto(l.dev)}
                                </td>
                            </tr>
                        )
                    )}
                    <tr>
                        <td className="border border-black px-2 py-1 text-right font-bold">
                            TOTAL · {texto(datos.piezas_total)} pza ·{' '}
                            {texto(datos.piezas_aprobadas)} aprobadas · DEV {texto(datos.total_dev)}
                        </td>
                        <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                            {texto(datos.piezas_total)}
                        </td>
                        <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                            {texto(datos.piezas_aprobadas)}
                        </td>
                        <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                            {texto(datos.total_dev)}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="mt-3 text-[12px]">
                Resultado de la revisión: <b>{texto(datos.resultado)}</b>
                &nbsp;&nbsp;·&nbsp;&nbsp; Estado del documento: <b>{texto(datos.estado)}</b>
            </div>

            <div className="mt-10 text-[13px]">
                REVISÓ: ____________________________________ &nbsp;&nbsp; RECIBIÓ:
                ____________________________________
            </div>
        </div>
    )
}
