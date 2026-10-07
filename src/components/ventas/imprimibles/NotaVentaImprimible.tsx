'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA DE VENTA IMPRIMIBLE — el RESPALDO del papel `nota_venta` (Guía 1.8)
//
// ⭐ Sin respaldo, la plantilla es PUNTO ÚNICO DE FALLA: desactivarla borra el
//    documento. `nota_compra` fue el caso vivo (imprimía «Este documento todavía no
//    tiene plantilla» hasta el 29 Sep 2026) — y es justo el punto de partida de
//    `nota_venta`, que nace SIN consumidor.
// ⭐ Recibe `datos` (el MISMO vocabulario que la plantilla), no las entidades del
//    dominio: si decidiera él cómo se formatea un importe, el mismo dato podría salir
//    distinto en la pantalla y en el papel.
// ⭐ Recibe el MEMBRETE (punto 2 de los 7): el punto de invocación le pasa el mismo
//    alcance que a la plantilla.
// ⚠️ El logo vacío NO se pinta: un `src=""` apunta a la propia página y la recarga.
// ═══════════════════════════════════════════════════════════════════════════════

import type { VariablesDocumento } from '@/lib/plantillas/motor'

/**
 * ⭐ CONTRATO MEDIDO: `PlantillaFallback = ComponentType<{ datos: VariablesDocumento }>`
 * (`registro.ts:28`) — el respaldo recibe **SOLO `datos`**, y **el membrete viene
 * DENTRO de `datos`**: el punto de invocación lo resuelve de `empresa_emisora` y lo
 * **mezcla** antes de pintar (por eso su prop dice «`datos` gana sobre todo»).
 * ⇒ Así se cumple el **punto 2 de los 7**: la plantilla y el respaldo ven
 *   **el MISMO objeto** — no hay dos alcances que puedan divergir.
 */
export interface NotaVentaImprimibleProps {
    datos: VariablesDocumento
}

/** Lee una clave del vocabulario sin romper el tipo. */
function texto(datos: VariablesDocumento, clave: string): string {
    const v = datos[clave]
    return typeof v === 'string' ? v : v == null ? '' : String(v)
}

export function NotaVentaImprimible({ datos }: NotaVentaImprimibleProps) {
    const partidas = (datos.partidas ?? []) as Record<string, unknown>[]
    const cancelada = Boolean(datos.cancelada)

    return (
        <div className="flex flex-col gap-4 p-6 text-[13px]">
            {/* ── El membrete: ⭐ viene DENTRO de `datos` (lo mezcló el punto de
                   invocación desde `empresa_emisora`) — marca visible en papel de operación ── */}
            <header className="flex items-start justify-between gap-4 border-b border-border pb-3">
                <div className="flex items-center gap-3">
                    {/* ⭐ El logo vacío NO se pinta */}
                    {texto(datos, 'logo_url') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={texto(datos, 'logo_url')} alt="" className="h-12 w-auto" />
                    ) : null}
                    <div className="flex flex-col">
                        <span className="text-[15px] font-bold">
                            {texto(datos, 'nombre_comercial')}
                        </span>
                        {texto(datos, 'rfc') && (
                            <span className="font-mono text-[11px]">{texto(datos, 'rfc')}</span>
                        )}
                        {texto(datos, 'direccion') && (
                            <span className="text-[11px] text-muted-foreground">
                                {texto(datos, 'direccion')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="font-mono text-[15px] font-bold">{texto(datos, 'folio')}</span>
                    <span className="text-[11px] text-muted-foreground">
                        {texto(datos, 'fecha')}
                    </span>
                    {cancelada && (
                        <span className="mt-1 font-bold text-destructive">CANCELADA</span>
                    )}
                </div>
            </header>

            {/* ── El cliente y la condición ───────────────────────────────────── */}
            <section className="grid grid-cols-2 gap-x-6 gap-y-1">
                <span>
                    <b>Cliente:</b> {texto(datos, 'cliente')}
                    {texto(datos, 'cliente_codigo') ? ` (${texto(datos, 'cliente_codigo')})` : ''}
                </span>
                <span>
                    <b>Vence:</b> {texto(datos, 'vencimiento')}
                </span>
                <span>
                    <b>Condición:</b> {texto(datos, 'condicion')}
                </span>
                <span>
                    <b>Estado:</b> {texto(datos, 'estado_pago')}
                </span>
                {texto(datos, 'vendedor') && (
                    <span>
                        <b>Vendedor:</b> {texto(datos, 'vendedor')}
                    </span>
                )}
            </section>

            {/* ── Las partidas ────────────────────────────────────────────────── */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-border text-left">
                        <th className="py-1 pr-2">#</th>
                        <th className="py-1 pr-2">Producto</th>
                        <th className="py-1 pr-2 text-right">Cant.</th>
                        <th className="py-1 pr-2 text-right">Precio</th>
                        <th className="py-1 text-right">Importe</th>
                    </tr>
                </thead>
                <tbody>
                    {partidas.map((p, i) => (
                        <tr key={i} className="border-b border-border/60">
                            <td className="py-1 pr-2 tabular-nums">{String(p.orden ?? i + 1)}</td>
                            <td className="py-1 pr-2">
                                {String(p.descripcion ?? '')}
                                {p.cortesia ? ' (cortesía)' : ''}
                                {p.series ? (
                                    <span className="block font-mono text-[10px] text-muted-foreground">
                                        {String(p.series)}
                                    </span>
                                ) : null}
                            </td>
                            <td className="py-1 pr-2 text-right tabular-nums">
                                {String(p.cantidad ?? '')}
                            </td>
                            <td className="py-1 pr-2 text-right tabular-nums">
                                {String(p.precio ?? '')}
                            </td>
                            <td className="py-1 text-right tabular-nums">{String(p.importe ?? '')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ── Los totales (ya formateados por el vocabulario) ─────────────── */}
            <section className="ml-auto flex w-56 flex-col gap-0.5">
                <span className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{texto(datos, 'subtotal')}</span>
                </span>
                <span className="flex justify-between">
                    <span>Descuento</span>
                    <span className="tabular-nums">{texto(datos, 'descuento_global')}</span>
                </span>
                <span className="flex justify-between">
                    <span>Impuestos</span>
                    <span className="tabular-nums">{texto(datos, 'impuestos')}</span>
                </span>
                <span className="flex justify-between border-t border-border pt-1 font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{texto(datos, 'total')}</span>
                </span>
                <span className="flex justify-between">
                    <span>Saldo</span>
                    <span className="tabular-nums">{texto(datos, 'saldo')}</span>
                </span>
            </section>

            {texto(datos, 'notas') && (
                <p className="text-[11.5px] text-muted-foreground">{texto(datos, 'notas')}</p>
            )}
            {cancelada && texto(datos, 'motivo_cancelacion') && (
                <p className="text-[11.5px] text-destructive">
                    Motivo de la cancelación: {texto(datos, 'motivo_cancelacion')}
                </p>
            )}
        </div>
    )
}
