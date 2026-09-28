'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ACTA DE REVISIÓN IMPRIMIBLE — el papel que se firma (Guía 1.6 · MEJORA 34)
//
// ⭐ Pedido (usuario, 25 Sep 2026): *«agregar el botón de ver resultado … y otro de imprimir
// revisión»* + *«las plantillas se usarán mucho, cada etapa tendrá su plantilla para imprimir»*.
// Es el **segundo** documento del ERP y el primero que nace en `imprimibles/`: la carpeta y el
// registro `{tipo → plantilla}` son el primer tramo del sistema de impresión, cuyo alcance está en
// `DOCS/SISTEMA_IMPRESION.md`. Este archivo es la **plantilla**; el motor y el contenedor son los
// que ya existen (`lib/pdf/generador.ts` + `DocumentoImprimibleDialog`).
//
// Qué imprime: **el acta de la revisión de la ENTRADA** — cada partida declarada, los productos
// (huellas) que la revisión encontró, lo aprobado, lo devuelto y los totales — para firmar. No
// repite lo que la pantalla ya dice: en papel lo que sirve es **qué se revisó, qué salió y quién
// responde**.
//
// ⚠️ Dos huecos DECLARADOS, no inventados (van al carril de plantillas):
//   (a) el membrete está **hardcodeado** igual que `NotaEntradaImprimible` — el dato bueno vive en
//       `empresa_emisora` (fila única) y debe salir de ahí cuando la plantilla sea dato;
//   (b) la BD **no guarda quién revisó** (la entrada tiene `creado_por`, no `reviso_por`; el actor
//       está en `transiciones_etapa`): por eso el acta **imprime la línea para firmar** en vez de un
//       nombre que no existe.
//
// Presentacional: no llama Server Actions. Recibe `entrada` + `partidas` ya resueltas y usa
// `lineasDePartidas()` —la MISMA fuente que el desglose de pantalla— para que el papel y la
// pantalla no puedan decir cosas distintas (L6).
// ═══════════════════════════════════════════════════════════════════════════════

import { lineasDePartidas, productoDeLinea } from '@/components/entradas/columnas-entrada'
import type { Entrada, PartidaConAvance } from '@/types/entradas'

function formatearFecha(fecha: string | null): string {
    if (!fecha) return '—'
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface ActaRevisionImprimibleProps {
    entrada: Entrada
    partidas: PartidaConAvance[]
}

export function ActaRevisionImprimible({ entrada, partidas }: ActaRevisionImprimibleProps) {
    const lineas = lineasDePartidas(partidas)
    const totalDev = partidas.reduce((s, p) => s + Number(p.dev_cantidad ?? 0), 0)

    return (
        <div className="text-sm text-black">
            <div className="text-center text-lg font-bold">TENOCHTITLÁN — IMPERIO TECNOLÓGICO</div>
            <div className="text-center text-sm font-semibold">Acta de revisión técnica de mercancía</div>

            <div className="mt-3 text-[13px] font-bold">
                FOLIO: {entrada.folio} &nbsp;&nbsp; RECEPCIÓN: {formatearFecha(entrada.fecha)}{' '}
                &nbsp;&nbsp; FIN DE REVISIÓN: {formatearFecha(entrada.fecha_fin_rev)}
            </div>
            <div className="text-[13px] font-bold">
                PROVEEDOR: {entrada.proveedor_nombre ?? '—'}
                {entrada.creador_nombre ? ` &nbsp;&nbsp; CAPTURÓ: ${entrada.creador_nombre}` : ''}
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
                    {lineas.map((l) =>
                        l.esPartida ? (
                            <tr key={l.key} className="bg-black/5">
                                <td className="border border-black px-2 py-1 font-bold">
                                    PARTIDA {l.partida.partida} · {productoDeLinea(l)}
                                </td>
                                <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                                    {l.recibidas}
                                </td>
                                <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                                    {l.partida.aprobadas}
                                </td>
                                <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                                    {l.partida.dev_cantidad > 0 ? l.partida.dev_cantidad : '—'}
                                </td>
                            </tr>
                        ) : (
                            <tr key={l.key}>
                                <td className="border border-black px-2 py-1 pl-6">
                                    {productoDeLinea(l)}
                                </td>
                                <td className="border border-black px-2 py-1 text-right tabular-nums">
                                    {l.recibidas}
                                </td>
                                <td className="border border-black px-2 py-1 text-right tabular-nums">
                                    {l.declarada ? '—' : l.aprobadas}
                                </td>
                                <td className="border border-black px-2 py-1 text-right tabular-nums">
                                    {l.dev > 0 ? l.dev : '—'}
                                </td>
                            </tr>
                        )
                    )}
                    <tr>
                        <td className="border border-black px-2 py-1 text-right font-bold">
                            TOTAL · {entrada.piezas_total} pza · {entrada.piezas_aprobadas} aprobadas ·
                            DEV {totalDev}
                        </td>
                        <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                            {entrada.piezas_total}
                        </td>
                        <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                            {entrada.piezas_aprobadas}
                        </td>
                        <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                            {totalDev}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="mt-3 text-[12px]">
                Resultado de la revisión: <b>{entrada.resultado_rev === 'CON_MALAS' ? 'CON MALAS' : 'SIN MALAS'}</b>
                &nbsp;&nbsp;·&nbsp;&nbsp; Estado del documento: <b>{entrada.estado}</b>
            </div>

            <div className="mt-10 text-[13px]">
                REVISÓ: ____________________________________ &nbsp;&nbsp; RECIBIÓ:
                ____________________________________
            </div>
        </div>
    )
}
