'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTAS COMPRA CATALOGO — Listado del módulo (Guía 1.4 · rediseño · Smart)
// Página delgada + estado + delegación · Toolbar vía usePageConfig.
// Paginación SERVIDOR. Acciones por fila: Ver · Editar (por recibir sin pagos) ·
// Registrar pago · Cancelar (reglas del rediseño). Dialogs/modal siempre montados.
//
// FIX VF 05 Sep 2026 (actualizar-guia):
//  1. Selección con CHECKBOXES (useSeleccionTabla · patrón 1.1/1.2).
//  2. Toolbar ESPEJO de las acciones inline sobre la selección (Editar/Pagar con
//     1 fila · Cancelar masiva con motivo único) + Nueva/Exportar.
//  3. Apertura DIFERIDA 160 ms de diálogos desde el menú ⋮ — Radix: abrir un
//     Dialog en el MISMO tick del cierre del DropdownMenu deja su overlay fantasma
//     (página "congelada"); la toolbar no pasa por el menú → abre directo.
//  4. Columna Estado (Cancelada / Por recibir / Recibida) — una nota cancelada se
//     ve Cancelada en el listado y su columna Pago muestra «—» (ya no es exigible).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Pencil, Plus, Banknote, Ban, Eye, Download } from 'lucide-react'

import { DataTable, Pildora, crearColumnaAcciones, useSeleccionTabla } from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import type { ToolbarAction } from '@/types/shell'
import { listarNotasCompra, listarNotasCompraParaExportar, obtenerNotaCompra } from '@/lib/actions/notas-compra'
import { listarProveedoresActivos } from '@/lib/actions/proveedores'
import { NotaCompraFilters, FILTROS_NOTAS_DEFAULT } from '@/components/compras/NotaCompraFilters'
import { NotaCompraModal } from '@/components/compras/NotaCompraModal'
import { RegistrarPagoNotaDialog } from '@/components/compras/RegistrarPagoNotaDialog'
import { CancelarNotaCompraDialog } from '@/components/compras/CancelarNotaCompraDialog'
import { exportarNotasCompraCsv } from '@/components/compras/exportar-notas-compra-csv'
import type { FiltrosNotaCompra, NotaCompra, NotaCompraDetalle } from '@/types/notas-compra'
import {
    TEXTO_ESTADO_FISICO,
    TEXTO_ESTADO_PAGO_NOTA,
    TEXTO_ORIGEN_NOTA,
    TONO_ESTADO_FISICO,
    TONO_ESTADO_PAGO_NOTA,
} from '@/types/notas-compra'

const RUTA = '/dashboard/compras'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

function formatearFecha(fecha: string): string {
    const [a, m, d] = fecha.split('-')
    return a && m && d ? `${d}/${m}/${a}` : fecha
}

type DialogoNota =
    | { tipo: 'pago'; nota: NotaCompra }
    | { tipo: 'cancelar'; notas: NotaCompra[] }
    | null

