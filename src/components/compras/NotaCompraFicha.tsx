'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA COMPRA FICHA — Detalle de la nota (Guía 1.4 · rediseño · página [id])
// Encabezado (píldoras mercancía/pago · origen) + PARTIDAS + HISTORIAL DE PAGOS +
// acciones (Editar por recibir sin pagos · Registrar pago · Cancelar nota).
// Puente disabled "Entrada ligada (1.6)" — la nota NO mueve inventario por sí misma.
//
// ⭐ MEJORA 22 Sep 2026 — `enModal`: la MISMA ficha se muestra dentro de un diálogo
// (`NotaCompraDetalleModal`) para no abandonar la página desde donde se consulta. En ese modo
// desaparecen los botones de NAVEGACIÓN («Notas de compra», «Volver a notas de compra»), que
// dentro de un modal no llevan a ningún lado; los datos y las ACCIONES (editar · pagar ·
// cancelar) son idénticos. Una sola fuente del display: el modal no duplica campos ni totales.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Banknote, Ban, Truck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Pildora } from '@/components/data-table'
import { useCanAction } from '@/hooks/useCanAction'
import { obtenerNotaCompra } from '@/lib/actions/notas-compra'
import { NotaCompraModal } from '@/components/compras/NotaCompraModal'
import { RegistrarPagoNotaDialog } from '@/components/compras/RegistrarPagoNotaDialog'
import { CancelarNotaCompraDialog } from '@/components/compras/CancelarNotaCompraDialog'
import type { NotaCompraDetalle } from '@/types/notas-compra'
import {
    TEXTO_ESTADO_FISICO,
    TEXTO_ESTADO_PAGO_NOTA,
    TEXTO_METODO_PAGO,
    TEXTO_ORIGEN_NOTA,
    TONO_ESTADO_FISICO,
    TONO_ESTADO_PAGO_NOTA,
} from '@/types/notas-compra'

const RUTA = '/dashboard/compras'

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

function formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return '—'
    const [a, m, d] = fecha.split('-')
    return a && m && d ? `${d}/${m}/${a}` : fecha
}

function FilaDetalle({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="text-xs text-muted-foreground">{etiqueta}</span>
            <span className="text-center text-sm text-foreground">{valor}</span>
        </div>
    )
}

