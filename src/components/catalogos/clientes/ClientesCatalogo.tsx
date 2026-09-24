'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTES CATALOGO — Orquestador del listado (Guía 1.3 · Smart)
// Página DELGADA (Regla 1): estado + delegación; Toolbar vía usePageConfig.
// Modales SIEMPRE montados (Radix): ClienteModal · ConfirmarAccionDialog ·
// SuspenderClienteDialog · ReasignarVendedorDialog.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import { DataTable, Pildora, crearColumnaAcciones, useSeleccionTabla } from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import {
    Archive,
    ArchiveRestore,
    Download,
    Eye,
    Pencil,
    Plus,
    Power,
    PowerOff,
    ShieldAlert,
    ShieldCheck,
    UserCog,
} from 'lucide-react'

import { ClienteModal } from '@/components/catalogos/clientes/ClienteModal'
import { SuspenderClienteDialog } from '@/components/catalogos/clientes/SuspenderClienteDialog'
import { ReasignarVendedorDialog } from '@/components/catalogos/clientes/ReasignarVendedorDialog'
import { exportarClientesCsv } from '@/components/catalogos/clientes/exportar-clientes-csv'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import {
    ClienteFilters,
    FILTROS_DEFAULT,
    type ClienteFilterOpciones,
} from '@/components/catalogos/clientes/ClienteFilters'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import type { ToolbarAction } from '@/types/shell'
import {
    archivarClientes,
    levantarSuspensionCliente,
    listarClientes,
    toggleActivoClientes,
} from '@/lib/actions/clientes'
import {
    listarMarcasComerciales,
    listarTiposCliente,
    listarVendedores,
} from '@/lib/actions/catalogos'
import {
    TEXTO_ESTADO_CLIENTE,
    TONO_ESTADO_CLIENTE,
    estadoDeCliente,
} from '@/types/clientes'
import type { Cliente, FiltrosCliente } from '@/types/clientes'

const RUTA = '/dashboard/catalogos/clientes'

const formatearMXN = (monto: number): string =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)

type ModalEstado = { modo: 'crear' } | { modo: 'editar'; id: string } | null

type ConfirmacionPendiente =
    | { tipo: 'toggle'; ids: string[]; activo: boolean }
    | { tipo: 'archivar'; ids: string[]; archivar: boolean }
    | { tipo: 'levantar'; id: string }
    | null

