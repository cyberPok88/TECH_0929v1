'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA REMISION FICHA — el display ÚNICO de una nota (Guía 1.8 · Parte 4)
//
// ⭐ LAS DOS PUERTAS, UNA SOLA FUENTE: esta ficha se monta suelta (página/ruta) o
//    dentro de `NotaRemisionDetalleModal` con `enModal` — el patrón medido de 1.4.
//    `enModal` OCULTA los botones de navegación; NO repite campos, totales ni acciones.
// ⭐ 3 PESTAÑAS: Datos · Partidas · ⭐ ESTADO DE CUENTA (los asientos del libro).
// ⭐ Carga SUS PROPIOS datos: el contrato con los consumidores es `notaId` y nada más
//    (el catálogo tiene un id; 1.9 tiene otro — ninguno tiene que saber consultarlo).
// ⚠️ El estado de cuenta se pide SOLO al abrir su pestaña: es la consulta más pesada y
//    la mayoría de las visitas no la abre.
// ⚠️ Solo LEE: no calcula saldos (los deriva el libro · R27) y no edita partidas (D-21).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Pencil, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pildora } from '@/components/data-table'
import { Spinner } from '@/components/ui/spinner'
import { obtenerNotaRemision, consultarEstadoCuentaCliente } from '@/lib/actions/ventas'
import { EstadoCuentaCliente } from '@/components/ventas/EstadoCuentaCliente'
import { formatearFecha } from '@/components/ventas/columnas-venta'
import { formatearMoneda } from '@/lib/utils/formatters'
// ⭐ PARTE 5 — los 3 imports del punto de invocación del papel (el bloque los traía en un
// `Add-Content` que los dejaba al final del archivo; van acá, con los demás).
import { DocumentoImprimible } from '@/components/imprimibles'
import { construirDatosNotaVenta } from '@/components/ventas/datos-nota-venta'
import { NotaVentaImprimible } from '@/components/ventas/imprimibles/NotaVentaImprimible'
// ⭐ ANEXIÓN Parte 5 (04 Oct 2026): el diálogo de cancelación lo monta la ficha (patrón 1.4).
import { CancelarNotaRemisionDialog } from '@/components/ventas/CancelarNotaRemisionDialog'
import {
    ETIQUETA_ESTADO_PAGO,
    TONO_ESTADO_PAGO,
    type EstadoCuentaCliente as EstadoCuenta,
    type NotaRemisionDetalle,
} from '@/types/ventas'

interface NotaRemisionFichaProps {
    notaId: string
    /** ⭐ Dentro de un diálogo: oculta los botones de NAVEGACIÓN (1.4 · MEJORA 22 Sep). */
    enModal?: boolean
    /** La nota cambió (editar/cancelar): el listado de atrás se refresca. */
    onCambio?: () => void
    onEditar?: (n: NotaRemisionDetalle) => void
}