export function NotaCompraFicha({
    notaId,
    enModal = false,
    onCambio,
}: {
    notaId: string
    enModal?: boolean
    /** ⭐ MEJORA 22 Sep 2026 — la ficha cambió algo (editar · pagar · cancelar): quien la hospeda
     *  refresca lo suyo. Dentro del modal, el listado que quedó DETRÁS no se enteraría solo. */
    onCambio?: () => void
}) {
    const router = useRouter()
    const [nota, setNota] = useState<NotaCompraDetalle | null>(null)
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [modalEditar, setModalEditar] = useState(false)
    const [dialogo, setDialogo] = useState<{ tipo: 'pago' | 'cancelar' } | null>(null)

    const puedeEditar = useCanAction(RUTA, 'editar')
    const puedeEliminar = useCanAction(RUTA, 'eliminar')

    const cargar = useCallback(async () => {
        setCargando(true)
        const res = await obtenerNotaCompra(notaId)
        setCargando(false)
        if (!res.success || !res.data) {
            setErrorCarga(res.error ?? 'No se pudo cargar la nota.')
            return
        }
        setNota(res.data)
    }, [notaId])

    useEffect(() => {
        let activo = true
        void obtenerNotaCompra(notaId).then((res) => {
            if (!activo) return
            setCargando(false)
            if (!res.success || !res.data) {
                setErrorCarga(res.error ?? 'No se pudo cargar la nota.')
                return
            }
            setNota(res.data)
        })
        return () => {
            activo = false
        }
    }, [notaId])

    /** Recarga la nota y avisa hacia afuera (el modal lo usa para refrescar el listado de atrás). */
    const trasGuardado = useCallback(() => {
        void cargar()
        onCambio?.()
    }, [cargar, onCambio])

    if (errorCarga) {
        return (
            <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-surface p-4">
                <p className="text-sm text-destructive">{errorCarga}</p>
                {!enModal && (
                    <Button variant="outline" onClick={() => router.push(RUTA)}>
                        Volver a notas de compra
                    </Button>
                )}
            </div>
        )
    }

    if (cargando || !nota) {
        return <p className="py-8 text-sm text-muted-foreground">Cargando nota…</p>
    }

    const esCancelada = nota.es_cancelada
    const editable =
        nota.origen === 'directa' && !esCancelada && nota.estado_fisico === 'por_recibir' && nota.saldo_pendiente === nota.total
    const pagable = !esCancelada && nota.saldo_pendiente > 0
    const cancelable = !esCancelada && nota.estado_fisico === 'por_recibir' && nota.saldo_pendiente === nota.total

    return (
        <div className="flex flex-col gap-5">
            {!enModal && (
                <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => router.push(RUTA)}>
                    <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                    Notas de compra
                </Button>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <h1 className="font-display text-2xl font-bold">Nota {nota.folio}</h1>
                        {esCancelada && <Pildora texto="Cancelada" tono="peligro" />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {TEXTO_ORIGEN_NOTA[nota.origen]} · {formatearFecha(nota.fecha_nota)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {puedeEditar && editable && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setModalEditar(true)}>
                            <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                            Editar
                        </Button>
                    )}
                    {puedeEditar && pagable && (
                        <Button type="button" size="sm" onClick={() => setDialogo({ tipo: 'pago' })}>
                            <Banknote className="mr-1.5 h-4 w-4" aria-hidden="true" />
                            Registrar pago
                        </Button>
                    )}
                    {puedeEliminar && cancelable && (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setDialogo({ tipo: 'cancelar' })}
                        >
                            <Ban className="mr-1.5 h-4 w-4" aria-hidden="true" />
                            Cancelar nota
                        </Button>
                    )}
                </div>
            </div>

            {/* Puente disabled → Entradas 1.6 */}
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                <Truck className="h-4 w-4" aria-hidden="true" />
                Mercancía: la nota <strong>no mueve inventario</strong>; lo hace Almacén al
                confirmar su entrada ligada.
                <Button type="button" variant="outline" size="sm" disabled title="Disponible con Entradas (1.6)">
                    Ver entrada ligada (1.6)
                </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {/* Estados */}
                <section className="rounded-md border border-border p-4">
                    <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Estados</h2>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Estado</span>
                            {esCancelada ? (
                                <Pildora texto="Cancelada" tono="peligro" />
                            ) : (
                                <Pildora
                                    texto={TEXTO_ESTADO_FISICO[nota.estado_fisico]}
                                    tono={TONO_ESTADO_FISICO[nota.estado_fisico]}
                                />
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Pago</span>
                            {esCancelada ? (
                                <span className="text-muted-foreground">—</span>
                            ) : (
                                <Pildora
                                    texto={nota.estado_pago_clave ? TEXTO_ESTADO_PAGO_NOTA[nota.estado_pago_clave] : (nota.estado_pago_nombre ?? '—')}
                                    tono={nota.estado_pago_clave ? TONO_ESTADO_PAGO_NOTA[nota.estado_pago_clave] : 'neutro'}
                                />
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Total</span>
                            <span className="font-mono text-sm font-semibold tabular-nums">{formatearMXN(nota.total)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Saldo por pagar</span>
                            <span className="font-mono text-sm tabular-nums">{formatearMXN(nota.saldo_pendiente)}</span>
                        </div>
                    </div>
                </section>

                {/* Proveedor / documento */}
                <section className="rounded-md border border-border p-4">
                    <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Proveedor</h2>
                    <FilaDetalle
                        etiqueta="Proveedor"
                        valor={
                            <span>
                                {nota.proveedor_nombre ?? '—'}
                                {nota.proveedor_codigo && (
                                    <span className="ml-1 font-mono text-xs text-muted-foreground">{nota.proveedor_codigo}</span>
                                )}
                            </span>
                        }
                    />
                    <FilaDetalle etiqueta="Fecha de la nota" valor={formatearFecha(nota.fecha_nota)} />
                    <FilaDetalle etiqueta="Nº factura / remisión" valor={nota.numero_factura_proveedor ?? '—'} />
                    <FilaDetalle etiqueta="Referencia" valor={nota.referencia_proveedor ?? '—'} />
                </section>
            </div>

            {/* Partidas */}
            <section className="rounded-md border border-border p-4">
                <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Partidas</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-center text-xs text-muted-foreground">
                                <th className="py-1.5 pr-3 font-medium">Producto</th>
                                <th className="py-1.5 pr-3 text-center font-medium">Cantidad</th>
                                <th className="py-1.5 pr-3 text-center font-medium">Costo</th>
                                <th className="py-1.5 text-center font-medium">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="text-center">
                            {nota.partidas.map((p) => (
                                <tr key={p.id} className="border-b border-border last:border-0">
                                    <td className="py-2 pr-3">
                                        <span className="block truncate">{p.producto_nombre ?? p.descripcion ?? '—'}</span>
                                        {p.producto_codigo && (
                                            <span className="block font-mono text-[11px] text-muted-foreground">
                                                {p.producto_codigo}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 pr-3 text-center tabular-nums">{p.cantidad}</td>
                                    <td className="py-2 pr-3 text-center font-mono text-xs tabular-nums">
                                        {formatearMXN(p.costo_acordado)}
                                    </td>
                                    <td className="py-2 text-center font-mono text-xs tabular-nums">
                                        {formatearMXN(p.subtotal_partida)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Historial de pagos */}
            <section className="rounded-md border border-border p-4">
                <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                    Historial de pagos
                </h2>
                {nota.pagos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-center text-xs text-muted-foreground">
                                    <th className="py-1.5 pr-3 font-medium">Fecha</th>
                                    <th className="py-1.5 pr-3 text-center font-medium">Monto</th>
                                    <th className="py-1.5 pr-3 font-medium">Método</th>
                                    <th className="py-1.5 font-medium">Referencia</th>
                                </tr>
                            </thead>
                            <tbody className="text-center">
                                {nota.pagos.map((p) => (
                                    <tr key={p.id} className="border-b border-border last:border-0">
                                        <td className="py-2 pr-3 tabular-nums">{formatearFecha(p.fecha_pago)}</td>
                                        <td className="py-2 pr-3 text-center font-mono text-xs tabular-nums">
                                            {formatearMXN(p.monto)}
                                        </td>
                                        <td className="py-2 pr-3">{TEXTO_METODO_PAGO[p.metodo]}</td>
                                        <td className="py-2">{p.referencia_bancaria ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {esCancelada && nota.motivo_cancelacion && (
                <section className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
                    <h2 className="mb-1 text-sm font-semibold text-destructive">Motivo de cancelación</h2>
                    <p className="text-sm">{nota.motivo_cancelacion}</p>
                </section>
            )}

            <NotaCompraModal
                open={modalEditar}
                onOpenChange={setModalEditar}
                modo="editar"
                nota={nota}
                onGuardado={trasGuardado}
            />
            <RegistrarPagoNotaDialog
                open={dialogo?.tipo === 'pago'}
                onOpenChange={(a) => setDialogo(a ? { tipo: 'pago' } : null)}
                nota={nota}
                onGuardado={trasGuardado}
            />
            <CancelarNotaCompraDialog
                open={dialogo?.tipo === 'cancelar'}
                onOpenChange={(a) => setDialogo(a ? { tipo: 'cancelar' } : null)}
                notas={nota ? [nota] : null}
                onGuardado={trasGuardado}
            />
        </div>
    )
}
