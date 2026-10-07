'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTAS REMISION CATALOGO — Listado del módulo (Guía 1.8 · Smart)
// Página delgada + estado + delegación · Toolbar vía usePageConfig.
// Paginación SERVIDOR. ⭐ Fila EXPANDIBLE con las partidas en línea.
//
// ⭐ ANEXIONES de las Partes 3–5 (se aplican sobre este archivo, en ese orden):
//    · Parte 3 — ✅ **APLICADA 04 Oct 2026**: `NotaRemisionModal` + la acción «Nueva nota»
//    · Parte 4 — ✅ **APLICADA 04 Oct 2026**: `NotaRemisionDetalleModal` + la acción «Ver»
//    · Parte 5 — ✅ **APLICADA 04 Oct 2026**: `CancelarNotaRemisionDialog` + «Cancelar nota»
// ⚠️ `usePageConfig` SIEMPRE antes de cualquier `return` condicional (orden de hooks).
// ⚠️ `filtros` y `actions` MEMORIZADOS: el guard del store compara por referencia.
// ⭐ `RUTA` está CONGELADA por las políticas de storage de 0.4 P7: no se renombra.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Ban, Download, Eye, Plus } from 'lucide-react'

import { DataTable, crearColumnaAcciones, useSeleccionTabla } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import type { ToolbarAction } from '@/types/shell'
import {
    listarNotasRemision,
    listarVentasParaExportar,
    obtenerNotaRemision,
} from '@/lib/actions/ventas'
import { listarClientesActivos } from '@/lib/actions/clientes'
import { NotaRemisionFilters, FILTROS_VENTAS_DEFAULT } from '@/components/ventas/NotaRemisionFilters'
import type { OpcionFiltro } from '@/components/ventas/NotaRemisionFilters'
import { PartidasNotaExpandidas } from '@/components/ventas/PartidasNotaExpandidas'
import { NotaRemisionModal } from '@/components/ventas/NotaRemisionModal'
import { NotaRemisionDetalleModal } from '@/components/ventas/NotaRemisionDetalleModal'
import { CancelarNotaRemisionDialog } from '@/components/ventas/CancelarNotaRemisionDialog'
import { columnasVentas } from '@/components/ventas/columnas-venta'
import { exportarVentasCsv } from '@/components/ventas/exportar-ventas-csv'
import type {
    FiltrosNotaRemision,
    NotaRemisionDetalle,
    NotaRemisionListado,
} from '@/types/ventas'

const RUTA = '/dashboard/ventas/remisiones'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

