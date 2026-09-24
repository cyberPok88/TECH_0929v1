'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PROVEEDORES CATALOGO — Orquestador del listado (Guía 1.1 · Parte 2 · Smart)
// Página DELGADA (Regla 1): este componente posee el estado y delega la pintura
// a hijos Dumb/Smart:
//   · ProveedorFilters (Dumb) · DataTable kit + píldoras + checkboxes
//   · ProveedorModal (Smart, 4 pestañas) · ProveedorFichaModal (Dumb) · ConfirmDialog
// Registra su Toolbar con usePageConfig (patrón 0.9/0.10): Nuevo/Exportar + el set
// de acciones de selección (Editar · Desactivar/Activar · Archivar/Reactivar),
// filtradas por RBAC y deshabilitadas con su porqué.
//
// ⚠️ LOS MODALES SE MANTIENEN MONTADOS (controlados por `open`): desmontarlos al
// cerrar deja a Radix a mitad de su transición de salida (overlay/pointer-lock
// colgado → "página congelada hasta recargar"). Mismo contrato de CatalogoModalBase.
//
// El deep link ?proveedor={id} abre la ficha al montar (mapa §3) y limpia el query.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Archive, ArchiveRestore, Download, Eye, Pencil, Plus, Power, PowerOff } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import {
    DataTable,
    Pildora,
    crearColumnaAcciones,
    useSeleccionTabla,
} from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import { ProveedorFilters, FILTROS_DEFAULT } from '@/components/catalogos/proveedores/ProveedorFilters'
import { ProveedorModal } from '@/components/catalogos/proveedores/ProveedorModal'
import { ProveedorFichaModal } from '@/components/catalogos/proveedores/ProveedorFichaModal'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { exportarProveedoresCsv } from '@/components/catalogos/proveedores/exportar-proveedores-csv'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { toast } from 'sonner'
import type { ToolbarAction } from '@/types/shell'
import {
    archivarProveedor,
    cambiarEstadoProveedor,
    listarProveedores,
    obtenerProveedor,
} from '@/lib/actions/proveedores'
import { listarRegimenesFiscalesActivos } from '@/lib/actions/sat'
import type { RegimenFiscalOpcion } from '@/lib/actions/sat'
import {
    TEXTO_ESTADO,
    TEXTO_TIPO,
    TONO_ESTADO,
    TONO_TIPO,
    estadoDeProveedor,
} from '@/types/proveedores'
import type { FiltrosProveedor, Proveedor, TipoProveedor } from '@/types/proveedores'

const RUTA = '/dashboard/catalogos/proveedores'

type ModalEstado =
    | { modo: 'crear' }
    | { modo: 'editar'; proveedor: Proveedor }
    | null

type ConfirmacionPendiente =
    | { tipo: 'estado'; proveedor: Proveedor }
    | { tipo: 'estado_masivo'; proveedores: Proveedor[]; activar: boolean }
    | { tipo: 'archivar'; proveedor: Proveedor }
    | { tipo: 'archivar_masivo'; proveedores: Proveedor[]; archivar: boolean }
    | null

