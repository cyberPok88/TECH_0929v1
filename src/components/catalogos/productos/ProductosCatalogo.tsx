'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTOS CATALOGO — Orquestador del listado (Guía 1.2 · Partes 2–5 · Smart)
// P2 listado+filtros+chips · P3 Nuevo · P4 Editar por fila · P5 estados masivos
// (toggle/archivar/reactivar por selección y por fila) + export CSV.
// Confirma con ConfirmarAccionDialog del KIT (PROMOCIÓN 04 Sep) — diálogo siempre
// montado, cierre por open. Las acciones inline (⋮) se abren con retardo de 160 ms
// (fix overlay del DropdownMenu, patrón 1.1). P6+ agregan la ficha [id].
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, Download, Eye, Pencil, Plus, Power, PowerOff, Upload } from 'lucide-react'

import {
    DataTable,
    Pildora,
    TableSkeleton,
    crearColumnaAcciones,
    useSeleccionTabla,
} from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { ProductoFilters, FILTROS_DEFAULT } from '@/components/catalogos/productos/ProductoFilters'
import { AtributosChips } from '@/components/catalogos/productos/AtributosChips'
import { ProductoModal } from '@/components/catalogos/productos/ProductoModal'
import { ImportarCSVModal } from '@/components/catalogos/productos/ImportarCSVModal'
import { exportarProductosCsv } from '@/components/catalogos/productos/exportar-productos-csv'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { listarCategorias, listarMarcasProducto } from '@/lib/actions/catalogos'
import {
    archivarProducto,
    listarProductos,
    toggleActivoProducto,
} from '@/lib/actions/productos'
import { formatearMoneda } from '@/lib/utils/formatters'
import { toast } from 'sonner'
import type { ToolbarAction } from '@/types/shell'
import type { CategoriaFila, MarcaProductoFila } from '@/types/catalogos'
import type { Producto } from '@/types/productos'
import { TEXTO_ESTADO_PRODUCTO, TONO_ESTADO_PRODUCTO, estadoDeProducto } from '@/types/productos'

const RUTA = '/dashboard/catalogos/productos'

type ModalProducto =
    | { modo: 'crear' }
    | { modo: 'editar'; producto: Producto }
    | null

type ConfirmacionPendiente =
    | { tipo: 'estado'; producto: Producto }
    | { tipo: 'estado_masivo'; productos: Producto[]; activar: boolean }
    | { tipo: 'archivar'; producto: Producto }
    | { tipo: 'archivar_masivo'; productos: Producto[]; archivar: boolean }
    | null

