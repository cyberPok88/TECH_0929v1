'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AJUSTE DEV MODAL — la DEV de la entrada: VERLA y resolverla (Guía 1.6 · P4)
//
// Camino A: el recepcionista **ve la devolución** (de qué partida y de qué producto declarado
// se devuelve, con qué motivo y en qué estado), valida, ajusta la partida (original vs vigente)
// y genera la NOTA DE COMPRA por las aprobadas (`ajustarYGenerarNota`, transaccional).
//
// ⭐ MEJORA 22 Sep 2026 (12) — la columna «DEV» de Recepción dejó de ser un número muerto: su
// píldora es **botón** y abre ESTE modal (`crearColumnaDevolucion`). Dos puertas, una sola
// superficie: la píldora DEV (consultar) y el botón «Ajustar y generar nota» de la columna
// «Final» / del desglose (actuar). No se duplicó nada — el modal ya tenía la acción y el
// mensaje; le faltaba **decir qué se devuelve**:
//   · partida (#) + **producto declarado** = categoría + atributos de recepción (la huella)
//   · motivo · cantidad · % de salud · NS · **estado** de la DEV (por cotejar / ajustada) y su fecha
//   · y, si la entrada ya tiene nota, el botón que **abre la nota** (`NotaCompraDetalleModal`,
//     dueño 1.4 — el mismo de la MEJORA 11): «✅ Nota NC-0006 generada y ligada a la entrada» →
//     «Ver nota», sin salir de Recepción.
//
// ⚠️ Honestidad del dato: una pieza devuelta **no tiene SKU** (lo resuelve Almacén y solo para lo
// **aprobado**) y la marca que el técnico elige en el wizard se descarta al agrupar los NO_PASA por
// (partida, motivo). Por eso el «producto» aquí es la **huella declarada en recepción**, que es
// exactamente el mismo lenguaje con el que la nota describe su línea (`lineaSoftDe`).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Pildora } from '@/components/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NotaCompraDetalleModal } from '@/components/compras/NotaCompraDetalleModal'
import { formatearFechaEntrada } from '@/components/entradas/columnas-entrada'
import { ajustarYGenerarNota, listarResultadoRevision } from '@/lib/actions/entradas'
import type { Entrada, ResultadoRevision } from '@/types/entradas'
import { TEXTO_ESTADO_DEVOLUCION, TONO_ESTADO_DEVOLUCION } from '@/types/entradas'

interface AjusteDevModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
    onGuardado?: () => void
}

/** El «producto» de la DEV: la huella declarada (categoría + atributos capturados en recepción). */
function huellaDeclarada(categoria: string | null, atributos: Record<string, unknown>): string {
    const valores = Object.values(atributos ?? {})
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map(String)
    return [categoria ?? 'Sin categoría', ...valores].join(' · ')
}

