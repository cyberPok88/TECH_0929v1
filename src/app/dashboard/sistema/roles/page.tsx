'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD ROLES + EDITOR DE PERMISOS — Guía 0.10 · Parte 5 (página)
// Integra: RoleFilters + DataTable + selección + RoleModal + editor
// (lista ↔ editor en la misma ruta) + ConfirmDialog. El Toolbar recibe el
// onClick de "Nuevo rol" vía usePageConfig.
//
// ⭐ FIX patrón 0.9 (react-hooks/set-state-in-effect): la carga inicial se
// dispara desde el useEffect con el setState DENTRO del .then() del fetch
// (callback asíncrono — permitido). recargar() solo lo invocan handlers.
//
// ⭐ Gate del dueño: es_admin_principal viaja en la sesión (ANEXIÓN 0.4), así que
// la página lo lee del store con useSoloDueno() (helper cliente, Parte 3). La
// defensa real está en eliminarRol() (servidor).
//
// ⭐ MEJORA 20 Ago 2026 — ACCIONES EN AMBOS LADOS Y SIEMPRE VISIBLES: las
// inline por fila (acceso rápido, patrón 0.9) se conservan, y la Toolbar del
// Shell muestra SIEMPRE Editar / Permisos / Duplicar / Eliminar — deshabilitadas
// hasta seleccionar (title explica qué falta). Con UNA fila se activan según
// sus capas; con VARIAS, Eliminar masivo (solo dueño). Eliminar NUNCA aparece
// para roles de semilla (es_sistema O clave en PERMISOS_SEMILLA — los 7 de la
// 0.4 no se eliminan; la defensa real también está en eliminarRol servidor).
// En la vista editor, la Toolbar muestra Volver / Restablecer a semilla /
// Guardar permisos, que disparan el editor vía handle (onReady).
//
// ⭐ ALINEACIÓN 02 Sep 2026:
//  · Selección UNIFORME con useSeleccionTabla (0.8 · B6) — adiós Record manual.
//  · Acciones por fila con crearColumnaAcciones (0.8 · B5) — adiós
//    renderRowActions/ProtectedAction; RBAC con useCanAction + useSoloDueno()
//    dentro de la factory; disabled por PREDICADO (ANEXIÓN 02 Sep al kit):
//    no-editable → Editar/Permisos deshabilitados · Eliminar solo dueño+NO semilla.
//  · Columnas con label/movil (checklist de consumo 0.8). NINGUNA funcionalidad
//    se quita: duplicar · eliminación masiva · editor full-page · restablecer.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, ShieldCheck, Copy, Trash2, ArrowLeft, RotateCcw, Save } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import {
    DataTable,
    ConfirmDialog,
    Pildora,
    crearColumnaAcciones,
    useSeleccionTabla,
} from '@/components/data-table'
import { RoleFilters } from '@/components/sistema/RoleFilters'
import { RoleModal } from '@/components/sistema/RoleModal'
import { PermissionEditor } from '@/components/sistema/PermissionEditor'
import type { PermissionEditorHandle } from '@/components/sistema/PermissionEditor'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import {
    listarRoles,
    eliminarRol,
    obtenerPermisosRol,
} from '@/lib/actions/roles'
import { useSoloDueno } from '@/lib/utils/owner'
import { tipoDeRol, TONO_TIPO, TEXTO_TIPO, PERMISOS_SEMILLA, esRolDeSemilla } from '@/types/roles'
import type { EstadoTabla, ColumnDefExtension } from '@/components/data-table'
import type { RolLista, FiltrosRoles, TipoRol, PermisoPayload } from '@/types/roles'
import type { ToolbarAction } from '@/types/shell'

const RUTA = '/dashboard/sistema/roles'