export function ProductosCatalogo() {
    const router = useRouter()
    const [productos, setProductos] = useState<Producto[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState(FILTROS_DEFAULT)
    const [categorias, setCategorias] = useState<CategoriaFila[]>([])
    const [marcasFiltro, setMarcasFiltro] = useState<MarcaProductoFila[]>([])
    const [modal, setModal] = useState<ModalProducto>(null)
    const [confirmar, setConfirmar] = useState<ConfirmacionPendiente>(null)
    const [importarAbierto, setImportarAbierto] = useState(false)

    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeEditar = useCanAction(RUTA, 'editar')
    const puedeArchivar = useCanAction(RUTA, 'eliminar')
    const puedeExportar = useCanAction(RUTA, 'exportar')
    const puedeImportar = useCanAction(RUTA, 'importar')

    const busqueda = filtros.busqueda
    const idCategoria = filtros.id_categoria
    const idMarca = filtros.id_marca
    const estadoFiltro = filtros.estado
    const soloPendientes = filtros.solo_pendientes

    const obtener = useCallback(async () => {
        return listarProductos({
            busqueda,
            id_categoria: idCategoria,
            id_marca: idMarca,
            estado: estadoFiltro,
            solo_pendientes: soloPendientes,
        })
    }, [busqueda, idCategoria, idMarca, estadoFiltro, soloPendientes])

    const recargar = useCallback(async () => {
        const res = await obtener()
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setProductos(res.data ?? [])
        setEstadoTabla('idle')
    }, [obtener])

    useEffect(() => {
        let activo = true
        obtener().then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setProductos(res.data ?? [])
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [obtener])

    useEffect(() => {
        void listarCategorias().then((r) => {
            if (r.success) setCategorias(r.data ?? [])
        })
    }, [])
    useEffect(() => {
        void listarMarcasProducto().then((r) => {
            if (r.success) setMarcasFiltro(r.data ?? [])
        })
    }, [])

    // ── Selección (P5 · checkboxes) ─────────────────────────────────────────────
    const { seleccion, onSeleccionChange, seleccionados, limpiar } = useSeleccionTabla(
        productos,
        (p) => p.id
    )

    // Apertura diferida 160 ms desde las acciones inline (fix overlay, patrón 1.1).
    const abrirConfirmacion = useCallback(
        (accion: Exclude<ConfirmacionPendiente, null>) => {
            window.setTimeout(() => setConfirmar(accion), 160)
        },
        []
    )

    const columnas = useMemo<
        (import('@tanstack/react-table').ColumnDef<Producto> & ColumnDefExtension<Producto>)[]
    >(
        () => {
            const acciones = crearColumnaAcciones<Producto>({
                acciones: [
                    {
                        icon: Eye,
                        label: 'Ver ficha',
                        dataAccion: 'ver',
                        onClick: (p: Producto) => void router.push(`${RUTA}/${p.id}`),
                    },
                    ...(puedeEditar
                        ? [
                              {
                                  icon: Pencil,
                                  label: 'Editar',
                                  dataAccion: 'editar',
                                  onClick: (p: Producto) => setModal({ modo: 'editar', producto: p }),
                              },
                          ]
                        : []),
                ],
                secundarias: [
                    ...(puedeEditar
                        ? [
                              {
                                  icon: Power,
                                  label: 'Activar / Desactivar',
                                  dataAccion: 'toggle-estado',
                                  disabled: (p: Producto) => p.es_archivado,
                                  onClick: (p: Producto) =>
                                      abrirConfirmacion({ tipo: 'estado', producto: p }),
                              },
                          ]
                        : []),
                    ...(puedeArchivar && puedeEditar
                        ? [
                              {
                                  icon: Archive,
                                  label: 'Archivar',
                                  dataAccion: 'archivar',
                                  disabled: (p: Producto) => p.es_archivado,
                                  onClick: (p: Producto) =>
                                      abrirConfirmacion({ tipo: 'archivar', producto: p }),
                              },
                              {
                                  icon: ArchiveRestore,
                                  label: 'Reactivar',
                                  dataAccion: 'reactivar',
                                  disabled: (p: Producto) => !p.es_archivado,
                                  onClick: (p: Producto) =>
                                      abrirConfirmacion({ tipo: 'archivar', producto: p }),
                              },
                          ]
                        : []),
                ],
            })

            return [
                {
                    accessorKey: 'sku',
                    label: 'SKU',
                    movil: 'ocultar',
                    render: (value) => (
                        <span className="font-mono text-[12.5px]">{String(value)}</span>
                    ),
                },
                {
                    accessorKey: 'nombre',
                    label: 'Nombre',
                    movil: 'critica',
                    render: (value, fila) => (
                        <button
                            type="button"
                            onClick={() => void router.push(`${RUTA}/${fila.id}`)}
                            className="text-left font-medium text-primary underline-offset-2 hover:underline"
                            title="Ver ficha"
                        >
                            {String(value)}
                        </button>
                    ),
                },
                {
                    accessorKey: 'categoria_nombre',
                    label: 'Categoría',
                    movil: 'secundaria',
                    render: (value) => (value ? String(value) : '—'),
                },
                {
                    accessorKey: 'marca_nombre',
                    label: 'Marca',
                    movil: 'secundaria',
                    render: (value) => (value ? String(value) : '—'),
                },
                {
                    id: 'caracteristicas',
                    accessorFn: (p) => p.atributos,
                    label: 'Características',
                    movil: 'secundaria',
                    render: (_v, fila) => <AtributosChips atributos={fila.atributos} />,
                },
                {
                    accessorKey: 'precio_base',
                    label: 'Precio',
                    movil: 'ocultar',
                    align: 'derecha',
                    render: (value) => formatearMoneda(Number(value)),
                },
                {
                    id: 'estado',
                    accessorFn: (p) => estadoDeProducto(p),
                    label: 'Estado',
                    movil: 'critica',
                    render: (value) => (
                        <Pildora
                            texto={TEXTO_ESTADO_PRODUCTO[value as keyof typeof TEXTO_ESTADO_PRODUCTO]}
                            tono={TONO_ESTADO_PRODUCTO[value as keyof typeof TONO_ESTADO_PRODUCTO]}
                        />
                    ),
                },
                acciones,
            ]
        },
        [puedeEditar, puedeArchivar, abrirConfirmacion, router]
    )

    // ── Toolbar — Nuevo + masivas por selección + Exportar (P5) ─────────────────
    const accionesToolbar = useMemo<ToolbarAction[]>(() => {
        const lista: ToolbarAction[] = []

        const activos = seleccionados.filter((p) => p.es_activo && !p.es_archivado)
        const inactivos = seleccionados.filter((p) => !p.es_activo && !p.es_archivado)
        const noArchivados = seleccionados.filter((p) => !p.es_archivado)
        const archivados = seleccionados.filter((p) => p.es_archivado)
        const esUnica = seleccionados.length === 1
        const unica = esUnica ? seleccionados[0] : null

        if (puedeCrear) {
            lista.push({
                id: 'nuevo',
                label: 'Nuevo producto',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                onClick: () => setModal({ modo: 'crear' }),
            })
        }
        if (puedeEditar) {
            lista.push({
                id: 'editar',
                label: 'Editar',
                icon: Pencil,
                accion: 'editar',
                variant: 'outline',
                disabled: !esUnica,
                title: !esUnica ? 'Selecciona un solo producto para editar' : undefined,
                onClick: unica
                    ? () => setModal({ modo: 'editar', producto: unica })
                    : undefined,
            })
            lista.push({
                id: 'desactivar',
                label: 'Desactivar',
                icon: PowerOff,
                accion: 'editar',
                variant: 'outline',
                disabled: activos.length === 0,
                title: activos.length === 0 ? 'Selecciona productos activos' : undefined,
                onClick:
                    activos.length > 0
                        ? () => setConfirmar({ tipo: 'estado_masivo', productos: activos, activar: false })
                        : undefined,
            })
            lista.push({
                id: 'activar',
                label: 'Activar',
                icon: Power,
                accion: 'editar',
                variant: 'outline',
                disabled: inactivos.length === 0,
                title: inactivos.length === 0 ? 'Selecciona productos inactivos' : undefined,
                onClick:
                    inactivos.length > 0
                        ? () => setConfirmar({ tipo: 'estado_masivo', productos: inactivos, activar: true })
                        : undefined,
            })
        }
        if (puedeArchivar && puedeEditar) {
            lista.push({
                id: 'archivar',
                label: 'Archivar',
                icon: Archive,
                accion: 'eliminar',
                variant: 'outline',
                disabled: noArchivados.length === 0,
                title: noArchivados.length === 0 ? 'Selecciona productos no archivados' : undefined,
                onClick:
                    noArchivados.length > 0
                        ? () => setConfirmar({ tipo: 'archivar_masivo', productos: noArchivados, archivar: true })
                        : undefined,
            })
            lista.push({
                id: 'reactivar',
                label: 'Reactivar',
                icon: ArchiveRestore,
                accion: 'editar',
                variant: 'outline',
                disabled: archivados.length === 0,
                title: archivados.length === 0 ? 'Selecciona productos archivados' : undefined,
                onClick:
                    archivados.length > 0
                        ? () => setConfirmar({ tipo: 'archivar_masivo', productos: archivados, archivar: false })
                        : undefined,
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
                    if (productos.length === 0) {
                        toast.error('No hay productos que exportar con el filtro actual.')
                        return
                    }
                    exportarProductosCsv(productos)
                },
            })
        }
        if (puedeImportar) {
            lista.push({
                id: 'importar',
                label: 'Importar CSV',
                icon: Upload,
                accion: 'importar',
                variant: 'secondary',
                onClick: () => setImportarAbierto(true),
            })
        }
        return lista
    }, [puedeCrear, puedeEditar, puedeArchivar, puedeExportar, puedeImportar, seleccionados, productos])

    usePageConfig({ info: { title: 'Productos', subtitle: 'Catálogos' }, path: RUTA, actions: accionesToolbar })

    // ── Ejecución de confirmaciones (el diálogo del kit hace toasts y cierra) ───
    const ejecutarConfirmacion = async (): Promise<{ error: string | null }> => {
        if (!confirmar) return { error: null }
        if (confirmar.tipo === 'estado_masivo') {
            const res = await toggleActivoProducto(
                confirmar.productos.map((p) => p.id),
                confirmar.activar
            )
            if (!res.success) return { error: res.error ?? 'No se pudo completar la acción.' }
            await recargar()
            limpiar()
            return { error: null }
        }
        if (confirmar.tipo === 'archivar_masivo') {
            const res = await archivarProducto(
                confirmar.productos.map((p) => p.id),
                confirmar.archivar
            )
            if (!res.success) return { error: res.error ?? 'No se pudo completar la acción.' }
            await recargar()
            limpiar()
            return { error: null }
        }
        const p = confirmar.producto
        if (confirmar.tipo === 'estado') {
            const res = await toggleActivoProducto([p.id], !p.es_activo)
            if (!res.success) return { error: res.error ?? 'No se pudo completar la acción.' }
        } else {
            const res = await archivarProducto([p.id], !p.es_archivado)
            if (!res.success) return { error: res.error ?? 'No se pudo completar la acción.' }
        }
        await recargar()
        limpiar()
        return { error: null }
    }

    const tituloConfirmacion = (() => {
        if (!confirmar) return ''
        if (confirmar.tipo === 'estado_masivo') return confirmar.activar ? 'Activar productos' : 'Desactivar productos'
        if (confirmar.tipo === 'archivar_masivo') return confirmar.archivar ? 'Archivar productos' : 'Reactivar productos'
        if (confirmar.tipo === 'estado') return confirmar.producto.es_activo ? 'Desactivar producto' : 'Activar producto'
        return confirmar.producto.es_archivado ? 'Reactivar producto' : 'Archivar producto'
    })()

    const descripcionConfirmacion = (() => {
        if (!confirmar) return ''
        if (confirmar.tipo === 'estado_masivo' || confirmar.tipo === 'archivar_masivo') {
            return `${confirmar.productos.length} producto(s) seleccionado(s).`
        }
        return `${confirmar.producto.sku} · ${confirmar.producto.nombre}`
    })()

    const esDestructivo =
        confirmar !== null &&
        (confirmar.tipo === 'archivar' ||
            (confirmar.tipo === 'archivar_masivo' && confirmar.archivar))

    if (estadoTabla === 'loading' && productos.length === 0) return <TableSkeleton />

    return (
        <div className="space-y-4">
            <ProductoFilters
                filtros={filtros}
                onFiltrosChange={(patch) => setFiltros((f) => ({ ...f, ...patch }))}
                categorias={categorias}
                marcas={marcasFiltro}
                contador={productos.length}
            />
            <DataTable
                columns={columnas}
                data={productos}
                rowKey={(p) => p.id}
                estado={estadoTabla}
                emptyMessage="Sin productos con el filtro actual"
                onRetry={() => {
                    setEstadoTabla('loading')
                    void recargar()
                }}
                enableRowSelection
                rowSelection={seleccion}
                onRowSelectionChange={onSeleccionChange}
            />

            {modal && (
                <ProductoModal
                    key={modal.modo === 'crear' ? 'nuevo' : `editar-${modal.producto.id}`}
                    modo={modal.modo}
                    producto={modal.modo === 'editar' ? modal.producto : undefined}
                    categorias={categorias}
                    onCerrar={() => setModal(null)}
                    onExito={() => {
                        setModal(null)
                        void recargar()
                    }}
                />
            )}

            <ConfirmarAccionDialog
                open={confirmar !== null}
                onOpenChange={(v) => { if (!v) setConfirmar(null) }}
                titulo={tituloConfirmacion}
                descripcion={descripcionConfirmacion}
                variant={esDestructivo ? 'destructive' : 'default'}
                successMessage={tituloConfirmacion || 'Acción completada'}
                onConfirm={ejecutarConfirmacion}
            />

            <ImportarCSVModal
                abierto={importarAbierto}
                onCerrar={() => setImportarAbierto(false)}
                onExito={() => {
                    setImportarAbierto(false)
                    void recargar()
                }}
            />
        </div>
    )
}