export function NotasRemisionCatalogo() {
    const [notas, setNotas] = useState<NotaRemisionListado[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosNotaRemision>(FILTROS_VENTAS_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [clientes, setClientes] = useState<OpcionFiltro[]>([])
    // ⭐ ANEXIÓN Parte 3 (04 Oct 2026): el modal de EMISIÓN. Su `open` es el único estado
    //    que el catálogo agrega — el borrador vive dentro del modal (su único dueño).
    const [modalAbierto, setModalAbierto] = useState(false)
    // ⭐ ANEXIÓN Parte 4: la nota que se consulta en el detalle (la ficha, sin salir del listado).
    const [detalleId, setDetalleId] = useState<string | null>(null)
    // ⭐ ANEXIÓN Parte 5: la nota a cancelar. ⚠️ Es el **DETALLE**, no la fila: el diálogo
    //    declara `nota: NotaRemisionDetalle` (necesita el total y el saldo ya resueltos), así
    //    que se pide a la SA al abrir — la fila del listado no los trae.
    const [notaACancelar, setNotaACancelar] = useState<NotaRemisionDetalle | null>(null)
    // ⚠️ La fila ABIERTA la maneja el `DataTable` (acordeón · `unaFilaExpandida`): este listado
    //    NO duplica ese estado — nada lo leería (la toolbar de esta Parte es Nuevo · Exportar ·
    //    Ver · Cancelar, y ninguna de las cuatro mira la fila abierta).
    // ⭐ `seleccionados` lo piden DOS acciones de la toolbar (Ver y Cancelar): exigen 1 fila.
    const { seleccion, onSeleccionChange, seleccionados, limpiar } = useSeleccionTabla(
        notas,
        (n) => n.id
    )

    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeVer = useCanAction(RUTA, 'ver')
    const puedeExportar = useCanAction(RUTA, 'exportar')
    const puedeEliminar = useCanAction(RUTA, 'eliminar')

    /**
     * ⭐ ANEXIÓN Parte 5 — cancelar desde el LISTADO (sin abrir la ficha).
     * ⚠️ Pide el detalle ANTES de abrir: el diálogo necesita `NotaRemisionDetalle`, y hacerlo
     *    acá (y no dentro del diálogo) mantiene ese componente sin consultas, como lo declara.
     */
    const abrirCancelar = useCallback(async (nota: NotaRemisionListado) => {
        const res = await obtenerNotaRemision(nota.id)
        if (!res.success || !res.data) {
            toast.error(res.error ?? 'No se pudo abrir la nota.')
            return
        }
        setNotaACancelar(res.data)
    }, [])

    // Opciones del filtro de cliente (una carga — activos)
    useEffect(() => {
        let activo = true
        void listarClientesActivos().then((res) => {
            if (!activo || !res.success) return
            setClientes(
                (res.data ?? []).map((c) => ({
                    valor: c.id,
                    etiqueta: `${c.codigo} — ${c.nombre_comercial}`,
                }))
            )
        })
        return () => {
            activo = false
        }
    }, [])

    // Carga de página (SERVIDOR) — setState solo en continuación async
    useEffect(() => {
        let activo = true
        void listarNotasRemision(filtros, pagina, tamano).then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setNotas(res.data ?? [])
            setTotal(res.total ?? 0)
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [filtros, pagina, tamano])

    const recargar = useCallback(async () => {
        setEstadoTabla('loading')
        const res = await listarNotasRemision(filtros, pagina, tamano)
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setNotas(res.data ?? [])
        setTotal(res.total ?? 0)
        setEstadoTabla('idle')
    }, [filtros, pagina, tamano])

    /** Un cambio de filtro vuelve a la página 1 y suelta la selección. */
    const manejarFiltros = useCallback((patch: Partial<FiltrosNotaRemision>) => {
        setEstadoTabla('loading')
        setFiltros((prev) => ({ ...prev, ...patch }))
        setPagina(1)
    }, [])

    /** ⚠️ MEMORIZADO: el guard anti-bucle del store compara por REFERENCIA. */
    const filtrosBarra = useMemo(
        () => (
            <NotaRemisionFilters
                filtros={filtros}
                onFiltrosChange={manejarFiltros}
                clientes={clientes}
                marcas={[]}
                contador={total}
                disabled={estadoTabla === 'loading'}
            />
        ),
        [filtros, manejarFiltros, clientes, total, estadoTabla]
    )

    /**
     * ⚠️ `columnasVentas()` va en `useMemo`: un arreglo nuevo por render le entrega a
     * `DataTable` columnas DISTINTAS en cada pasada (parpadeo, pérdida de orden y de selección).
     * ⭐ ANEXIÓN Parte 4 — la columna de ACCIONES (el `Ver` por fila) viaja al final del arreglo.
     *    `Ver` va INLINE (`acciones`, no `secundarias`): es LA acción de la fila, y el rediseño
     *    del kit (24 Sep) mantiene inline la que más se usa — igual que el listado de 1.4.
     */
    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<NotaRemisionListado>({
                acciones: [
                    {
                        icon: Eye,
                        label: 'Ver',
                        dataAccion: 'ver',
                        onClick: (n) => setDetalleId(n.id),
                    },
                ],
            }),
        []
    )

    const columnas = useMemo(
        () => [...columnasVentas(), columnaAcciones],
        [columnaAcciones]
    )

    const acciones = useMemo<ToolbarAction[]>(() => {
        const lista: ToolbarAction[] = []

        // ⭐ ANEXIÓN Parte 3 — la ÚNICA acción dominante, y va PRIMERA.
        // ⚠️ El `onClick` es OBLIGATORIO: `toolbar-config` declara el botón para esta ruta
        //    (`{ id: 'nuevo', accion: 'crear' }`) y **sin onClick es un BOTÓN MUERTO** — se
        //    dibuja, se aprieta y no pasa nada (el defecto que SISTEMA_COMPONENTES §8 nombra).
        //    La Toolbar fusiona por `id`: esto SOBRESCRIBE la acción base sin duplicarla.
        if (puedeCrear) {
            lista.push({
                id: 'nuevo',
                label: 'Nueva nota',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                onClick: () => setModalAbierto(true),
            })
        }

        if (puedeExportar) {
            lista.push({
                id: 'exportar',
                label: 'Exportar CSV',
                icon: Download,
                accion: 'exportar',
                variant: 'outline',
                onClick: () => {
                    // ⭐ Exporta lo que el FILTRO devuelve, no la página visible
                    void listarVentasParaExportar(filtros).then((res) => {
                        if (!res.success) {
                            toast.error(res.error ?? 'No se pudo exportar.')
                            return
                        }
                        if ((res.data ?? []).length === 0) {
                            toast.error('No hay notas que exportar con el filtro actual.')
                            return
                        }
                        exportarVentasCsv(res.data ?? [])
                    })
                },
            })
        }

        // ⭐ ANEXIÓN Parte 4 — «Ver» la ficha sin salir del listado (1 fila seleccionada).
        // ⚠️ Sin selección la acción se DESHABILITA con su `title` (no se esconde): así el
        //    usuario entiende que existe y qué le falta, en vez de creer que no está.
        if (puedeVer) {
            lista.push({
                id: 'ver',
                label: 'Ver',
                icon: Eye,
                accion: 'ver',
                variant: 'outline',
                disabled: seleccionados.length !== 1,
                title:
                    seleccionados.length !== 1
                        ? 'Selecciona una sola nota para consultarla'
                        : undefined,
                onClick:
                    seleccionados.length === 1
                        ? () => setDetalleId(seleccionados[0].id)
                        : undefined,
            })
        }

        // ⭐ ANEXIÓN Parte 5 — «Cancelar nota» desde el listado. ⚠️ `accion: 'eliminar'` es el
        //    permiso REAL: el RPC `b8` lo exige en su primera línea (la capa que no se esquiva).
        if (puedeEliminar) {
            const cancelable = seleccionados[0] && !seleccionados[0].es_cancelada
            lista.push({
                id: 'cancelar',
                label: 'Cancelar nota',
                icon: Ban,
                accion: 'eliminar',
                variant: 'outline',
                disabled: seleccionados.length !== 1 || !cancelable,
                title: !cancelable
                    ? 'Selecciona una sola nota vigente para cancelarla'
                    : undefined,
                onClick:
                    seleccionados.length === 1 && cancelable
                        ? () => void abrirCancelar(seleccionados[0])
                        : undefined,
            })
        }

        return lista
    }, [puedeCrear, puedeExportar, puedeVer, puedeEliminar, filtros, seleccionados, abrirCancelar])

    usePageConfig({
        info: { title: 'Notas de remisión', subtitle: 'Ventas' },
        path: RUTA,
        actions: acciones,
        filtros: filtrosBarra,
    })

    const totalPaginas = Math.max(1, Math.ceil(total / tamano))

    return (
        <>
            <DataTable<NotaRemisionListado>
                columns={columnas}
                data={notas}
                rowKey={(n) => n.id}
                estado={estadoTabla}
                emptyMessage="No hay notas de remisión con el filtro actual."
                onRetry={() => {
                    void recargar()
                }}
                enableRowSelection
                rowSelection={seleccion}
                onRowSelectionChange={onSeleccionChange}
                pageSize={tamano}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                page={pagina}
                totalPages={totalPaginas}
                onPageChange={(p) => {
                    setEstadoTabla('loading')
                    setPagina(p)
                    limpiar()
                }}
                onPageSizeChange={(n) => {
                    setEstadoTabla('loading')
                    setTamano(n)
                    setPagina(1)
                    limpiar()
                }}
                showColumnSelector
                // ⭐ Un detalle a la vez: el mismo acordeón que usan las colas de 1.6
                unaFilaExpandida
                renderFilaExpandida={(n) => (
                    <PartidasNotaExpandidas nota={n} />
                )}
            />
            {/* ⭐ ANEXIÓN Parte 3 — SIEMPRE montado (patrón de 1.4): el modal es Radix y
                montarlo/desmontarlo por condición pierde el foco y el estado de apertura. */}
            <NotaRemisionModal
                open={modalAbierto}
                onOpenChange={setModalAbierto}
                onEmitida={() => {
                    void recargar()
                }}
            />
            {/* ⭐ ANEXIÓN Parte 4 — la ficha SIN salir del listado. */}
            <NotaRemisionDetalleModal
                open={detalleId !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setDetalleId(null)
                }}
                notaId={detalleId}
                onCambio={() => {
                    void recargar()
                }}
            />
            {/* ⭐ ANEXIÓN Parte 5 — la cancelación desde el listado. */}
            <CancelarNotaRemisionDialog
                open={notaACancelar !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setNotaACancelar(null)
                }}
                nota={notaACancelar}
                onCambio={() => {
                    void recargar()
                }}
            />
        </>
    )
}
