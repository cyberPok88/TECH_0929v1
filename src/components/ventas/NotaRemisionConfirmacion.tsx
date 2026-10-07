'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA REMISION — PANTALLA 02 · CONFIRMAR LA EMISIÓN (Guía 1.8 · rediseño 05 Oct 2026)
//
// ⭐ QUÉ ES: la SEGUNDA y ÚLTIMA pantalla del acto. Existe por una razón concreta:
//    **emitir es irreversible y mueve el mundo** (inventario + cuenta por cobrar + NS),
//    así que hay que decirlo ANTES, con cifras, y no después.
//
// ⚠️ **NO CAPTURA NADA.** Si empieza a pedir campos, dejó de ser una confirmación y se
//    convirtió en un paso más — que es exactamente lo que el rediseño vino a quitar.
//    (La casa tiene el precedente: `NotaCompraModal` no confirma; 1.8 sí, por el papel
//    con valor y por los asientos que abre.)
//
// ⭐ ES DUMB: recibe TODO por props y avisa con callbacks. No consulta, no calcula
//    importes, no conoce el borrador. El modal es el dueño del estado.
//
// 📌 ZONAS (para ubicarlas al modificar — en la vista final NO se ven):
//    Z1 Resumen · Z2 Qué va a pasar · Z3 Excepciones y riesgos · Z4 Verificación · Z5 Pie
// ═══════════════════════════════════════════════════════════════════════════════

import { TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Ayuda } from '@/components/ui/Ayuda'
import { formatearMoneda } from '@/lib/utils/formatters'
import { formatearFecha } from '@/components/ventas/columnas-venta'

interface NotaRemisionConfirmacionProps {
    /** Z1 · resumen — todo lo que se va a escribir. */
    clienteNombre: string
    esCredito: boolean
    /** ⭐ El plazo de crédito del cliente (ANEXIÓN 05 Oct): da el «· plazo N días». */
    diasCredito: number | null
    fechaEmision: string
    renglones: number
    piezas: number
    /** ⭐ 3er nivel: el descuento del DOCUMENTO (en % y ya convertido a monto). */
    subtotal: number
    descuentoPorcentaje: number
    descuentoMonto: number
    total: number
    nsAmarrados: number
    /** Z3 · lo excepcional, ya contado por el modal (él es quien tiene los pisos y los lotes). */
    renglonesBajoPiso: number
    cortesias: number
    /**
     * ⭐ ANEXIÓN 05 Oct: renglones **sin lote con disponible** ⇒ la emisión **va a fallar**
     * (FIFO sobre `lotes`). Se dice ANTES, no después.
     */
    renglonesSinLote: number
    /** Z5 · acciones. */
    onVolver: () => void
    onConfirmar: () => void
    emitiendo: boolean
}