export default function Page() {
    const [roles, setRoles] = useState<RolLista[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosRoles>({ busqueda: '', tipo: 'todos' })
    // Hook en el top level (Rules of Hooks): lee es_admin_principal del store.
    // Con la ANEXIÓN 0.4 viaja en la sesión — sin Server Action ni useEffect.
    const esDuenoUsuario = useSoloDueno()

    // Editor de permisos: null = lista; rol = vista de página completa para ese rol.
    const [rolEditor, setRolEditor] = useState<RolLista | null>(null)
    const [editorHandle, setEditorHandle] = useState<PermissionEditorHandle | null>(null)
    const [editorOcupado, setEditorOcupado] = useState(false)

    const [modalOpen, setModalOpen] = useState(false)
    const [modo, setModo] = useState<'crear' | 'editar' | 'duplicar'>('crear')
    const [seleccionado, setSeleccionado] = useState<RolLista | null>(null)
    const [permisosDuplicar, setPermisosDuplicar] = useState<PermisoPayload[]>([])

    const [confirmarEliminar, setConfirmarEliminar] = useState<RolLista | null>(null)
    const [confirmarMasivo, setConfirmarMasivo] = useState(false)
    const [eliminando, setEliminando] = useState(false)

    // ── Selección múltiple (MEJORA 20 Ago — patrón 0.9) ────────────────────────
    // ⭐ ALINEACIÓN 02 Sep 2026 — selección UNIFORME con useSeleccionTabla (0.8 · B6):
    // reemplaza el Record + Object.keys manual; el DataTable queda modo controlado.
    // (El hook se instancia tras rolesFiltrados, abajo, porque resuelve contra el
    // conjunto visible.)

    // Solo el tipo recarga del servidor (cambia el conjunto). La búsqueda se
    // resuelve en local (abajo).
    const tipoFiltro = filtros.tipo

    // Fetch puro: NO setea estado. Lo consume el efecto (carga inicial) y
    // recargar (handlers de evento).
    const obtenerRoles = useCallback(async () => {
        return listarRoles({ busqueda: '', tipo: tipoFiltro })
    }, [tipoFiltro])

    // Carga inicial: el setState vive en el .then() (callback asíncrono).
    useEffect(() => {
        let activo = true
        obtenerRoles().then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setRoles(res.data ?? [])
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [obtenerRoles])

    // Recarga desde handlers de evento (onSuccess / onRetry) — setState permitido.
    const recargar = useCallback(async () => {
        const res = await obtenerRoles()
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setRoles(res.data ?? [])
        setEstadoTabla('idle')
    }, [obtenerRoles])

    // Búsqueda local sobre nombre (instantánea).
    const rolesFiltrados = useMemo(() => {
        const q = filtros.busqueda.trim().toLowerCase()
        if (!q) return roles
        return roles.filter((r) => r.nombre.toLowerCase().includes(q))
    }, [roles, filtros.busqueda])

    // ⭐ ALINEACIÓN 02 Sep 2026 — selección UNIFORME (0.8 · B6): el hook resuelve
    // seleccionados contra el conjunto que ve la tabla.
    const { seleccion, onSeleccionChange, seleccionados, limpiar } = useSeleccionTabla(
        rolesFiltrados,
        (r) => r.id
    )

    const abrirCrear = useCallback(() => {
        setModo('crear')
        setSeleccionado(null)
        setPermisosDuplicar([])
        setModalOpen(true)
    }, [])

    // ⭐ FIX 22 Sep 2026 — useCallback: ambas alimentan las deps del useMemo de
    // `acciones`; sin memoizar, el memo se invalidaba en cada render.
    const abrirEditar = useCallback((r: RolLista) => {
        setModo('editar')
        setSeleccionado(r)
        setPermisosDuplicar([])
        setModalOpen(true)
    }, [])

    // Duplicar: carga los permisos del origen ANTES de abrir el modal (R5).
    // El modal los recibe por prop (no importa obtenerPermisosRol — Parte 2).
    // `obtenerPermisosRol` es Server Action de scope módulo (importada): no es dep válida.
    const abrirDuplicar = useCallback(
        async (r: RolLista) => {
            setModo('duplicar')
            setSeleccionado(r)
            const res = await obtenerPermisosRol(r.clave)
            setPermisosDuplicar(res.success ? res.data ?? [] : [])
            setModalOpen(true)
        },
        []
    )

    // ── Toolbar: las acciones contextuales SIEMPRE visibles (MEJORA 20 Ago) ────
    // Editar / Permisos / Duplicar / Eliminar aparecen aunque no haya selección,
    // pero DESHABILITADAS (title explica qué falta). Al seleccionar UNA fila se
    // activan según sus capas; con VARIAS, Eliminar masivo (solo dueño).
    // Vista EDITOR: Volver / Restablecer a semilla / Guardar permisos → disparan
    // el editor vía handle (onReady).
    const acciones = useMemo<ToolbarAction[]>(() => {
        if (rolEditor) {
            const base: ToolbarAction[] = [
                {
                    id: 'volver',
                    label: 'Volver',
                    icon: ArrowLeft,
                    accion: 'ver',
                    variant: 'outline',
                    onClick: () => setRolEditor(null),
                },
            ]
            if (PERMISOS_SEMILLA[rolEditor.clave]) {
                base.push({
                    id: 'restablecer',
                    label: 'Restablecer a semilla',
                    icon: RotateCcw,
                    accion: 'editar',
                    variant: 'outline',
                    disabled: editorOcupado,
                    onClick: () => editorHandle?.pedirRestablecer(),
                })
            }
            base.push({
                id: 'guardar',
                label: 'Guardar permisos',
                icon: Save,
                accion: 'editar',
                variant: 'default',
                disabled: editorOcupado,
                onClick: () => editorHandle?.guardar(),
            })
            return base
        }

        const base: ToolbarAction[] = [
            {
                id: 'nuevo',
                label: 'Nuevo rol',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                onClick: abrirCrear,
            },
        ]

        const rUnica = seleccionados.length === 1 ? seleccionados[0] : null
        const seleccionMultiple = seleccionados.length > 1
        const sinSeleccion = seleccionados.length === 0

        // Editar — se activa con UNA fila editable.
        base.push({
            id: 'editar',
            label: 'Editar',
            icon: Pencil,
            accion: 'editar',
            variant: 'outline',
            disabled: sinSeleccion || !rUnica?.es_editable || seleccionMultiple,
            title: sinSeleccion
                ? 'Selecciona un rol para editar'
                : seleccionMultiple
                  ? 'Editar aplica a un solo rol'
                  : rUnica && !rUnica.es_editable
                    ? 'Este rol es de sistema y no se puede modificar'
                    : undefined,
            onClick: rUnica?.es_editable ? () => abrirEditar(rUnica) : undefined,
        })

        // Permisos — se activa con UNA fila editable.
        base.push({
            id: 'permisos',
            label: 'Permisos',
            icon: ShieldCheck,
            accion: 'editar',
            variant: 'outline',
            disabled: sinSeleccion || !rUnica?.es_editable || seleccionMultiple,
            title: sinSeleccion
                ? 'Selecciona un rol para editar sus permisos'
                : seleccionMultiple
                  ? 'Permisos aplica a un solo rol'
                  : rUnica && !rUnica.es_editable
                    ? 'Este rol es de sistema y no se puede modificar'
                    : undefined,
            onClick: rUnica?.es_editable ? () => setRolEditor(rUnica) : undefined,
        })

        // Duplicar — siempre disponible con UNA fila (cualquier rol, incluso sistema).
        base.push({
            id: 'duplicar',
            label: 'Duplicar',
            icon: Copy,
            accion: 'crear',
            variant: 'outline',
            disabled: sinSeleccion || seleccionMultiple,
            title: sinSeleccion
                ? 'Selecciona un rol para duplicarlo'
                : seleccionMultiple
                  ? 'Duplicar aplica a un solo rol'
                  : undefined,
            onClick: rUnica ? () => void abrirDuplicar(rUnica) : undefined,
        })

        // Eliminar — solo dueño, nunca un rol de semilla (es_sistema O PERMISOS_SEMILLA).
        base.push({
            id: 'eliminar',
            label: 'Eliminar',
            icon: Trash2,
            accion: 'eliminar',
            variant: 'destructive',
            disabled: sinSeleccion || !esDuenoUsuario || (rUnica ? esRolDeSemilla(rUnica) || !rUnica.es_editable : false),
            title: sinSeleccion
                ? 'Selecciona un rol para eliminarlo'
                : !esDuenoUsuario
                  ? 'Solo el dueño del sistema puede eliminar roles'
                  : rUnica && esRolDeSemilla(rUnica)
                    ? 'Los roles de sistema no se pueden eliminar'
                    : undefined,
            onClick:
                rUnica && !esRolDeSemilla(rUnica) && rUnica.es_editable
                    ? () => setConfirmarEliminar(rUnica)
                    : seleccionMultiple && esDuenoUsuario
                      ? () => setConfirmarMasivo(true)
                      : undefined,
        })

        return base
        // ⭐ FIX 22 Sep 2026 — `abrirEditar`/`abrirDuplicar` declarados: la toolbar los usa
        // (Editar / Duplicar) y sin memoizar el memo se invalidaba en cada render.
    }, [rolEditor, editorOcupado, editorHandle, seleccionados, esDuenoUsuario, abrirCrear, abrirEditar, abrirDuplicar])

    usePageConfig({
        info: {
            title: rolEditor ? `Permisos de ${rolEditor.nombre}` : 'Roles',
            subtitle: 'Sistema',
        },
        path: RUTA,
        actions: acciones,
    })

    // ── Columnas (spec de la Parte 1 · ⭐ ALINEACIÓN 0.8: label/movil) ───────────
    const puedeEditar = useCanAction(RUTA, 'editar')
    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeEliminar = useCanAction(RUTA, 'eliminar')

    const columnas = useMemo<(ColumnDef<RolLista> & ColumnDefExtension<RolLista>)[]>(
        () => [
            { accessorKey: 'nombre', label: 'Nombre', movil: 'critica' },
            { accessorKey: 'clave', label: 'Clave', movil: 'secundaria' },
            { accessorKey: 'nivel_jerarquico', label: 'Nivel', movil: 'secundaria' },
            {
                id: 'tipo',
                accessorFn: (row) => tipoDeRol(row),
                label: 'Tipo',
                movil: 'critica',
                render: (value) => {
                    const tipo = value as TipoRol
                    return <Pildora texto={TEXTO_TIPO[tipo]} tono={TONO_TIPO[tipo]} />
                },
            },
            {
                accessorKey: 'descripcion',
                label: 'Descripción',
                movil: 'ocultar',
                // MEJORA 20 Ago — más ancha para que quepa más información.
                size: 320,
            },
        ],
        []
    )

    // ⭐ ALINEACIÓN 0.8 — acciones por fila con crearColumnaAcciones (B5 · PROMOCIÓN):
    // primarias inline (Editar · Permisos · Duplicar) + Eliminar en secundarias ⋮.
    // El RBAC incluye/excluye por useCanAction (fail-closed) y el gate del dueño
    // (`useSoloDueno`) vive en el predicado de Eliminar: solo dueño y NUNCA un rol
    // de semilla (es_sistema O clave en PERMISOS_SEMILLA — los 7 de la 0.4 no se
    // eliminan). `disabled` por predicado (ANEXIÓN 02 Sep al kit): roles no
    // editables muestran Editar/Permisos deshabilitados (cortesía).
    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<RolLista>({
                acciones: [
                    ...(puedeEditar
                        ? [
                              {
                                  icon: Pencil,
                                  label: 'Editar',
                                  dataAccion: 'editar',
                                  disabled: (r: RolLista) => !r.es_editable,
                                  onClick: (r: RolLista) => abrirEditar(r),
                              },
                              {
                                  icon: ShieldCheck,
                                  label: 'Permisos',
                                  dataAccion: 'permisos',
                                  disabled: (r: RolLista) => !r.es_editable,
                                  onClick: (r: RolLista) => setRolEditor(r),
                              },
                          ]
                        : []),
                    ...(puedeCrear
                        ? [
                              {
                                  icon: Copy,
                                  label: 'Duplicar',
                                  dataAccion: 'duplicar',
                                  onClick: (r: RolLista) => void abrirDuplicar(r),
                              },
                          ]
                        : []),
                ],
                secundarias: [
                    ...(puedeEliminar
                        ? [
                              {
                                  icon: Trash2,
                                  label: 'Eliminar',
                                  dataAccion: 'eliminar',
                                  // Solo dueño + NO semilla + editable.
                                  disabled: (r: RolLista) =>
                                      !esDuenoUsuario || esRolDeSemilla(r) || !r.es_editable,
                                  onClick: (r: RolLista) => setConfirmarEliminar(r),
                              },
                          ]
                        : []),
                ],
            }),
        [puedeEditar, puedeCrear, puedeEliminar, esDuenoUsuario, abrirEditar, abrirDuplicar]
    )

    // onConfirm del ConfirmDialog (fila única): devuelve { error } (contrato 0.8).
    const ejecutarEliminar = async (): Promise<{ error: string | null }> => {
        if (!confirmarEliminar) return { error: null }
        setEliminando(true)
        try {
            const res = await eliminarRol(confirmarEliminar.id)
            if (!res.success) return { error: res.error ?? 'No se pudo eliminar el rol.' }
            await recargar()
            limpiar()
            setConfirmarEliminar(null)
            return { error: null }
        } finally {
            setEliminando(false)
        }
    }

    // ── Eliminación MASIVA (MEJORA 20 Ago — solo dueño) ────────────────────────
    // Recorre eliminarRol() por cada fila seleccionada. Detiene en el primer
    // error (FK RESTRICT o capa del dueño) y devuelve el mensaje traducido.
    const ejecutarEliminarMasivo = async (): Promise<{ error: string | null }> => {
        if (seleccionados.length === 0) return { error: null }
        setEliminando(true)
        try {
            const eliminables = seleccionados.filter((r) => r.es_editable && !r.es_sistema)
            if (eliminables.length === 0) {
                setConfirmarMasivo(false)
                return { error: 'Los roles seleccionados son de sistema y no se pueden eliminar.' }
            }
            let ultimoError: string | null = null
            for (const r of eliminables) {
                const res = await eliminarRol(r.id)
                if (!res.success) {
                    ultimoError = res.error ?? 'No se pudo eliminar un rol.'
                    break
                }
            }
            await recargar()
            limpiar()
            setConfirmarMasivo(false)
            return ultimoError
                ? { error: `Se eliminaron algunos roles, pero: ${ultimoError}` }
                : { error: null }
        } finally {
            setEliminando(false)
        }
    }

    // ── VISTA EDITOR (lista ↔ editor, misma ruta) ──────────────────────────────
    if (rolEditor) {
        return (
            <PermissionEditor
                rol={rolEditor}
                onOcupadoCambio={setEditorOcupado}
                onReady={setEditorHandle}
            />
        )
    }

    // ── VISTA LISTA ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4">
            <RoleFilters
                filtros={filtros}
                onFiltrosChange={(patch) => setFiltros((f) => ({ ...f, ...patch }))}
                disabled={estadoTabla === 'loading'}
            />

            <DataTable<RolLista>
                columns={[...columnas, columnaAcciones]}
                data={rolesFiltrados}
                rowKey={(r) => r.id}
                estado={estadoTabla}
                emptyMessage="Sin roles para este filtro"
                onRetry={() => void recargar()}
                enableRowSelection
                rowSelection={seleccion}
                onRowSelectionChange={onSeleccionChange}
            />

            <RoleModal
                mode={modo}
                rol={seleccionado}
                permisos={permisosDuplicar}
                open={modalOpen}
                onOpenChange={setModalOpen}
                onSuccess={recargar}
            />

            <ConfirmDialog
                open={confirmarEliminar !== null}
                onOpenChange={(o) => {
                    if (!o) setConfirmarEliminar(null)
                }}
                titulo="Eliminar rol"
                descripcion={
                    confirmarEliminar
                        ? `Se eliminará «${confirmarEliminar.nombre}» de forma permanente. Esta acción no se puede deshacer.`
                        : ''
                }
                confirmLabel="Eliminar"
                variant="destructive"
                isLoading={eliminando}
                onConfirm={ejecutarEliminar}
            />

            <ConfirmDialog
                open={confirmarMasivo}
                onOpenChange={(o) => {
                    if (!o) setConfirmarMasivo(false)
                }}
                titulo="Eliminar roles seleccionados"
                descripcion={`Se eliminarán ${seleccionados.length} roles de forma permanente. Los que tengan usuarios asignados se omitirán con su mensaje. Esta acción no se puede deshacer.`}
                confirmLabel="Eliminar"
                variant="destructive"
                isLoading={eliminando}
                onConfirm={ejecutarEliminarMasivo}
            />
        </div>
    )
}
