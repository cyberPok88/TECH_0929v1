'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA DE ENTRADA IMPRIMIBLE — documento físico (Guía 1.6 · MEJORA 20 Sep 2026)
// Espejo de la plantilla V5 `notaEntradaHtml(d, negocio)`: folio · fecha · proveedor ·
// capturó · notas · tabla (clasificación/cantidad/costo/total) · total · firmas.
// Presentacional: no llama Server Actions; recibe `entrada` + `partidas` ya resueltas.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Entrada, PartidaEntrada } from '@/types/entradas'

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

function formatearFecha(fecha: string): string {
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface NotaEntradaImprimibleProps {
    entrada: Entrada
    partidas: PartidaEntrada[]
}

export function NotaEntradaImprimible({ entrada, partidas }: NotaEntradaImprimibleProps) {
    const total = partidas.reduce((s, p) => s + p.cantidad_original * p.costo_acordado, 0)

    return (
        <div className="text-sm text-black">
            <div className="text-center text-lg font-bold">TENOCHTITLÁN — IMPERIO TECNOLÓGICO</div>
            <div className="text-center text-sm font-semibold">Nota de entrada de mercancía</div>

            <div className="mt-3 text-[13px] font-bold">
                FOLIO: {entrada.folio} &nbsp;&nbsp; FECHA: {formatearFecha(entrada.fecha)}
            </div>
            <div className="text-[13px] font-bold">
                PROVEEDOR: {entrada.proveedor_nombre ?? '—'}
                {entrada.creador_nombre ? ` &nbsp;&nbsp; CAPTURÓ: ${entrada.creador_nombre}` : ''}
            </div>
            {entrada.notas ? <div className="text-[13px] font-bold">NOTAS: {entrada.notas}</div> : null}

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
                    {partidas.map((p) => (
                        <tr key={p.id}>
                            <td className="border border-black px-2 py-1 tabular-nums">{p.partida}</td>
                            <td className="border border-black px-2 py-1">{p.categoria_nombre ?? '—'}</td>
                            <td className="border border-black px-2 py-1 text-right tabular-nums">
                                {p.cantidad_original}
                            </td>
                            <td className="border border-black px-2 py-1 text-right tabular-nums">
                                {formatearMXN(p.costo_acordado)}
                            </td>
                            <td className="border border-black px-2 py-1 text-right tabular-nums">
                                {formatearMXN(p.cantidad_original * p.costo_acordado)}
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={4} className="border border-black px-2 py-1 text-right font-bold">
                            TOTAL
                        </td>
                        <td className="border border-black px-2 py-1 text-right font-bold tabular-nums">
                            {formatearMXN(total)}
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