export function ClientesCatalogo() {
    const router = useRouter()

    const [clientes, setClientes] = useState<Cliente[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosCliente>(FILTROS_DEFAULT)
    const [opciones, setOpciones] = useState<ClienteFilterOpciones>({
        marcas: [],
        tipos: [],
        vendedores: [],
    })

    const [modal, setModal] = useState<ModalEstado>(null)
    const [confirmar, setConfirmar] = useState<ConfirmacionPendiente>(null)
    const [suspenderDe, setSuspenderDe] = useState<{ id: string; nombre: string } | null>(null)
    const [reasignarIds, setReasignarIds] = useState<string[]>([])

    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeEditar = useCanAction(RUTA, 'editar')
    const puedeArchivar = useCanAction(RUTA, 'eliminar')
    const puedeExportar = useCanAction(RUTA, 'exportar')

    // Selección con checkboxes (patrón kit).
    const { seleccion, onSeleccionChange, seleccionados, limpiar } = useSeleccionTabla(
        clientes,
        (c) => c.id
    )

    const busqueda = filtros.busqueda
    const marca = filtros.id_marca_comercial
    const tipo = filtros.id_tipo_cliente
    const vendedor = filtros.id_vendedor_asignado
    const estadoFiltro = filtros.estado

    const obtener = useCallback(async () => {
        return listarClientes({
            busqueda,
            id_marca_comercial: marca,
            id_tipo_cliente: tipo,
            id_vendedor_asignado: vendedor,
            estado: estadoFiltro,
        })
    }, [busqueda, marca, tipo, vendedor, estadoFiltro])

    useEffect(() => {
        let activo = true
        obtener().then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setClientes(res.data ?? [])
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [obtener])

    const recargar = useCallback(async () => {
        const res = await obtener()
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setClientes(res.data ?? [])
        setEstadoTabla('idle')
    }, [obtener])

    useEffect(() => {
        let activo = true
        void Promise.all([
            listarMarcasComerciales(),
            listarTiposCliente(),
            listarVendedores(),
        ]).then(([marcas, tipos, vendedores]) => {
            if (!activo) return
            setOpciones({
                marcas: (marcas.data ?? []).map((m) => ({ valor: m.id, etiqueta: m.nombre_visible })),
                tipos: (tipos.data ?? []).map((t) => ({ valor: t.id, etiqueta: t.nombre })),
                vendedores: (vendedores.data ?? []).map((v) => ({ valor: v.id, etiqueta: v.nombre })),
            })
        })
        return () => {
            activo = false
        }
    }, [])

    // ── Columnas (PLAN §4 #7 · usuario 04 Sep) ─────────────────────────────────
    const columnas = useMemo<(ColumnDef<Cliente> & ColumnDefExtension<Cliente>)[]>(
        () => [
            {
                accessorKey: 'codigo',
                label: 'Código',
                movil: 'ocultar',
                render: (value) => <span className="font-mono text-[12.5px]">{String(value)}</span>,
            },
            {
                accessorKey: 'nombre_comercial',
                label: 'Nombre comercial',
                movil: 'critica',
                render: (value, fila) => (
                    <button
                        type="button"
                        onClick={() => router.push(`${RUTA}/${fila.id}`)}
                        className="text-left text-primary underline-offset-2 hover:underline"
                        title="Ver ficha del cliente"
                    >
                        {String(value)}
                    </button>
                ),
            },
            {
                accessorKey: 'tipo_cliente_nombre',
                label: 'Tipo',
                movil: 'secundaria',
                render: (value) => (value ? String(value) : '—'),
            },
            {
                accessorKey: 'marca_nombre',
                label: 'Marca',
                movil: 'ocultar',
                render: (value) => (value ? String(value) : '—'),
            },
            {
                accessorKey: 'vendedor_nombre',
                label: 'Vendedor',
                movil: 'ocultar',
                render: (value) => (value ? String(value) : '—'),
            },
            {
                accessorKey: 'saldo_actual',
                label: 'Saldo actual',
                movil: 'secundaria',
                render: (value) => {
                    const monto = Number(value)
                    return (
                        <span className={monto < 0 ? 'font-medium text-destructive' : 'tabular-nums'}>
                            {formatearMXN(monto)}
                        </span>
                    )
                },
            },
            {
                id: 'estado',
                accessorFn: (c) => estadoDeCliente(c),
                label: 'Estado',
                movil: 'critica',
                render: (value) => (
                    <Pildora
                        texto={TEXTO_ESTADO_CLIENTE[value as keyof typeof TEXTO_ESTADO_CLIENTE]}
                        tono={TONO_ESTADO_CLIENTE[value as keyof typeof TONO_ESTADO_CLIENTE]}
                    />
                ),
            },
        ],
        [router]
    )

    const abrirConfirmacion = useCallback(
        (accion: Exclude<ConfirmacionPendiente, null>) => {
            window.setTimeout(() => setConfirmar(accion), 160)
        },
        []
    )

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<Cliente>({
                acciones: [
                    {
                        icon: Eye,
                        label: 'Ver ficha',
                        dataAccion: 'ver',
                        onClick: (c) => router.push(`${RUTA}/${c.id}`),
                    },
                    ...(puedeEditar
                        ? [
                              {
                                  icon: Pencil,
                                  label: 'Editar',
                                  dataAccion: 'editar',
                                  onClick: (c: Cliente) => setModal({ modo: 'editar', id: c.id }),
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
                                  disabled: (c: Cliente) => c.es_archivado,
                                  onClick: (c: Cliente) =>
                                      abrirConfirmacion({
                                          tipo: 'toggle',
                                          ids: [c.id],
                                          activo: !c.es_activo,
                                      }),
                              },
                          ]
                        : []),
                    ...(puedeEditar && puedeArchivar
                        ? [
                              {
                                  icon: Archive,
                                  label: 'Archivar',
                                  dataAccion: 'archivar',
                                  disabled: (c: Cliente) => c.es_archivado,
                                  onClick: (c: Cliente) =>
                                      abrirConfirmacion({ tipo: 'archivar', ids: [c.id], archivar: true }),
                              },
                              {
                                  icon: ArchiveRestore,
                                  label: 'Reactivar',
                                  dataAccion: 'reactivar',
                                  disabled: (c: Cliente) => !c.es_archivado,
                                  onClick: (c: Cliente) =>
                                      abrirConfirmacion({ tipo: 'archivar', ids: [c.id], archivar: false }),
                              },
                          ]
                        : []),
                    ...(puedeEditar
                        ? [
                              {
                                  icon: ShieldAlert,
                                  label: 'Suspender',
                                  dataAccion: 'suspender',
                                  disabled: (c: Cliente) => c.es_archivado || c.es_suspendido,
                                  onClick: (c: Cliente) =>
                                      setSuspenderDe({ id: c.id, nombre: c.nombre_comercial }),
                              },
                              {
                                  icon: ShieldCheck,
                                  label: 'Levantar suspensión',
                                  dataAccion: 'levantar-suspension',
                                  disabled: (c: Cliente) => !c.es_suspendido,
                                  onClick: (c: Cliente) =>
                                      abrirConfirmacion({ tipo: 'levantar', id: c.id }),
                              },
                          ]
                        : []),
                ],
            }),
        [puedeEditar, puedeArchivar, abrirConfirmacion, router]
    )

    // ── Toolbar del Shell (patrón 0.9/0.10) ────────────────────────────────────
    const acciones = useMemo<ToolbarAction[]>(() => {
        const lista: ToolbarAction[] = []

        const activos = seleccionados.filter((c) => c.es_activo && !c.es_archivado)
        const inactivos = seleccionados.filter((c) => !c.es_activo && !c.es_archivado)
        const noArchivados = seleccionados.filter((c) => !c.es_archivado)
        const archivados = seleccionados.filter((c) => c.es_archivado)

        if (puedeCrear) {
            lista.push({
                id: 'nuevo',
                label: 'Nuevo cliente',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                onClick: () => setModal({ modo: 'crear' }),
            })
        }
        if (puedeEditar) {
            lista.push({
                id: 'desactivar',
                label: 'Desactivar',
                icon: PowerOff,
                accion: 'editar',
                variant: 'outline',
                disabled: activos.length === 0,
                title: activos.length === 0 ? 'Selecciona cliente(s) activos' : undefined,
                onClick:
                    activos.length > 0
                        ? () => setConfirmar({ tipo: 'toggle', ids: activos.map((c) => c.id), activo: false })
                        : undefined,
            })
            lista.push({
                id: 'activar',
                label: 'Activar',
                icon: Power,
                accion: 'editar',
                variant: 'outline',
                disabled: inactivos.length === 0,
                title: inactivos.length === 0 ? 'Selecciona cliente(s) inactivos' : undefined,
                onClick:
                    inactivos.length > 0
                        ? () => setConfirmar({ tipo: 'toggle', ids: inactivos.map((c) => c.id), activo: true })
                        : undefined,
            })
        }
        if (puedeEditar && puedeArchivar) {
            lista.push({
                id: 'archivar',
                label: 'Archivar',
                icon: Archive,
                accion: 'eliminar',
                variant: 'outline',
                disabled: noArchivados.length === 0,
                onClick:
                    noArchivados.length > 0
                        ? () => setConfirmar({ tipo: 'archivar', ids: noArchivados.map((c) => c.id), archivar: true })
                        : undefined,
            })
            lista.push({
                id: 'reactivar',
                label: 'Reactivar',
                icon: ArchiveRestore,
                accion: 'eliminar',
                variant: 'outline',
                disabled: archivados.length === 0,
                onClick:
                    archivados.length > 0
                        ? () => setConfirmar({ tipo: 'archivar', ids: archivados.map((c) => c.id), archivar: false })
                        : undefined,
            })
        }
        if (puedeEditar) {
            lista.push({
                id: 'reasignar-vendedor',
                label: 'Reasignar vendedor',
                icon: UserCog,
                accion: 'editar',
                variant: 'outline',
                disabled: seleccionados.length === 0,
                title:
                    seleccionados.length === 0
                        ? 'Selecciona cliente(s) para reasignar su vendedor'
                        : undefined,
                onClick:
                    seleccionados.length > 0
                        ? () => setReasignarIds(seleccionados.map((c) => c.id))
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
                    if (clientes.length === 0) {
                        toast.error('No hay clientes que exportar con el filtro actual.')
                        return
                    }
                    exportarClientesCsv(clientes)
                },
            })
        }
        return lista
    }, [puedeCrear, puedeEditar, puedeArchivar, puedeExportar, seleccionados, clientes])

    usePageConfig({
        info: { title: 'Clientes', subtitle: 'Catálogos' },
        path: RUTA,
        actions: acciones,
    })

    const ejecutarConfirmacion = async (): Promise<{ error: string | null }> => {
        if (!confirmar) return { error: null }
        const res =
            confirmar.tipo === 'levantar'
                ? await levantarSuspensionCliente(confirmar.id)
                : confirmar.tipo === 'toggle'
                    ? await toggleActivoClientes(confirmar.ids, confirmar.activo)
                    : await archivarClientes(confirmar.ids, confirmar.archivar)
        if (!res.success) return { error: res.error ?? 'No se pudo completar la acción.' }
        await recargar()
        limpiar()
        return { error: null }
    }

    const dialogo = (() => {
        if (!confirmar) return null
        if (confirmar.tipo === 'levantar') {
            return {
                titulo: 'Levantar suspensión',
                descripcion: 'El cliente vuelve a estar disponible para ventas y cobros.',
                confirmLabel: 'Levantar',
                variant: 'default' as 'default' | 'destructive',
                successMessage: 'Suspensión levantada',
            }
        }
        const n = confirmar.ids.length
        if (confirmar.tipo === 'toggle') {
            const texto = confirmar.activo ? 'Activar' : 'Desactivar'
            return {
                titulo: `${texto} ${n > 1 ? 'clientes' : 'cliente'}`,
                descripcion:
                    n > 1
                        ? `${n} clientes ${confirmar.activo ? 'volverán al catálogo vigente' : 'dejarán de aparecer en el catálogo vigente'}.`
                        : `${texto} el cliente seleccionado.`,
                confirmLabel: texto,
                variant: 'default' as 'default' | 'destructive',
                successMessage: n > 1 ? `Clientes ${confirmar.activo ? 'activados' : 'desactivados'}` : `Cliente ${confirmar.activo ? 'activado' : 'desactivado'}`,
            }
        }
        const archivar = confirmar.archivar
        return {
            titulo: `${archivar ? 'Archivar' : 'Reactivar'} ${n > 1 ? 'clientes' : 'cliente'}`,
            descripcion: archivar
                ? `Retiro lógico (no se elimina): ${n > 1 ? `${n} clientes saldrán` : 'el cliente sale'} del catálogo vigente. Podrás recuperarlo desde el filtro "Archivados".`
                : `${n > 1 ? `${n} clientes volverán` : 'El cliente volverá'} al catálogo vigente como activo.`,
            confirmLabel: archivar ? 'Archivar' : 'Reactivar',
            variant: (archivar ? 'destructive' : 'default') as 'default' | 'destructive',
            successMessage: n > 1
                ? archivar ? 'Clientes archivados' : 'Clientes reactivados'
                : archivar ? 'Cliente archivado' : 'Cliente reactivado',
        }
    })()

    return (
        <>
            <DataTable
                columns={[...columnas, columnaAcciones]}
                data={clientes}
                rowKey={(c) => c.id}
                estado={estadoTabla}
                onRetry={() => void recargar()}
                emptyMessage="No hay clientes con esos filtros."
                showColumnSelector
                enableRowSelection
                rowSelection={seleccion}
                onRowSelectionChange={onSeleccionChange}
                renderToolbar={() => (
                    <ClienteFilters
                        filtros={filtros}
                        onFiltrosChange={(patch) => setFiltros((prev) => ({ ...prev, ...patch }))}
                        opciones={opciones}
                        contador={clientes.length}
                    />
                )}
            />

            <ClienteModal
                open={modal !== null}
                modo={modal?.modo === 'editar' ? 'editar' : 'crear'}
                clienteId={modal?.modo === 'editar' ? modal.id : undefined}
                onOpenChange={(o) => {
                    if (!o) setModal(null)
                }}
                onSuccess={() => void recargar()}
            />

            <SuspenderClienteDialog
                open={suspenderDe !== null}
                clienteId={suspenderDe?.id ?? null}
                nombreCliente={suspenderDe?.nombre ?? ''}
                onOpenChange={(o) => {
                    if (!o) setSuspenderDe(null)
                }}
                onSuccess={() => void recargar()}
            />

            <ReasignarVendedorDialog
                open={reasignarIds.length > 0}
                ids={reasignarIds}
                onOpenChange={(o) => {
                    if (!o) setReasignarIds([])
                }}
                onSuccess={() => void recargar()}
            />

            <ConfirmarAccionDialog
                open={confirmar !== null}
                onOpenChange={(o) => {
                    if (!o) setConfirmar(null)
                }}
                titulo={dialogo?.titulo ?? ''}
                descripcion={dialogo?.descripcion ?? ''}
                confirmLabel={dialogo?.confirmLabel ?? 'Confirmar'}
                variant={dialogo?.variant ?? 'default'}
                successMessage={dialogo?.successMessage}
                onConfirm={ejecutarConfirmacion}
            />
        </>
    )
}