export function NotaRemisionFicha({
    notaId,
    enModal = false,
    onCambio,
    onEditar,
}: NotaRemisionFichaProps) {
    const [nota, setNota] = useState<NotaRemisionDetalle | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [tab, setTab] = useState('datos')
    /** El estado de cuenta se carga la PRIMERA vez que se abre su pestaña. */
    const [estado, setEstado] = useState<EstadoCuenta | null>(null)
    const [cargandoEstado, setCargandoEstado] = useState(false)
    // ⭐ ANEXIÓN Parte 5 (04 Oct 2026): la cancelación la monta LA PROPIA FICHA (patrón 1.4:
    //    `NotaCompraFicha` monta `CancelarNotaCompraDialog` con estado local). ⚠️ Antes el botón
    //    «Cancelar» llamaba a un prop `onCancelar` que **nadie pasaba** ⇒ estaba `disabled` SIEMPRE.
    const [cancelarAbierto, setCancelarAbierto] = useState(false)

    // ── ⭐ LO QUE APORTA LA PARTE 5 (el punto de invocación del papel) ──────────────────────
    // ⚠️ FIX 02 Oct 2026 — el bloque de la Parte 5 estaba escrito como `Add-Content` y eso lo
    //    dejaba **AL FINAL DEL ARCHIVO, fuera del componente** (`useState`/`useMemo` en el nivel
    //    superior ⇒ `rules-of-hooks` + `nota` indefinida). Sus 3 piezas van en **2 sitios
    //    distintos**: el estado y el vocabulario ACÁ ARRIBA, y el `<DocumentoImprimible>` dentro
    //    del JSX del `return` (abajo).
    //    1) El estado que abre el documento (nada que cargar de antemano: el punto de invocación
    //       resuelve plantilla y membrete AL ABRIR).
    const [imprimiendo, setImprimiendo] = useState(false)

    //    2) El vocabulario, construido UNA vez por nota (es una función pura y barata).
    const datosImpresion = useMemo(() => (nota ? construirDatosNotaVenta(nota) : null), [nota])

    useEffect(() => {
        let activo = true
        // ⚠️ FIX 02 Oct 2026 — acá había un `setCargando(true)` **sincrónico en el cuerpo del
        //    efecto**, que viola `react-hooks/set-state-in-effect`. **Era redundante**: `cargando`
        //    ya nace en `true` (arriba) y el modal monta la ficha por nota (Radix desmonta el
        //    contenido al cerrar) ⇒ cada nota entra con un montaje limpio. El flag solo baja, en el
        //    callback de la promesa.
        void obtenerNotaRemision(notaId).then((res) => {
            if (!activo) return
            setCargando(false)
            if (!res.success || !res.data) {
                setError(res.error ?? 'No se pudo cargar la nota.')
                return
            }
            setNota(res.data)
        })
        return () => {
            activo = false
        }
    }, [notaId])

    // ⭐ Perezoso: la consulta más pesada, solo cuando hace falta
    // ⭐ FIX 02 Oct 2026 — LA CARGA ES PEREZOSA **POR EVENTO, NO POR EFECTO**: `setState` sincrónico
    //    dentro de un efecto viola `react-hooks/set-state-in-effect` (y el lint **sí rastrea** dentro
    //    de una función llamada desde el efecto). Se dispara desde el `onValueChange` de las
    //    pestañas —una acción del usuario— y el único `setState` que queda es el del callback de la
    //    promesa. ⚠️ **Y de paso se elimina un BUCLE REAL**: el guard `estado` no frenaba el caso de
    //    consulta **fallida** (estado `null` + `cargandoEstado` de vuelta en `false` ⇒ el efecto se
    //    re-disparaba y volvía a consultar, sin fin).
    const cargarEstado = useCallback(() => {
        if (!nota || estado || cargandoEstado) return
        setCargandoEstado(true)
        void consultarEstadoCuentaCliente(nota.id_cliente).then((res) => {
            setCargandoEstado(false)
            if (res.success && res.data) setEstado(res.data)
        })
    }, [nota, estado, cargandoEstado])

    if (cargando) return <Spinner etiqueta="Cargando la nota…" className="py-6" />
    if (error || !nota) {
        return <p className="py-6 text-center text-sm text-destructive">{error ?? 'Sin datos.'}</p>
    }

    const cancelada = nota.es_cancelada

    return (
        <div className="flex flex-col gap-4">
            {/* ── Encabezado: de qué nota hablamos y cómo está ───────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-surface-raised px-3 py-2.5">
                <div className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[15px] font-bold tracking-[0.06em]">
                            {nota.folio}
                        </span>
                        {cancelada ? (
                            <Pildora texto="Cancelada" tono="neutro" />
                        ) : nota.estado_pago_clave ? (
                            <Pildora
                                texto={ETIQUETA_ESTADO_PAGO[nota.estado_pago_clave]}
                                tono={TONO_ESTADO_PAGO[nota.estado_pago_clave]}
                            />
                        ) : null}
                        {nota.es_credito && <Pildora texto="Crédito" tono="info" />}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">
                        <b className="text-foreground">{nota.cliente_nombre ?? '—'}</b>
                        {nota.cliente_codigo ? ` · ${nota.cliente_codigo}` : ''}
                        {nota.marca_nombre ? ` · ${nota.marca_nombre}` : ''}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">
                        Emitida {formatearFecha(nota.fecha_emision)} · vence{' '}
                        {formatearFecha(nota.fecha_vencimiento)}
                        {nota.vendedor_nombre ? ` · vendió ${nota.vendedor_nombre}` : ''}
                    </span>
                    {cancelada && nota.motivo_cancelacion && (
                        <span className="text-[12.5px] text-destructive">
                            Motivo: {nota.motivo_cancelacion}
                        </span>
                    )}
                </div>

                {/* ⭐ Las acciones SIEMPRE están; lo que `enModal` quita es la NAVEGACIÓN */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={cancelada || !onEditar}
                        onClick={() => onEditar?.(nota)}
                        title={cancelada ? 'Una nota cancelada no se edita.' : undefined}
                    >
                        <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Editar
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setImprimiendo(true)}
                    >
                        <Printer className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Imprimir
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={cancelada}
                        onClick={() => setCancelarAbierto(true)}
                        title={cancelada ? 'Ya está cancelada.' : undefined}
                    >
                        <Ban className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Cancelar
                    </Button>
                </div>
            </div>

            {/* ── Las 3 pestañas ─────────────────────────────────────────────── */}
            <Tabs
                value={tab}
                onValueChange={(v) => {
                    setTab(v)
                    // ⭐ La pestaña del estado de cuenta es la que DISPARA su carga (perezosa).
                    if (v === 'cuenta') cargarEstado()
                }}
            >
                <TabsList>
                    <TabsTrigger value="datos">Datos</TabsTrigger>
                    <TabsTrigger value="partidas">
                        Partidas ({nota.partidas.length})
                    </TabsTrigger>
                    <TabsTrigger value="cuenta">Estado de cuenta</TabsTrigger>
                </TabsList>

                {/* ── 1 · DATOS ──────────────────────────────────────────────── */}
                <TabsContent value="datos" className="flex flex-col gap-3 pt-3">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                        <div>
                            <dt className="text-muted-foreground">Subtotal</dt>
                            <dd className="tabular-nums">{formatearMoneda(nota.subtotal)}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Descuento global</dt>
                            <dd className="tabular-nums">{formatearMoneda(nota.descuento_global)}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Impuestos</dt>
                            <dd className="tabular-nums">{formatearMoneda(nota.impuestos)}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Total</dt>
                            <dd className="tabular-nums font-semibold">{formatearMoneda(nota.total)}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Saldo pendiente</dt>
                            <dd className="tabular-nums font-semibold text-destructive">
                                {formatearMoneda(nota.saldo_pendiente)}
                            </dd>
                        </div>
                        <div>
                            {/* ⭐ El embudo del LIBRO: lo que se cargó y lo que se abonó (R1) */}
                            <dt className="text-muted-foreground">Asientos</dt>
                            <dd className="tabular-nums">
                                {nota.movimientos} · +{formatearMoneda(nota.total_cargos)} · −
                                {formatearMoneda(nota.total_abonos)}
                            </dd>
                        </div>
                    </dl>
                    {nota.notas && (
                        <p className="rounded-md border border-border bg-surface px-3 py-2 text-[13px]">
                            {nota.notas}
                        </p>
                    )}
                </TabsContent>

                {/* ── 2 · PARTIDAS (los snapshots son sagrados) ───────────────── */}
                <TabsContent value="partidas" className="pt-3">
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-b-2 border-border text-left">
                                <th className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                                    #
                                </th>
                                <th className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                                    Producto
                                </th>
                                <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-[0.12em]">
                                    Cant.
                                </th>
                                <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-[0.12em]">
                                    Precio
                                </th>
                                <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-[0.12em]">
                                    Importe
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {nota.partidas.map((p) => (
                                <tr key={p.id} className="border-t border-border">
                                    <td className="px-2 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                                        {p.orden}
                                    </td>
                                    <td className="px-2 py-2">
                                        <span className="flex flex-wrap items-center gap-1.5">
                                            {p.descripcion_snapshot}
                                            {p.es_cortesia && <Pildora texto="Cortesía" tono="info" />}
                                        </span>
                                        {p.series.length > 0 && (
                                            <span className="block font-mono text-[11px] text-muted-foreground">
                                                {p.series.join(' · ')}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-2 py-2 text-right tabular-nums">
                                        {Number(p.cantidad)}
                                    </td>
                                    <td className="px-2 py-2 text-right tabular-nums">
                                        {formatearMoneda(Number(p.precio_unitario_final))}
                                    </td>
                                    <td className="px-2 py-2 text-right tabular-nums">
                                        {formatearMoneda(Number(p.total))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TabsContent>

                {/* ── 3 · ⭐ ESTADO DE CUENTA (la deuda, explicada) ──────────── */}
                <TabsContent value="cuenta" className="pt-3">
                    {cargandoEstado ? (
                        <Spinner etiqueta="Cargando el estado de cuenta…" className="py-4" />
                    ) : estado ? (
                        <EstadoCuentaCliente estado={estado} />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No se pudo cargar el estado de cuenta.
                        </p>
                    )}
                </TabsContent>
            </Tabs>

            {/* ⚠️ `enModal`: aquí vive el único botón de NAVEGACIÓN — y desaparece
                dentro del diálogo, porque cerrar el diálogo ya es «volver». */}
            {!enModal && (
                <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onCambio?.()}>
                        Actualizar
                    </Button>
                </div>
            )}

            {/* ⭐ PARTE 5 · EL PUNTO DE INVOCACIÓN DEL PAPEL — va ACÁ (dentro del JSX), no al final
                del archivo. `fallback` es OBLIGATORIO: sin él, con el registro de plantillas vacío
                el PDF mostraría un mensaje (el defecto vivo de `nota_compra`). */}
            {datosImpresion && (
                <DocumentoImprimible
                    tipo="nota_venta"
                    datos={datosImpresion}
                    nombreArchivo={nota.folio}
                    titulo={`Nota de venta ${nota.folio}`}
                    open={imprimiendo}
                    onOpenChange={setImprimiendo}
                    fallback={NotaVentaImprimible}
                />
            )}

            {/* ⭐ ANEXIÓN Parte 5 — la cancelación, montada por la FICHA (patrón 1.4).
                ⚠️ `setEstado(null)` invalida el estado de cuenta CACHEADO: tras cancelar, los
                asientos cambiaron y el que está en pantalla ya es viejo. */}
            <CancelarNotaRemisionDialog
                open={cancelarAbierto}
                onOpenChange={setCancelarAbierto}
                nota={nota}
                onCambio={() => {
                    onCambio?.()
                    setEstado(null)
                }}
            />
        </div>
    )
}