export function ProveedoresCatalogo() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosProveedor>(FILTROS_DEFAULT)
    const [regimenes, setRegimenes] = useState<RegimenFiscalOpcion[]>([])

    const [modal, setModal] = useState<ModalEstado>(null)
    const [ficha, setFicha] = useState<Proveedor | null>(null)
    const [confirmar, setConfirmar] = useState<ConfirmacionPendiente>(null)

    const puedeEditar = useCanAction(RUTA, 'editar')
    const puedeArchivar = useCanAction(RUTA, 'eliminar')
    const puedeExportar = useCanAction(RUTA, 'exportar')

    // ── Datos (server) ──────────────────────────────────────────────────────────
    const busqueda = filtros.busqueda
    const tipoFiltro = filtros.tipo
    const estadoFiltro = filtros.estado

    const obtener = useCallback(async () => {
        return listarProveedores({ busqueda, tipo: tipoFiltro, estado: estadoFiltro })
    }, [busqueda, tipoFiltro, estadoFiltro])

    // Carga inicial + recarga por filtro: setState dentro del .then() (regla
    // react-hooks/set-state-in-effect — callback asíncrono permitido).
    useEffect(() => {
        let activo = true
        obtener().then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setProveedores(res.data ?? [])
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
        setProveedores(res.data ?? [])
        setEstadoTabla('idle')
    }, [obtener])

    // Régimenes para el Select fiscal del modal (una carga).
    useEffect(() => {
        void listarRegimenesFiscalesActivos().then((r) => {
            if (r.success) setRegimenes(r.data ?? [])
        })
    }, [])

    // ── Deep link ?proveedor={id} → abre la ficha y limpia el query ────────────
    const profundoProcesado = useRef<string | null>(null)
    useEffect(() => {
        const id = searchParams.get('proveedor')
        if (!id || profundoProcesado.current === id) return
        profundoProcesado.current = id
        void obtenerProveedor(id).then((res) => {
            if (res.success && res.data) setFicha(res.data)
        })
        router.replace(RUTA, { scroll: false })
    }, [searchParams, router])

    // ── Selección (checkboxes · PLAN §4 — usuario 03 Sep) ─────────────────────
    const { seleccion, onSeleccionChange, seleccionados, limpiar } = useSeleccionTabla(
        proveedores,
        (p) => p.id
    )

    // ── Columnas (PLAN §4 #7) ───────────────────────────────────────────────────
    const columnas = useMemo<(ColumnDef<Proveedor> & ColumnDefExtension<Proveedor>)[]>(
        () => [
            {
                accessorKey: 'codigo',
                label: 'Código',
                movil: 'ocultar',
                render: (value) => (
                    <span className="font-mono text-[12.5px]">{String(value)}</span>
                ),
            },
            {
                accessorKey: 'nombre_comercial',
                label: 'Nombre comercial',
                movil: 'critica',
                render: (value, fila) => (
                    <button
                        type="button"
                        onClick={() => setFicha(fila)}
                        className="text-left text-primary underline-offset-2 hover:underline"
                        title="Ver ficha"
                    >
                        {String(value)}
                    </button>
                ),
            },
            { accessorKey: 'rfc', label: 'RFC', movil: 'secundaria' },
            {
                accessorKey: 'tipo',
                label: 'Tipo',
                movil: 'secundaria',
                render: (value) => (
                    <Pildora
                        texto={TEXTO_TIPO[value as TipoProveedor]}
                        tono={TONO_TIPO[value as TipoProveedor]}
                    />
                ),
            },
            {
                id: 'estado',
                accessorFn: (p) => estadoDeProveedor(p),
                label: 'Estado',
                movil: 'critica',
                render: (value) => (
                    <Pildora
                        texto={TEXTO_ESTADO[value as keyof typeof TEXTO_ESTADO]}
                        tono={TONO_ESTADO[value as keyof typeof TONO_ESTADO]}
                    />
                ),
            },
        ],
        []
    )

    // ── Abrir confirmación desde las acciones INLINE (menú ⋮) ──────────────────
    // ⚠️ Radix: abrir un Dialog en el MISMO tick en que el DropdownMenu hace su
    // transición de salida deja su overlay fantasma (página "congelada"). El menú
    // tarda ~150ms en desmontar; se difiere la apertura del diálogo ese lapso
    // (la Toolbar no pasa por el menú → abre directo y funciona).
    const abrirConfirmacion = useCallback(
        (accion: Exclude<ConfirmacionPendiente, null>) => {
            window.setTimeout(() => setConfirmar(accion), 160)
        },
        []
    )

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<Proveedor>({
                acciones: [
                    {
                        icon: Eye,
                        label: 'Ver ficha',
                        dataAccion: 'ver',
                        onClick: (p) => setFicha(p),
                    },
                    ...(puedeEditar
                        ? [
                              {
                                  icon: Pencil,
                                  label: 'Editar',
                                  dataAccion: 'editar',
                                  onClick: (p: Proveedor) => setModal({ modo: 'editar', proveedor: p }),
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
                                  disabled: (p: Proveedor) => p.es_archivado,
                                  onClick: (p: Proveedor) =>
                                      abrirConfirmacion({ tipo: 'estado', proveedor: p }),
                              },
                              {
                                  icon: Archive,
                                  label: 'Archivar',
                                  dataAccion: 'archivar',
                                  disabled: (p: Proveedor) => p.es_archivado,
                                  onClick: (p: Proveedor) =>
                                      abrirConfirmacion({ tipo: 'archivar', proveedor: p }),
                              },
                          ]
                        : []),
                    ...(puedeArchivar && puedeEditar
                        ? [
                              {
                                  icon: ArchiveRestore,
                                  label: 'Reactivar',
                                  dataAccion: 'reactivar',
                                  disabled: (p: Proveedor) => !p.es_archivado,
                                  onClick: (p: Proveedor) =>
                                      abrirConfirmacion({ tipo: 'archivar', proveedor: p }),
                              },
                          ]
                        : []),
                ],
            }),
        [puedeEditar, puedeArchivar, abrirConfirmacion]
    )

    // ── Toolbar del Shell — acciones con selección (patrón 0.9/0.10) ───────────
    // El set fijo se inyecta SIEMPRE (cuando hay permiso), deshabilitado con su
    // porqué en el `title`. La Toolbar (0.6/0.7) filtra por RBAC de forma central.
    const acciones = useMemo<ToolbarAction[]>(() => {
        const lista: ToolbarAction[] = []

        const activos = seleccionados.filter((p) => p.es_activo && !p.es_archivado)
        const inactivos = seleccionados.filter((p) => !p.es_activo && !p.es_archivado)
        const noArchivados = seleccionados.filter((p) => !p.es_archivado)
        const archivados = seleccionados.filter((p) => p.es_archivado)
        const esUnica = seleccionados.length === 1
        const unica = esUnica ? seleccionados[0] : null

        if (puedeEditar) {
            lista.push({
                id: 'nuevo',
                label: 'Nuevo proveedor',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                onClick: () => setModal({ modo: 'crear' }),
            })
            lista.push({
                id: 'editar',
                label: 'Editar',
                icon: Pencil,
                accion: 'editar',
                variant: 'outline',
                disabled: !esUnica,
                title: !esUnica ? 'Selecciona un solo proveedor para editar' : undefined,
                onClick: unica
                    ? () => setModal({ modo: 'editar', proveedor: unica })
                    : undefined,
            })
            lista.push({
                id: 'desactivar',
                label: 'Desactivar',
                icon: PowerOff,
                accion: 'editar',
                variant: 'outline',
                disabled: activos.length === 0,
                title:
                    activos.length === 0
                        ? 'Selecciona proveedor(es) activos para desactivarlos'
                        : undefined,
                onClick:
                    activos.length > 0
                        ? () =>
                              setConfirmar({
                                  tipo: 'estado_masivo',
                                  proveedores: activos,
                                  activar: false,
                              })
                        : undefined,
            })
            lista.push({
                id: 'activar',
                label: 'Activar',
                icon: Power,
                accion: 'editar',
                variant: 'outline',
                disabled: inactivos.length === 0,
                title:
                    inactivos.length === 0
                        ? 'Selecciona proveedor(es) inactivos para activarlos'
                        : undefined,
                onClick:
                    inactivos.length > 0
                        ? () =>
                              setConfirmar({
                                  tipo: 'estado_masivo',
                                  proveedores: inactivos,
                                  activar: true,
                              })
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
                title:
                    noArchivados.length === 0
                        ? 'Selecciona proveedor(es) no archivados para archivarlos'
                        : undefined,
                onClick:
                    noArchivados.length > 0
                        ? () =>
                              setConfirmar({
                                  tipo: 'archivar_masivo',
                                  proveedores: noArchivados,
                                  archivar: true,
                              })
                        : undefined,
            })
            lista.push({
                id: 'reactivar',
                label: 'Reactivar',
                icon: ArchiveRestore,
                accion: 'editar',
                variant: 'outline',
                disabled: archivados.length === 0,
                title:
                    archivados.length === 0
                        ? 'Selecciona proveedor(es) archivados para reactivarlos'
                        : undefined,
                onClick:
                    archivados.length > 0
                        ? () =>
                              setConfirmar({
                                  tipo: 'archivar_masivo',
                                  proveedores: archivados,
                                  archivar: false,
                              })
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
                    if (proveedores.length === 0) {
                        toast.error('No hay proveedores que exportar con el filtro actual.')
                        return
                    }
                    exportarProveedoresCsv(proveedores)
                },
            })
        }
        return lista
    }, [puedeEditar, puedeArchivar, puedeExportar, seleccionados, proveedores])

    usePageConfig({
        info: { title: 'Proveedores', subtitle: 'Catálogos' },
        path: RUTA,
        actions: acciones,
    })

    // ── Confirmaciones — ConfirmarAccionDialog (Dialog local, NO kit AlertDialog) ─
    // El AlertDialogAction del kit cierra solo a mitad de su animación y dejaba el
    // overlay colgado en este CRUD; el Dialog local (misma mecánica que
    // ProveedorModal) cierra limpio por `open` → la página sigue operativa.
    // Aquí solo se ejecuta la acción; el cierre y los toasts viven en el diálogo.
    const ejecutarConfirmacion = async (): Promise<{ error: string | null }> => {
        if (!confirmar) return { error: null }
        if (confirmar.tipo === 'estado_masivo') {
            const resultados = await Promise.all(
                confirmar.proveedores.map((p) => cambiarEstadoProveedor(p.id, confirmar.activar))
            )
            const fallo = resultados.find((r) => !r.success)
            if (fallo) return { error: fallo.error ?? 'No se pudo completar la acción.' }
            await recargar()
            limpiar()
            return { error: null }
        }
        if (confirmar.tipo === 'archivar_masivo') {
            const resultados = await Promise.all(
                confirmar.proveedores.map((p) => archivarProveedor(p.id, confirmar.archivar))
            )
            const fallo = resultados.find((r) => !r.success)
            if (fallo) return { error: fallo.error ?? 'No se pudo completar la acción.' }
            await recargar()
            limpiar()
            return { error: null }
        }

        const p = confirmar.proveedor
        const res =
            confirmar.tipo === 'estado'
                ? await cambiarEstadoProveedor(p.id, !p.es_activo)
                : await archivarProveedor(p.id, !p.es_archivado)
        if (!res.success) return { error: res.error ?? 'No se pudo completar la acción.' }
        await recargar()
        return { error: null }
    }

    // Texto/variante del diálogo según la acción pendiente (individual o masiva).
    const dialogo = (() => {
        if (!confirmar) return null
        switch (confirmar.tipo) {
            case 'estado_masivo':
                return confirmar.activar
                    ? {
                          titulo: 'Activar proveedores',
                          descripcion: `${confirmar.proveedores.length} proveedores volverán al catálogo vigente.`,
                          confirmLabel: 'Activar',
                          variant: 'default' as const,
                          successMessage: 'Proveedores activados',
                      }
                    : {
                          titulo: 'Desactivar proveedores',
                          descripcion: `${confirmar.proveedores.length} proveedores dejarán de aparecer en el catálogo vigente. Podrás activarlos desde "Todos".`,
                          confirmLabel: 'Desactivar',
                          variant: 'default' as const,
                          successMessage: 'Proveedores desactivados',
                      }
            case 'archivar_masivo':
                return confirmar.archivar
                    ? {
                          titulo: 'Archivar proveedores',
                          descripcion: `${confirmar.proveedores.length} proveedores saldrán del catálogo vigente (retiro lógico — no se elimina). Podrás recuperarlos desde el filtro "Archivados".`,
                          confirmLabel: 'Archivar',
                          variant: 'destructive' as const,
                          successMessage: 'Proveedores archivados',
                      }
                    : {
                          titulo: 'Reactivar proveedores',
                          descripcion: `${confirmar.proveedores.length} proveedores volverán al catálogo vigente como activos.`,
                          confirmLabel: 'Reactivar',
                          variant: 'default' as const,
                          successMessage: 'Proveedores reactivados',
                      }
            case 'estado':
                return confirmar.proveedor.es_activo
                    ? {
                          titulo: 'Desactivar proveedor',
                          descripcion: `${confirmar.proveedor.nombre_comercial} dejará de aparecer en el catálogo vigente. Podrás activarlo desde "Todos".`,
                          confirmLabel: 'Desactivar',
                          variant: 'default' as const,
                          successMessage: 'Proveedor desactivado',
                      }
                    : {
                          titulo: 'Activar proveedor',
                          descripcion: `${confirmar.proveedor.nombre_comercial} volverá al catálogo vigente.`,
                          confirmLabel: 'Activar',
                          variant: 'default' as const,
                          successMessage: 'Proveedor activado',
                      }
            case 'archivar':
                return confirmar.proveedor.es_archivado
                    ? {
                          titulo: 'Reactivar proveedor',
                          descripcion: `${confirmar.proveedor.nombre_comercial} volverá al catálogo vigente como activo.`,
                          confirmLabel: 'Reactivar',
                          variant: 'default' as const,
                          successMessage: 'Proveedor reactivado',
                      }
                    : {
                          titulo: 'Archivar proveedor',
                          descripcion: `${confirmar.proveedor.nombre_comercial} saldrá del catálogo vigente (retiro lógico — no se elimina). Podrás recuperarlo desde el filtro "Archivados".`,
                          confirmLabel: 'Archivar',
                          variant: 'destructive' as const,
                          successMessage: 'Proveedor archivado',
                      }
            default:
                return null
        }
    })()

    const cerrarModal = (abierto: boolean) => {
        if (!abierto) setModal(null)
    }

    const cerrarFicha = (abierto: boolean) => {
        if (!abierto) setFicha(null)
    }

    return (
        <div className="flex flex-col gap-4">
            <ProveedorFilters
                filtros={filtros}
                onFiltrosChange={(patch) => setFiltros((f) => ({ ...f, ...patch }))}
                contador={proveedores.length}
                disabled={estadoTabla === 'loading'}
            />

            <DataTable<Proveedor>
                columns={[...columnas, columnaAcciones]}
                data={proveedores}
                rowKey={(p) => p.id}
                estado={estadoTabla}
                emptyMessage="Sin proveedores para este filtro"
                onRetry={() => void recargar()}
                defaultVisibleColumns={['codigo', 'nombre_comercial', 'rfc', 'tipo', 'estado']}
                enableRowSelection
                rowSelection={seleccion}
                onRowSelectionChange={onSeleccionChange}
            />

            {/* ⚠️ INSTANCIA ESTABLE (sin key dinámico): cambiar `key` o desmontar al
                cerrar interrumpe la animación de salida de Radix y deja el overlay
                fantasma (página "congelada"). El ProveedorModal resetea solo por
                firma (crear/editar-{id}) al abrir. */}
            <ProveedorModal
                open={modal !== null}
                modo={modal?.modo === 'editar' ? 'editar' : 'crear'}
                proveedor={modal?.modo === 'editar' ? modal.proveedor : null}
                regimenes={regimenes}
                onOpenChange={cerrarModal}
                onSuccess={() => void recargar()}
            />

            <ProveedorFichaModal
                proveedor={ficha}
                regimenes={regimenes}
                open={ficha !== null}
                onOpenChange={cerrarFicha}
                onEditar={(p) => {
                    setFicha(null)
                    setModal({ modo: 'editar', proveedor: p })
                }}
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
        </div>
    )
}
