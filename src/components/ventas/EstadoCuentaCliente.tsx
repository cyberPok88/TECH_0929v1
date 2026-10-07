'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADO DE CUENTA DEL CLIENTE — los asientos del LIBRO (Guía 1.8 · Parte 4)
// ⭐ Es el pago visual de la decisión D4: el saldo no es un campo, es una HISTORIA.
// Dumb: recibe los movimientos y los pinta. NO calcula saldos — `saldo_resultante`
// lo escribió la BD al asentar (R27), con su CHECK de coherencia.
// ⚠️ `border-collapse`: con el default `separate` los bordes de un `<tr>` NO se pintan
//    y las filas se leen como una masa (lo documentó 1.6 en su desglose).
// ⭐ 1.9 Cobranza debe REUSAR este componente (la tableta del cobrador), no escribir
//    una segunda tabla de movimientos: sería una segunda verdad sobre la misma deuda.
// ═══════════════════════════════════════════════════════════════════════════════

import { CLASE_CAJA_TABLA, CLASE_THEAD_TABLA, CLASE_TH_TABLA, Pildora } from '@/components/data-table'
import { cn } from '@/lib/utils'
import { formatearMoneda } from '@/lib/utils/formatters'
import type { EstadoCuentaCliente as EstadoCuenta } from '@/types/ventas'

const TH = cn(CLASE_TH_TABLA, 'px-2.5 py-1.5')

/** La fecha del asiento, con hora: dos movimientos del mismo día deben poder ordenarse. */
function formatearFechaHora(iso: string): string {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d)
}

export function EstadoCuentaCliente({ estado }: { estado: EstadoCuenta }) {
    const vencido = estado.saldo_vencido > 0

    return (
        <div className="flex flex-col gap-3">
            {/* ── El resumen: lo que debe y lo que está vencido ───────────────── */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border bg-surface-raised px-3 py-2.5">
                <span className="text-[12.5px] text-muted-foreground">
                    Saldo vigente{' '}
                    <b className="tabular-nums text-foreground">{formatearMoneda(estado.saldo_actual)}</b>
                </span>
                {/* ⚠️ El vencido SOLO se pinta si existe: un «$0.00 vencido» en rojo es ruido */}
                {vencido && (
                    <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                        Vencido{' '}
                        <b className="tabular-nums text-destructive">
                            {formatearMoneda(estado.saldo_vencido)}
                        </b>
                        <Pildora texto="Moroso" tono="peligro" />
                    </span>
                )}
                <span className="ml-auto font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {estado.total_movimientos}{' '}
                    {estado.total_movimientos === 1 ? 'movimiento' : 'movimientos'}
                </span>
            </div>

            {/* ── Los asientos ─────────────────────────────────────────────────── */}
            {estado.movimientos.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    Este cliente no tiene movimientos en su cuenta.
                </p>
            ) : (
                <div className={CLASE_CAJA_TABLA}>
                    <table className="w-full border-collapse text-[14px]">
                        <thead className={CLASE_THEAD_TABLA}>
                            <tr>
                                <th className={cn(TH, 'w-36')}>Fecha</th>
                                <th className={cn(TH, 'w-28')} title="Folio del asiento en el libro (D-20)">
                                    Asiento
                                </th>
                                <th className={cn(TH, 'text-left')}>Concepto</th>
                                <th className={cn(TH, 'text-left')} title="La nota o el cobro que lo originó">
                                    Origen
                                </th>
                                <th className={cn(TH, 'w-28')}>Importe</th>
                                <th className={cn(TH, 'w-32')} title="El saldo DESPUÉS de este asiento (R27)">
                                    Saldo
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {estado.movimientos.map((m) => {
                                const esCargo = m.naturaleza === 'cargo'
                                return (
                                    <tr key={m.id} className="border-t border-border">
                                        <td className="px-2.5 py-2 tabular-nums text-muted-foreground">
                                            {formatearFechaHora(m.created_at)}
                                        </td>
                                        <td className="px-2.5 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                                            {m.folio}
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <span className="flex flex-wrap items-center gap-1.5">
                                                {m.concepto_nombre ?? m.concepto_clave ?? '—'}
                                                {/* ⭐ Un ajuste se distingue: no es venta ni cobro */}
                                                {m.concepto_clave?.startsWith('ajuste') && (
                                                    <Pildora texto="Ajuste" tono="advertencia" />
                                                )}
                                            </span>
                                            {m.motivo && (
                                                <span className="block text-[11.5px] text-muted-foreground">
                                                    {m.motivo}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                                            {m.nota_folio ?? '—'}
                                        </td>
                                        <td
                                            className={cn(
                                                'px-2.5 py-2 text-right tabular-nums',
                                                // El signo lo dice la NATURALEZA (R31); el color acompaña,
                                                // no compite: un cargo NO es un error.
                                                esCargo ? 'text-foreground' : 'text-success'
                                            )}
                                        >
                                            {esCargo ? '+' : '−'}
                                            {formatearMoneda(Number(m.monto))}
                                        </td>
                                        <td className="px-2.5 py-2 text-right tabular-nums font-medium">
                                            {formatearMoneda(Number(m.saldo_resultante))}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="text-[11.5px] text-muted-foreground">
                Cada asiento es inmutable: un error se corrige con el asiento inverso, nunca editando.
            </p>
        </div>
    )
}