export function AjusteDevModal({ open, onOpenChange, entrada, onGuardado }: AjusteDevModalProps) {
    const [resultado, setResultado] = useState<ResultadoRevision | null>(null)
    const [cargando, setCargando] = useState(false)
    /** Folio recién generado (para el mensaje de éxito). */
    const [generada, setGenerada] = useState<{ id: string; folio: string } | null>(null)
    const [verNota, setVerNota] = useState(false)

    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void listarResultadoRevision(entrada.id).then((r) => {
            if (activo && r.success) setResultado(r.data ?? null)
        })
        return () => {
            activo = false
        }
    }, [open, entrada])

    // El modal se monta con `key={entrada.id}`: al cambiar de entrada se reinicia el estado.
    const aprobadas = resultado?.aprobadas ?? []
    const devoluciones = resultado?.devoluciones ?? []
    const devTotal = devoluciones.reduce((s, d) => s + Number(d.cantidad), 0)

    /** La nota de la entrada: la recién generada, o la que ya estaba ligada (`id_nota`). */
    const notaId = generada?.id ?? entrada?.id_nota ?? null
    const notaFolio = generada?.folio ?? entrada?.nota_folio ?? null

    const enPasoDeAjuste = entrada?.estado === 'revisada_sin_dev' || entrada?.estado === 'con_dev'
    const puedeAjustar = !notaId && enPasoDeAjuste && aprobadas.length > 0

    /** Por qué el botón está apagado — se dice, no se deja al usuario adivinando.
     *  ⚠️ El ESTADO manda: una entrada `en_revision` con DEV ya registrada **no** se puede ajustar
     *  todavía (caso real ING-0007), y decir «ya se ajustó» sería mentir. */
    const motivoApagado =
        notaId || puedeAjustar
            ? null
            : ['recien_creada', 'lista_para_revision', 'en_revision'].includes(entrada?.estado ?? '')
              ? 'La revisión todavía no cierra: la devolución se ajusta y la nota se genera cuando la entrada quede revisada.'
              : entrada?.estado === 'bloqueada_por_divergencia'
                ? 'La entrada está bloqueada por una divergencia: se resuelve antes de ajustar y generar la nota.'
                : aprobadas.length === 0
                  ? 'No hay piezas aprobadas: la nota se genera con lo que sí se recibe.'
                  : null

    const ajustar = async () => {
        if (!entrada) return
        setCargando(true)
        const res = await ajustarYGenerarNota(entrada.id)
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo ajustar.')
            return
        }
        setGenerada(res.data ?? null)
        void listarResultadoRevision(entrada.id).then((r) => {
            if (r.success) setResultado(r.data ?? null)
        })
        toast.success(`Nota de compra ${res.data?.folio} generada`)
        onGuardado?.()
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Devolución · {entrada?.folio ?? 'Entrada'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* De qué entrada hablamos: proveedor · recepción · DEV acumulada. */}
                        <p className="text-sm text-muted-foreground">
                            {entrada?.proveedor_nombre ?? 'Sin proveedor'} · recibida el{' '}
                            {entrada ? formatearFechaEntrada(entrada.fecha) : '—'} ·{' '}
                            <span className="text-destructive">DEV −{devTotal || entrada?.devolucion_total || 0} pza</span>
                        </p>

                        <section>
                            <h4 className="mb-2 text-sm font-semibold">Devoluciones (se ajustan)</h4>
                            {devoluciones.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin devoluciones registradas.</p>
                            ) : (
                                <div className="rounded-md border border-border/70">
                                    <table className="w-full text-xs">
                                        <thead className="border-b border-border/70 text-muted-foreground">
                                            <tr>
                                                <th className="px-2 py-2 font-medium">Partida</th>
                                                <th className="px-2 py-2 font-medium">Producto (huella declarada)</th>
                                                <th className="px-2 py-2 font-medium">Motivo</th>
                                                <th className="px-2 py-2 font-medium">Cant.</th>
                                                <th className="px-2 py-2 font-medium">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {devoluciones.map((d) => (
                                                <tr key={d.id} className="border-t border-border/70">
                                                    <td className="px-2 py-2 text-center font-mono tabular-nums">
                                                        #{d.partida_numero ?? '—'}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {huellaDeclarada(d.categoria_nombre, d.atributos)}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {d.motivo_nombre ?? '—'}
                                                        {d.porcentaje_salud != null && (
                                                            <span className="text-muted-foreground">
                                                                {' '}
                                                                · salud {d.porcentaje_salud}%
                                                            </span>
                                                        )}
                                                        {d.ns && (
                                                            <span className="block font-mono text-[10px] text-muted-foreground">
                                                                NS {d.ns}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-center font-semibold tabular-nums text-destructive">
                                                        −{d.cantidad}
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        <Pildora
                                                            texto={TEXTO_ESTADO_DEVOLUCION[d.estado]}
                                                            tono={TONO_ESTADO_DEVOLUCION[d.estado]}
                                                        />
                                                        {d.fecha_ajuste && (
                                                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                                                {formatearFechaEntrada(d.fecha_ajuste)}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                                El SKU se resuelve en Almacén y solo para lo aprobado: la devolución se
                                identifica por su partida y la huella declarada en recepción.
                            </p>
                        </section>

                        <section>
                            <h4 className="mb-2 text-sm font-semibold">Aprobadas (se pagarán)</h4>
                            {aprobadas.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin piezas aprobadas.</p>
                            ) : (
                                <ul className="space-y-1 text-sm">
                                    {aprobadas.map((a) => (
                                        <li key={a.id} className="flex justify-between gap-3">
                                            <span>
                                                {a.producto_sku ?? a.producto_nombre ?? '—'}
                                                {a.marca_nombre && (
                                                    <span className="text-muted-foreground"> · {a.marca_nombre}</span>
                                                )}
                                            </span>
                                            <span className="tabular-nums">{a.cantidad_aprobada}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* La nota: recién generada aquí, o la que la entrada ya tenía ligada. */}
                        {notaId && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-success/30 bg-success/10 p-3">
                                <p className="text-sm">
                                    ✅ Nota <span className="font-mono tabular-nums">{notaFolio}</span>{' '}
                                    {generada ? 'generada y ligada a la entrada.' : 'ligada a esta entrada.'}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setVerNota(true)}
                                >
                                    <FileText className="mr-1 h-4 w-4" aria-hidden="true" />
                                    Ver nota
                                </Button>
                            </div>
                        )}

                        {!notaId && motivoApagado && (
                            <p className="text-xs text-muted-foreground">{motivoApagado}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={cargando}
                        >
                            Cerrar
                        </Button>
                        {!notaId && (
                            <Button type="button" onClick={ajustar} disabled={cargando || !puedeAjustar}>
                                <FileText className="mr-1 h-4 w-4" aria-hidden="true" />
                                {cargando ? 'Generando…' : 'Ajustar y generar nota'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* El modal de la nota (dueño 1.4) — se abre ENCIMA, sin salir de Recepción. */}
            <NotaCompraDetalleModal
                open={verNota}
                onOpenChange={setVerNota}
                notaId={notaId}
                onCambio={onGuardado}
            />
        </>
    )
}