export function NotasCompraCatalogo() {
    const router = useRouter()

    const [notas, setNotas] = useState<NotaCompra[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosNotaCompra>(FILTROS_NOTAS_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [proveedores, setProveedores] = useState<{ valor: string; etiqueta: string }[]>([])
    const [modal, setModal] = useState<{ modo: 'crear' } | { modo: 'editar'; nota: NotaCompraDetalle } | null>(null)
    const [dialogo, setDialogo] = useState<DialogoNota>(null)

    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeEditar = useCanAction(RUTA, 'editar')
    const puedeEliminar = useCanAction(RUTA, 'eliminar')
    const puedeExportar = useCanAction(RUTA, 'exportar')

    // Opciones del filtro de proveedor (una carga — activos).
    useEffect(() => {
        let activo = true
        void listarProveedoresActivos().then((res) => {
            if (!activo || !res.success) return
            setProveedores(
                (res.data ?? []).map((p) => ({ valor: p.id, etiqueta: `${p.codigo} — ${p.nombre_comercial}` }))
            )
        })
        return () => {
            activo = false
        }
    }, [])

    // Carga de página (servidor) — setState solo en continuación async.
    useEffect(() => {
        let activo = true
        void listarNotasCompra(filtros, pagina, tamano).then((res) => {
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
        const res = await listarNotasCompra(filtros, pagina, tamano)
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setNotas(res.data ?? [])
        setTotal(res.total ?? 0)
        setEstadoTabla('idle')
    }, [filtros, pagina, tamano])

    // ── Selección (checkboxes · FIX VF 05 Sep — patrón 1.1/1.2) ────────────────
    const { seleccion, onSeleccionChange, seleccionados, limpiar } = useSeleccionTabla(
        notas,
        (n) => n.id
    )

    // La selección vive en la página actual (paginación servidor): se limpia en los
    // handlers de cambio de página/filtros (no en effects — regla del repo) para que
    // el header-checkbox no arrastre claves huérfanas.

    const manejarFiltros = useCallback((patch: Partial<FiltrosNotaCompra>) => {
        setFiltros((prev) => ({ ...prev, ...patch }))
        setPagina(1)
        limpiar()
    }, [limpiar])

    const totalPaginas = Math.max(1, Math.ceil(total / tamano))

    const editable = (n: NotaCompra): boolean =>
        !n.es_cancelada && n.estado_fisico === 'por_recibir' && n.saldo_pendiente === n.total
    const pagable = (n: NotaCompra): boolean => !n.es_cancelada && n.saldo_pendiente > 0
    const cancelable = (n: NotaCompra): boolean =>
        !n.es_cancelada && n.estado_fisico === 'por_recibir' && n.saldo_pendiente === n.total

    // ── Apertura de diálogos: directa (toolbar) vs diferida (menú ⋮) ────────────
    // FIX VF 05 Sep — overlay fantasma: Radix, al abrir un Dialog en el MISMO tick
    // en que el DropdownMenu ⋮ cierra (~150ms), deja su overlay colgado (página
    // "congelada"). Las acciones del menú difieren 160ms; la toolbar NO pasa por el
    // menú → abre directo y funciona (patrón 1.1/1.2).
    const cargarEdicion = useCallback((n: NotaCompra) => {
        void obtenerNotaCompra(n.id).then((res) => {
            if (!res.success || !res.data) {
                toast.error(res.error ?? 'No se pudo abrir la nota.')
                return
            }
            setModal({ modo: 'editar', nota: res.data })
        })
    }, [])

    const abrirDiferido = useCallback((fn: () => void) => {
        window.setTimeout(fn, 160)
    }, [])

    const abrirEditar = useCallback(
        (n: NotaCompra) => abrirDiferido(() => cargarEdicion(n)),
        [abrirDiferido, cargarEdicion]
    )

    const abrirPago = useCallback(
        (n: NotaCompra) => abrirDiferido(() => setDialogo({ tipo: 'pago', nota: n })),
        [abrirDiferido]
    )

    const abrirCancelar = useCallback(
        (notasSeleccion: NotaCompra[]) =>
            abrirDiferido(() => setDialogo({ tipo: 'cancelar', notas: notasSeleccion })),
        [abrirDiferido]
    )

    // Columna de acciones (Ver · ⋮ Editar/Pagar/Cancelar).
    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<NotaCompra>({
                acciones: [
                    {
                        icon: Eye,
                        label: 'Ver',
                        dataAccion: 'ver',
                        onClick: (n) => router.push(`${RUTA}/${n.id}`),
                    },
                ],
                secundarias: [
                    ...(puedeEditar
                        ? [
                              {
                                  icon: Pencil,
                                  label: 'Editar',
                                  dataAccion: 'editar',
                                  disabled: (n: NotaCompra) => !editable(n),
                                  onClick: (n: NotaCompra) => abrirEditar(n),
                              },
                              {
                                  icon: Banknote,
                                  label: 'Registrar pago',
                                  dataAccion: 'registrar-pago',
                                  disabled: (n: NotaCompra) => !pagable(n),
                                  onClick: (n: NotaCompra) => abrirPago(n),
                              },
                          ]
                        : []),
                    ...(puedeEliminar
                        ? [
                              {
                                  icon: Ban,
                                  label: 'Cancelar nota',
                                  dataAccion: 'cancelar',
                                  variant: 'destructive' as const,
                                  disabled: (n: NotaCompra) => !cancelable(n),
                                  onClick: (n: NotaCompra) => abrirCancelar([n]),
                              },
                          ]
                        : []),
                ],
            }),
        [router, puedeEditar, puedeEliminar, abrirEditar, abrirPago, abrirCancelar]
    )

    const columnas = useMemo<(ColumnDef<NotaCompra> & ColumnDefExtension<NotaCompra>)[]>(
        () => [
            {
                accessorKey: 'folio',
                label: 'Folio',
                movil: 'critica',
                render: (valor) => <span className="font-mono text-xs tabular-nums">{String(valor)}</span>,
            },
            {
                id: 'estado',
                accessorFn: (n) => (n.es_cancelada ? 'cancelada' : n.estado_fisico),
                label: 'Estado',
                movil: 'critica',
                render: (_valor, fila) =>
                    fila.es_cancelada ? (
                        <Pildora texto="Cancelada" tono="peligro" />
                    ) : (
                        <Pildora
                            texto={TEXTO_ESTADO_FISICO[fila.estado_fisico]}
                            tono={TONO_ESTADO_FISICO[fila.estado_fisico]}
                        />
                    ),
            },
            {
                accessorKey: 'fecha_nota',
                label: 'Fecha',
                movil: 'ocultar',
                render: (valor) => <span className="tabular-nums">{formatearFecha(String(valor))}</span>,
            },
            {
                accessorKey: 'proveedor_nombre',
                label: 'Proveedor',
                movil: 'secundaria',
                render: (_valor, fila) => (
                    <span className="block min-w-0">
                        <span className="block truncate">{fila.proveedor_nombre ?? '—'}</span>
                        {fila.proveedor_codigo && (
                            <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
                                {fila.proveedor_codigo}
                            </span>
                        )}
                    </span>
                ),
            },
            {
                accessorKey: 'origen',
                label: 'Origen',
                movil: 'ocultar',
                render: (valor) => (
                    <span className="text-muted-foreground">
                        {TEXTO_ORIGEN_NOTA[valor as keyof typeof TEXTO_ORIGEN_NOTA] ?? String(valor)}
                    </span>
                ),
            },
            {
                accessorKey: 'estado_pago_clave',
                label: 'Pago',
                movil: 'secundaria',
                render: (_valor, fila) =>
                    fila.es_cancelada ? (
                        <span className="text-muted-foreground">—</span>
                    ) : (
                        <Pildora
                            texto={
                                fila.estado_pago_clave
                                    ? TEXTO_ESTADO_PAGO_NOTA[fila.estado_pago_clave]
                                    : (fila.estado_pago_nombre ?? '—')
                            }
                            tono={
                                fila.estado_pago_clave
                                    ? TONO_ESTADO_PAGO_NOTA[fila.estado_pago_clave]
                                    : 'neutro'
                            }
                        />
                    ),
            },
            {
                accessorKey: 'total',
                label: 'Total',
                align: 'derecha',
                movil: 'ocultar',
                render: (_valor, fila) => (
                    <span className="font-mono text-xs tabular-nums">{formatearMXN(fila.total)}</span>
                ),
            },
            {
                accessorKey: 'saldo_pendiente',
                label: 'Saldo',
                align: 'derecha',
                movil: 'ocultar',
                render: (_valor, fila) => (
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatearMXN(fila.saldo_pendiente)}
                    </span>
                ),
            },
            columnaAcciones,
        ],
        [columnaAcciones]
    )

    const filtrosBarra = useMemo(
        () => (
            <NotaCompraFilters
                filtros={filtros}
                onFiltrosChange={manejarFiltros}
                proveedores={proveedores}
                contador={total}
            />
        ),
        [filtros, manejarFiltros, proveedores, total]
    )

    // ── Toolbar — acciones de selección ESPEJO de las inline (FIX VF 05 Sep) ────
    // Nueva + Exportar siempre (según permiso). Editar/Registrar pago exigen
    // EXACTAMENTE 1 seleccionada y habilitada; Cancelar acepta la selección de
    // notas cancelables (motivo único en el diálogo). La toolbar NO pasa por el
    // menú ⋮ → abre los diálogos directo (sin el delay de 160ms).
    const acciones = useMemo<ToolbarAction[]>(() => {
        const lista: ToolbarAction[] = []
        const unica = seleccionados.length === 1 ? seleccionados[0] : null
        const cancelables = seleccionados.filter(cancelable)

        if (puedeCrear) {
            lista.push({
                id: 'nuevo',
                label: 'Nueva nota de compra',
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
                disabled: !unica || !editable(unica),
                title:
                    !unica
                        ? 'Selecciona una sola nota para editar'
                        : !editable(unica)
                          ? 'Solo se editan notas por recibir y sin pagos'
                          : undefined,
                onClick: unica ? () => cargarEdicion(unica) : undefined,
            })
            lista.push({
                id: 'pagar',
                label: 'Registrar pago',
                icon: Banknote,
                accion: 'editar',
                variant: 'outline',
                disabled: !unica || !pagable(unica),
                title:
                    !unica
                        ? 'Selecciona una sola nota para registrar su pago'
                        : !pagable(unica)
                          ? 'La nota no tiene saldo pendiente'
                          : undefined,
                onClick: unica ? () => setDialogo({ tipo: 'pago', nota: unica }) : undefined,
            })
        }
        if (puedeEliminar) {
            lista.push({
                id: 'cancelar',
                label: 'Cancelar nota',
                icon: Ban,
                accion: 'eliminar',
                variant: 'outline',
                disabled: cancelables.length === 0,
                title:
                    cancelables.length === 0
                        ? 'Selecciona nota(s) por recibir y sin pagos para cancelarlas'
                        : undefined,
                onClick:
                    cancelables.length > 0
                        ? () => setDialogo({ tipo: 'cancelar', notas: cancelables })
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
                    void listarNotasCompraParaExportar(filtros).then((res) => {
                        if (!res.success) {
                            toast.error(res.error ?? 'No se pudo exportar.')
                            return
                        }
                        if ((res.data ?? []).length === 0) {
                            toast.error('No hay notas que exportar con el filtro actual.')
                            return
                        }
                        exportarNotasCompraCsv(res.data ?? [])
                    })
                },
            })
        }
        return lista
    }, [puedeCrear, puedeEditar, puedeEliminar, puedeExportar, filtros, seleccionados, cargarEdicion])

    usePageConfig({
        info: { title: 'Notas de compra', subtitle: 'Compras' },
        path: RUTA,
        actions: acciones,
        filtros: filtrosBarra,
    })

    const cerrarDialogo = (abierto: boolean) => {
        if (!abierto) setDialogo(null)
    }

    const trasGuardado = () => {
        void recargar()
        limpiar()
    }

    return (
        <>
            <DataTable<NotaCompra>
                columns={columnas}
                data={notas}
                rowKey={(n) => n.id}
                estado={estadoTabla}
                emptyMessage="No hay notas de compra registradas."
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
            />
            <NotaCompraModal
                open={modal !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setModal(null)
                }}
                modo={modal?.modo === 'editar' ? 'editar' : 'crear'}
                nota={modal?.modo === 'editar' ? modal.nota : null}
                onGuardado={() => {
                    void recargar()
                }}
            />
            <RegistrarPagoNotaDialog
                open={dialogo?.tipo === 'pago'}
                onOpenChange={cerrarDialogo}
                nota={dialogo?.tipo === 'pago' ? dialogo.nota : null}
                onGuardado={trasGuardado}
            />
            <CancelarNotaCompraDialog
                open={dialogo?.tipo === 'cancelar'}
                onOpenChange={cerrarDialogo}
                notas={dialogo?.tipo === 'cancelar' ? dialogo.notas : null}
                onGuardado={trasGuardado}
            />
        </>
    )
}