export function NotaRemisionConfirmacion({
    clienteNombre,
    esCredito,
    diasCredito,
    fechaEmision,
    renglones,
    piezas,
    subtotal,
    descuentoPorcentaje,
    descuentoMonto,
    total,
    nsAmarrados,
    renglonesBajoPiso,
    cortesias,
    renglonesSinLote,
    onVolver,
    onConfirmar,
    emitiendo,
}: NotaRemisionConfirmacionProps) {
    const hayExcepciones = renglonesBajoPiso > 0 || cortesias > 0

    return (
        <div className="flex flex-col gap-4">
            {/* ═══ ZONA 1 · RESUMEN ═══════════════════════════════════════════
                Las cifras de lo que se va a escribir. El total es el MISMO de la Zona 4
                de la captura: una sola definición de «cuánto es esta nota». */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <Dato etiqueta="Cliente" valor={clienteNombre} />
                <Dato
                    etiqueta="Condición"
                    valor={
                        esCredito
                            ? `Crédito${diasCredito != null ? ` · plazo ${diasCredito} días` : ''}`
                            : 'Contado'
                    }
                />
                <Dato etiqueta="Emisión" valor={formatearFecha(fechaEmision)} mono />
                <Dato etiqueta="Renglones · piezas" valor={`${renglones} · ${piezas}`} mono />
                <Dato etiqueta="NS amarrados" valor={String(nsAmarrados)} mono />
                {/* ⭐ 3er NIVEL — el descuento del documento, desglosado. Solo aparece si hay:
                    un «−0%» no informa, estorba. */}
                {descuentoMonto > 0 && (
                    <>
                        <Dato etiqueta="Subtotal" valor={formatearMoneda(subtotal)} mono />
                        <Dato
                            etiqueta={`Desc. documento ${descuentoPorcentaje}%`}
                            valor={`− ${formatearMoneda(descuentoMonto)}`}
                            mono
                        />
                    </>
                )}
                <div className="flex flex-col gap-1 sm:col-span-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
                        Vencimiento
                    </span>
                    <span className="text-[13px] font-semibold">
                        {esCredito ? 'Se calcula al emitir' : formatearFecha(fechaEmision)}
                    </span>
                    <Ayuda
                        k="ventas.plazo-derivado"
                        className="text-[11px] leading-snug text-muted-foreground"
                    />
                </div>
                <div className="flex flex-row items-baseline gap-3 rounded-md border border-primary/45 px-3 py-2.5 sm:col-span-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
                        Total de la nota
                    </span>
                    <span className="font-display text-2xl font-extrabold tabular-nums">
                        {formatearMoneda(total)}
                    </span>
                </div>
            </div>

            {/* ═══ ZONA 2 · QUÉ VA A PASAR ════════════════════════════════════
                ⭐ Es el CORAZÓN de esta pantalla: los efectos, ANTES de confirmar. */}
            <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                    Qué va a pasar cuando confirmes
                </span>
                <ol className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
                    <Paso n={1} titulo="Se descuenta del inventario (stock y lote)." />
                    <Paso
                        n={2}
                        titulo={`Se abre la cuenta por cobrar del cliente por ${formatearMoneda(total)}.`}
                    />
                    <Paso n={3} titulo="Los números de serie quedan amarrados a esta nota." />
                </ol>
            </div>

            {/* ═══ ZONA 3 · EXCEPCIONES Y RIESGOS ═════════════════════════════
                Solo aparece si hay algo que nombrar. Lo cuenta el MODAL (él tiene los pisos). */}
            {hayExcepciones && (
                <div className="flex items-start gap-2.5 rounded-md border border-warning/45 bg-warning/10 px-3 py-2.5 text-[13px]">
                    <TriangleAlert className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
                    <div>
                        <b className="font-semibold">Lo que va a pedir excepción al emitir</b>
                        <ul className="mt-1 list-inside list-disc text-[12.5px] text-muted-foreground">
                            {renglonesBajoPiso > 0 && (
                                <li>
                                    <b>{renglonesBajoPiso}</b>{' '}
                                    {renglonesBajoPiso === 1 ? 'renglón' : 'renglones'} por debajo del
                                    precio mínimo.
                                </li>
                            )}
                            {cortesias > 0 && (
                                <li>
                                    <b>{cortesias}</b> {cortesias === 1 ? 'cortesía' : 'cortesías'} a $0.
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            )}

            {/* ═══ ZONA 3b · LO QUE PUEDE HACER FALLAR ═════════════════════════
                ⭐ ANEXIÓN 05 Oct: el FIFO surte de `lotes` ⇒ sin lote disponible la emisión
                FALLA. Decirlo acá evita capturar una nota condenada. */}
            {renglonesSinLote > 0 && (
                <div className="flex items-start gap-2.5 rounded-md border border-destructive/45 bg-destructive/10 px-3 py-2.5 text-[13px]">
                    <TriangleAlert className="mt-0.5 h-4 w-4 flex-none text-destructive" aria-hidden="true" />
                    <div>
                        <b className="font-semibold">Y algo que puede hacer fallar la emisión</b>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                            <b className="text-foreground">{renglonesSinLote}</b>{' '}
                            {renglonesSinLote === 1 ? 'renglón no tiene' : 'renglones no tienen'}{' '}
                            lote con disponible. Si el stock no alcanza,{' '}
                            <b className="text-foreground">la emisión no pasa</b> — y no queda nada
                            escrito.
                        </p>
                    </div>
                </div>
            )}

            {/* ═══ ZONA 4 · VERIFICACIÓN ══════════════════════════════════════
                ⚠️ Dice lo que el SERVIDOR va a validar — no afirma un saldo que el modal
                no conoce (el cliente con adeudo se descubre al emitir, y ahí se pide la
                confirmación de excepción: diálogo 04). */}
            <p className="rounded-md border border-border/60 bg-surface/40 px-3 py-2 text-[12.5px] text-muted-foreground">
                Al emitir se validan <b className="text-foreground">las tres puertas de crédito</b>{' '}
                (suspendido · moroso · límite) y <b className="text-foreground">el piso de precio</b>.
                Si algo bloquea, se pide una confirmación y <b className="text-foreground">no se pierde
                nada de lo capturado</b>.
            </p>

            {/* ═══ ZONA 5 · PIE: ACCIONES ═════════════════════════════════════
                Una sola acción dominante. El escape mantiene su palabra: «Volver a la
                captura» no destruye trabajo. */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button type="button" variant="outline" onClick={onVolver} disabled={emitiendo}>
                    ← Volver a la captura
                </Button>
                <Ayuda
                    k="ventas.acto-atomico"
                    className="text-[12px] text-muted-foreground"
                />
                <Button
                    type="button"
                    className="ml-auto"
                    onClick={onConfirmar}
                    disabled={emitiendo}
                >
                    {emitiendo ? 'Emitiendo…' : 'Emitir nota'}
                </Button>
            </div>
        </div>
    )
}

/** Una celda del resumen: etiqueta mono + valor. */
function Dato({
    etiqueta,
    valor,
    mono = false,
}: {
    etiqueta: string
    valor: string
    mono?: boolean
}) {
    return (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
                {etiqueta}
            </span>
            <span className={`text-[13px] font-semibold${mono ? ' font-mono tabular-nums' : ''}`}>
                {valor}
            </span>
        </div>
    )
}

/** Un efecto de la emisión, numerado. */
function Paso({ n, titulo }: { n: number; titulo: string }) {
    return (
        <li className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">
                {n}
            </span>
            <span className="text-[13px]">{titulo}</span>
        </li>
    )
}
