'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD USUARIOS — Guía 0.9 · Parte 4 (página)
// Integra: UserFilters + DataTable + acciones de fila + UserModal + ConfirmDialog.
// El Toolbar (Shell) recibe el onClick de "Nuevo usuario" via usePageConfig.
//
// ⭐ FIX 19 Ago 2026 (react-hooks/set-state-in-effect): la carga inicial se
// dispara desde el useEffect con el setState DENTRO del .then() del fetch
// (callback asíncrono — permitido por la regla). Un setState síncrono en el
// cuerpo del efecto —directo o vía una función que setea— la rompe. recargar()
// sigue existiendo para los handlers de evento (onSuccess / onRetry), donde el
// setState síncrono sí está permitido.
//
// ⭐ MEJORA 20 Ago 2026 — selección múltiple y el lugar de las acciones:
//  · El listado pasa de "solo acciones por fila" a selección múltiple con
//    checkboxes (contrato 0.8: enableRowSelection / rowSelection /
//    onRowSelectionChange). Se mantienen las acciones por fila.
//  · Las acciones que dependen de la selección (Desactivar/Activar/Archivar/
//    Desarchivar) NO viven en una barra interna del DataTable (renderToolbar):
//    se inyectan en la Toolbar del Shell via usePageConfig, igual que "Nuevo
//    usuario". La Toolbar (0.6/0.7) las filtra por RBAC de forma central.
//  · Regla "no te operes a ti mismo": si la selección incluye tu propia cuenta,
//    los botones de selección se deshabilitan con su porqué en el `title`.
//
// ⭐ MEJORA 21 Ago 2026 — Toolbar SIEMPRE visible + cambiar contraseña (patrón 0.10):
//  · El set fijo (Editar / Cambiar contraseña / Desactivar / Activar / Archivar /
//    Desarchivar) se inyecta SIEMPRE, deshabilitado con `title` explicando qué
//    falta — mismo patrón que roles (0.10). "Nuevo usuario" sigue siempre activo.
//  · NUEVO: "Cambiar contraseña" (Toolbar + inline por fila) abre
//    CambiarPasswordModal, que restablece el password vía service_role con la
//    política de la 0.11 (passwordSchema + password_changed_once).
//
// ⭐ ENRIQUECIMIENTO + ALINEACIÓN 02 Sep 2026:
//  · +Ver ficha (UserDetailModal) · +bulk "Cambiar rol" (CambiarRolDialog) ·
//    +columnas "Creado el"/"Actualizado el" · +badge "Admin principal"
//  · Selección UNIFORME con useSeleccionTabla (0.8 · B6) — adiós Record manual.
//  · Acciones por fila con crearColumnaAcciones (0.8 · B5) — adiós
//    renderRowActions; disabled por PREDICADO ("no te operes a ti mismo" —
//    ANEXIÓN 02 Sep al kit).
//  · Columnas con label/movil + defaultVisibleColumns (checklist de consumo 0.8).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Plus,
    Pencil,
    Power,
    PowerOff,
    Archive,
    ArchiveRestore,
    KeyRound,
    Eye,
    Crown,
    UsersRound,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import {
    DataTable,
    ConfirmDialog,
    Pildora,
    crearColumnaAcciones,
    useSeleccionTabla,
} from '@/components/data-table'
import { UserFilters } from '@/components/sistema/UserFilters'
import { UserModal } from '@/components/sistema/UserModal'
import { CambiarPasswordModal } from '@/components/sistema/CambiarPasswordModal'
import { CambiarRolDialog } from '@/components/sistema/CambiarRolDialog'
import { UserDetailModal } from '@/components/sistema/UserDetailModal'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { useAuth } from '@/lib/stores/auth-store'
import { formatearFecha } from '@/lib/utils/formatters'
import {
    listarUsuarios,
    listarRolesParaSelector,
    cambiarEstadoUsuario,
    archivarUsuario,
} from '@/lib/actions/usuarios'
import { estadoDeUsuario, TONO_ESTADO, TEXTO_ESTADO } from '@/types/usuarios'
import type { EstadoTabla, ColumnDefExtension } from '@/components/data-table'
import type { UsuarioLista, RolOpcion, FiltrosUsuario, EstadoUsuario } from '@/types/usuarios'
import type { ToolbarAction } from '@/types/shell'

const RUTA = '/dashboard/sistema/usuarios'

type ConfirmacionPendiente =
    | { tipo: 'estado'; usuario: UsuarioLista }
    | { tipo: 'archivar'; usuario: UsuarioLista }
    | { tipo: 'estado_masivo'; usuarios: UsuarioLista[]; activar: boolean }
    | { tipo: 'archivar_masivo'; usuarios: UsuarioLista[]; archivar: boolean }
    | null

export default function Page() {
    const usuarioSesionId = useAuth((s) => s.usuario?.id ?? null)

    const [usuarios, setUsuarios] = useState<UsuarioLista[]>([])
    const [roles, setRoles] = useState<RolOpcion[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosUsuario>({ busqueda: '', idRol: '', estado: 'todos' })

    const [modalOpen, setModalOpen] = useState(false)
    const [modo, setModo] = useState<'crear' | 'editar'>('crear')
    const [seleccionado, setSeleccionado] = useState<UsuarioLista | null>(null)

    // ⭐ MEJORA 21 Ago 2026 — modal de restablecer contraseña (admin).
    // null = cerrado; un UsuarioLista = objetivo del cambio (Toolbar o fila).
    const [cambiarPassUsuario, setCambiarPassUsuario] = useState<UsuarioLista | null>(null)

    const [confirmar, setConfirmar] = useState<ConfirmacionPendiente>(null)
    const [procesando, setProcesando] = useState(false)

    // ⭐ ENRIQUECIMIENTO 02 Sep 2026 — Ver ficha (read-only) + bulk "Cambiar rol"
    const [verUsuario, setVerUsuario] = useState<UsuarioLista | null>(null)
    const [cambiarRolAbierto, setCambiarRolAbierto] = useState(false)

    // Recarga: SOLO estado + rol recargan del servidor (cambian el conjunto).
    // La búsqueda por texto se filtra en local (abajo), sin round-trip por tecla.
    const estadoFiltro = filtros.estado
    const idRolFiltro = filtros.idRol

    // Fetch puro: NO setea estado. Lo consume el efecto (carga inicial) y
    // recargar (handlers de evento). Separarlo evita que el efecto toque un
    // setState síncrono (react-hooks/set-state-in-effect).
    const obtenerUsuarios = useCallback(async () => {
        return listarUsuarios({ busqueda: '', idRol: idRolFiltro, estado: estadoFiltro })
    }, [estadoFiltro, idRolFiltro])

    // Carga inicial: el setState vive en el .then() (callback asíncrono).
    useEffect(() => {
        let activo = true
        obtenerUsuarios().then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setUsuarios(res.data ?? [])
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [obtenerUsuarios])

    // Recarga desde handlers de evento (onSuccess / onRetry) — setState permitido.
    const recargar = useCallback(async () => {
        const res = await obtenerUsuarios()
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setUsuarios(res.data ?? [])
        setEstadoTabla('idle')
    }, [obtenerUsuarios])

    useEffect(() => {
        void listarRolesParaSelector().then((r) => {
            if (r.success) setRoles(r.data ?? [])
        })
    }, [])

    // Búsqueda local sobre nombre + correo (instantánea).
    const usuariosFiltrados = useMemo(() => {
        const q = filtros.busqueda.trim().toLowerCase()
        if (!q) return usuarios
        return usuarios.filter(
            (u) =>
                u.nombre_completo.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q)
        )
    }, [usuarios, filtros.busqueda])

    // ⭐ ALINEACIÓN 02 Sep 2026 — selección UNIFORME con useSeleccionTabla (0.8 · B6):
    // reemplaza el Record + Object.keys manual; el DataTable queda en modo controlado.
    const { seleccion, onSeleccionChange, seleccionados, limpiar } = useSeleccionTabla(
        usuariosFiltrados,
        (u) => u.id
    )

    // Selección sin tu propia cuenta (cortesía "no te operes a ti mismo") — la usan
    // la Toolbar y el bulk "Cambiar rol" (⭐ ENRIQUECIMIENTO 02 Sep).
    const seleccionSinMi = useMemo(
        () => seleccionados.filter((u) => u.id !== usuarioSesionId),
        [seleccionados, usuarioSesionId]
    )

    const abrirCrear = useCallback(() => {
        setModo('crear')
        setSeleccionado(null)
        setModalOpen(true)
    }, [])

    const abrirEditar = useCallback((u: UsuarioLista) => {
        setModo('editar')
        setSeleccionado(u)
        setModalOpen(true)
    }, [])

    // ── Toolbar: acciones inyectadas al Shell (MEJORA 20 Ago 2026) ─────────────
    // MEJORA 21 Ago 2026: patrón roles (0.10) — el set fijo se inyecta SIEMPRE,
    // deshabilitado con `title` explicando qué falta. La Toolbar del Shell
    // (0.6/0.7) fusiona por `id` y filtra por RBAC de forma central: una acción
    // sin permiso para este href NO se renderiza.
    // La propia cuenta se excluye de las operaciones: si la selección la incluye,
    // los botones se deshabilitan (misma regla que las acciones de fila).
    // NO hay botón "Eliminar" en usuarios: el soft-delete es archivar.
    const acciones = useMemo<ToolbarAction[]>(() => {
        const base: ToolbarAction[] = [
            {
                id: 'nuevo',
                label: 'Nuevo usuario',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                onClick: abrirCrear,
            },
        ]

        const esUnica = seleccionados.length === 1
        const unico = esUnica ? seleccionados[0] : null
        const incluyeMi = seleccionados.length !== seleccionSinMi.length
        const tituloBloq = incluyeMi
            ? 'La selección incluye tu propia cuenta — no puedes operarte a ti mismo'
            : undefined

        const activos = seleccionSinMi.filter((u) => u.es_activo)
        const inactivos = seleccionSinMi.filter((u) => !u.es_activo)
        const noArchivados = seleccionSinMi.filter((u) => !u.es_archivado)
        const archivados = seleccionSinMi.filter((u) => u.es_archivado)

        // Editar — se activa con UNA fila que no sea tu propia cuenta.
        base.push({
            id: 'editar',
            label: 'Editar',
            icon: Pencil,
            accion: 'editar',
            variant: 'outline',
            disabled: !esUnica || unico?.id === usuarioSesionId,
            title: !esUnica
                ? 'Selecciona un usuario para editar'
                : unico?.id === usuarioSesionId
                  ? tituloBloq
                  : undefined,
            onClick:
                esUnica && unico && unico.id !== usuarioSesionId
                    ? () => abrirEditar(unico)
                    : undefined,
        })

        // Cambiar contraseña — mismas reglas que Editar (una fila, no tu cuenta).
        base.push({
            id: 'cambiar_contrasena',
            label: 'Cambiar contraseña',
            icon: KeyRound,
            accion: 'editar',
            variant: 'outline',
            disabled: !esUnica || unico?.id === usuarioSesionId,
            title: !esUnica
                ? 'Selecciona un usuario para cambiar su contraseña'
                : unico?.id === usuarioSesionId
                  ? tituloBloq
                  : undefined,
            onClick:
                esUnica && unico && unico.id !== usuarioSesionId
                    ? () => setCambiarPassUsuario(unico)
                    : undefined,
        })

        // Desactivar — visible SIEMPRE; se activa con al menos un activo
        // fuera de tu propia cuenta.
        base.push({
            id: 'desactivar',
            label: 'Desactivar',
            icon: PowerOff,
            accion: 'editar',
            variant: 'outline',
            disabled: incluyeMi || activos.length === 0,
            title: incluyeMi
                ? tituloBloq
                : activos.length === 0
                  ? 'Selecciona usuario(s) activos para desactivarlos'
                  : undefined,
            onClick:
                activos.length > 0 && !incluyeMi
                    ? () => setConfirmar({ tipo: 'estado_masivo', usuarios: activos, activar: false })
                    : undefined,
        })

        // Activar — se activa con al menos un inactivo fuera de tu cuenta.
        base.push({
            id: 'activar',
            label: 'Activar',
            icon: Power,
            accion: 'editar',
            variant: 'outline',
            disabled: incluyeMi || inactivos.length === 0,
            title: incluyeMi
                ? tituloBloq
                : inactivos.length === 0
                  ? 'Selecciona usuario(s) inactivos para activarlos'
                  : undefined,
            onClick:
                inactivos.length > 0 && !incluyeMi
                    ? () => setConfirmar({ tipo: 'estado_masivo', usuarios: inactivos, activar: true })
                    : undefined,
        })

        // Archivar — se activa con al menos un no-archivado fuera de tu cuenta.
        base.push({
            id: 'archivar',
            label: 'Archivar',
            icon: Archive,
            accion: 'eliminar',
            variant: 'outline',
            disabled: incluyeMi || noArchivados.length === 0,
            title: incluyeMi
                ? tituloBloq
                : noArchivados.length === 0
                  ? 'Selecciona usuario(s) no archivados para archivarlos'
                  : undefined,
            onClick:
                noArchivados.length > 0 && !incluyeMi
                    ? () => setConfirmar({ tipo: 'archivar_masivo', usuarios: noArchivados, archivar: true })
                    : undefined,
        })

        // Desarchivar — se activa con al menos un archivado fuera de tu cuenta.
        base.push({
            id: 'desarchivar',
            label: 'Desarchivar',
            icon: ArchiveRestore,
            accion: 'eliminar',
            variant: 'outline',
            disabled: incluyeMi || archivados.length === 0,
            title: incluyeMi
                ? tituloBloq
                : archivados.length === 0
                  ? 'Selecciona usuario(s) archivados para desarchivarlos'
                  : undefined,
            onClick:
                archivados.length > 0 && !incluyeMi
                    ? () => setConfirmar({ tipo: 'archivar_masivo', usuarios: archivados, archivar: false })
                    : undefined,
        })

        // Cambiar rol (⭐ ENRIQUECIMIENTO 02 Sep 2026) — bulk con ≥1 fila fuera de
        // tu propia cuenta; abre CambiarRolDialog con la selección sin tu cuenta.
        base.push({
            id: 'cambiar_rol',
            label: 'Cambiar rol',
            icon: UsersRound,
            accion: 'editar',
            variant: 'outline',
            disabled: incluyeMi || seleccionSinMi.length === 0,
            title: incluyeMi
                ? tituloBloq
                : seleccionSinMi.length === 0
                  ? 'Selecciona al menos un usuario para cambiar su rol'
                  : undefined,
            onClick:
                seleccionSinMi.length > 0 && !incluyeMi
                    ? () => setCambiarRolAbierto(true)
                    : undefined,
        })

        return base
        // ⭐ FIX 22 Sep 2026 — `seleccionSinMi` es dependencia real: se consume en
        // los `disabled`/`title` de Desactivar/Activar/Archivar/Desarchivar/Cambiar rol.
    }, [seleccionados, usuarioSesionId, seleccionSinMi, abrirCrear, abrirEditar])

    usePageConfig({
        info: { title: 'Usuarios', subtitle: 'Sistema' },
        path: RUTA,
        actions: acciones,
    })

    // ── Columnas (spec de la Parte 1 · ⭐ ALINEACIÓN 0.8: label/movil + fechas + badge) ──
    // ⭐ FIX 02 Sep 2026: se eliminó `const puedeEliminar = useCanAction(RUTA, 'eliminar')`
    // (TS6133 — declarada y nunca leída; las acciones por fila solo usan puedeEditar).
    const puedeEditar = useCanAction(RUTA, 'editar')

    const columnas = useMemo<(ColumnDef<UsuarioLista> & ColumnDefExtension<UsuarioLista>)[]>(
        () => [
            {
                accessorKey: 'nombre_completo',
                label: 'Nombre',
                movil: 'critica',
                render: (value, row) => (
                    <div className="flex items-center gap-2">
                        <span>{String(value)}</span>
                        {row.es_admin_principal && (
                            <span
                                role="img"
                                aria-label="Admin principal"
                                title="Admin principal"
                                className="inline-flex items-center text-primary"
                            >
                                <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                        )}
                    </div>
                ),
            },
            { accessorKey: 'email', label: 'Correo', movil: 'critica' },
            { accessorKey: 'rol_nombre', label: 'Rol', movil: 'secundaria' },
            { accessorKey: 'telefono', label: 'Teléfono', movil: 'secundaria' },
            {
                id: 'estado',
                accessorFn: (row) => estadoDeUsuario(row),
                label: 'Estado',
                movil: 'critica',
                render: (value) => {
                    const estado = value as EstadoUsuario
                    return <Pildora texto={TEXTO_ESTADO[estado]} tono={TONO_ESTADO[estado]} />
                },
            },
            {
                accessorKey: 'created_at',
                label: 'Creado el',
                movil: 'secundaria',
                render: (value) => formatearFecha(String(value)),
            },
            {
                accessorKey: 'updated_at',
                label: 'Actualizado el',
                movil: 'ocultar',
                render: (value) => formatearFecha(String(value)),
            },
        ],
        []
    )

    // ⭐ ALINEACIÓN 0.8 — acciones por fila con crearColumnaAcciones (B5 · PROMOCIÓN):
    // primarias inline (Ver ficha · Cambiar contraseña · Editar) + secundarias en ⋮
    // (Activar/Desactivar · Archivar/Desarchivar). El RBAC incluye/excluye por
    // useCanAction (fail-closed, mismo criterio que ProtectedAction); `disabled`
    // por PREDICADO (ANEXIÓN 02 Sep): "no te operes a ti mismo" — la cortesía
    // por fila que el Record de antes resolvía a mano.
    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<UsuarioLista>({
                acciones: [
                    {
                        icon: Eye,
                        label: 'Ver ficha',
                        dataAccion: 'ver',
                        onClick: (u) => setVerUsuario(u),
                    },
                    ...(puedeEditar
                        ? [
                              {
                                  icon: KeyRound,
                                  label: 'Cambiar contraseña',
                                  dataAccion: 'cambiar-password',
                                  disabled: (u: UsuarioLista) => u.id === usuarioSesionId,
                                  onClick: (u: UsuarioLista) => setCambiarPassUsuario(u),
                              },
                              {
                                  icon: Pencil,
                                  label: 'Editar',
                                  dataAccion: 'editar',
                                  disabled: (u: UsuarioLista) => u.id === usuarioSesionId,
                                  onClick: (u: UsuarioLista) => abrirEditar(u),
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
                                  // Archivados: el toggle de estado no aplica (se desarchiva primero).
                                  disabled: (u: UsuarioLista) =>
                                      u.id === usuarioSesionId || u.es_archivado,
                                  onClick: (u: UsuarioLista) =>
                                      setConfirmar({ tipo: 'estado', usuario: u }),
                              },
                              {
                                  icon: Archive,
                                  label: 'Archivar / Desarchivar',
                                  dataAccion: 'archivar',
                                  disabled: (u: UsuarioLista) => u.id === usuarioSesionId,
                                  onClick: (u: UsuarioLista) =>
                                      setConfirmar({ tipo: 'archivar', usuario: u }),
                              },
                          ]
                        : []),
                ],
            }),
        [puedeEditar, usuarioSesionId, abrirEditar]
    )

    // onConfirm del ConfirmDialog: devuelve { error } (contrato 0.8).
    const ejecutarConfirmacion = async (): Promise<{ error: string | null }> => {
        if (!confirmar) return { error: null }
        setProcesando(true)
        try {
            // ── Modo masivo: una operación por usuario seleccionado ──────────
            if (confirmar.tipo === 'estado_masivo') {
                const resultados = await Promise.all(
                    confirmar.usuarios.map((u) => cambiarEstadoUsuario(u.id, confirmar.activar))
                )
                const fallo = resultados.find((r) => !r.success)
                if (fallo) return { error: fallo.error ?? 'No se pudo completar la acción.' }
                await recargar()
                limpiar()
                return { error: null }
            }
            if (confirmar.tipo === 'archivar_masivo') {
                const resultados = await Promise.all(
                    confirmar.usuarios.map((u) => archivarUsuario(u.id, confirmar.archivar))
                )
                const fallo = resultados.find((r) => !r.success)
                if (fallo) return { error: fallo.error ?? 'No se pudo completar la acción.' }
                await recargar()
                limpiar()
                return { error: null }
            }

            // ── Modo individual (por fila) ────────────────────────────────────
            const u = confirmar.usuario
            const res =
                confirmar.tipo === 'estado'
                    ? await cambiarEstadoUsuario(u.id, !u.es_activo)
                    : await archivarUsuario(u.id, !u.es_archivado)

            if (!res.success) return { error: res.error ?? 'No se pudo completar la acción.' }
            await recargar()
            return { error: null }
        } finally {
            setProcesando(false)
        }
    }

    // Textos del diálogo según la acción pendiente (individual o masiva).
    const dialogo = confirmar
        ? confirmar.tipo === 'estado_masivo'
            ? {
                  titulo: confirmar.activar ? 'Activar usuarios' : 'Desactivar usuarios',
                  descripcion: confirmar.activar
                      ? `${confirmar.usuarios.length} usuarios podrán volver a iniciar sesión.`
                      : `${confirmar.usuarios.length} usuarios no podrán iniciar sesión hasta reactivarlos. Siguen en el listado.`,
                  confirmLabel: confirmar.activar ? 'Activar' : 'Desactivar',
                  variant: 'default' as const,
              }
            : confirmar.tipo === 'archivar_masivo'
              ? {
                    titulo: confirmar.archivar ? 'Archivar usuarios' : 'Desarchivar usuarios',
                    descripcion: confirmar.archivar
                        ? `${confirmar.usuarios.length} usuarios se desactivarán y saldrán del listado. Podrás recuperarlos desde el filtro "Archivados".`
                        : `${confirmar.usuarios.length} usuarios volverán al listado como inactivos. Podrás reactivarlos después.`,
                    confirmLabel: confirmar.archivar ? 'Archivar' : 'Desarchivar',
                    variant: confirmar.archivar ? 'destructive' as const : 'default' as const,
                }
              : confirmar.tipo === 'estado'
                ? confirmar.usuario.es_activo
                    ? {
                          titulo: 'Desactivar usuario',
                          descripcion: `${confirmar.usuario.nombre_completo} no podrá iniciar sesión hasta reactivarlo. Sigue en el listado.`,
                          confirmLabel: 'Desactivar',
                          variant: 'default' as const,
                      }
                    : {
                          titulo: 'Activar usuario',
                          descripcion: `${confirmar.usuario.nombre_completo} podrá volver a iniciar sesión.`,
                          confirmLabel: 'Activar',
                          variant: 'default' as const,
                      }
                : confirmar.usuario.es_archivado
                  ? {
                        titulo: 'Desarchivar usuario',
                        descripcion: `${confirmar.usuario.nombre_completo} volverá al listado como inactivo. Podrás reactivarlo después.`,
                        confirmLabel: 'Desarchivar',
                        variant: 'default' as const,
                    }
                  : {
                        titulo: 'Archivar usuario',
                        descripcion: `${confirmar.usuario.nombre_completo} se desactivará y saldrá del listado. Podrás recuperarlo desde el filtro "Archivados".`,
                        confirmLabel: 'Archivar',
                        variant: 'destructive' as const,
                    }
        : null

    return (
        <div className="flex flex-col gap-4">
            <UserFilters
                filtros={filtros}
                roles={roles}
                onFiltrosChange={(patch) => setFiltros((f) => ({ ...f, ...patch }))}
                disabled={estadoTabla === 'loading'}
            />

            <DataTable<UsuarioLista>
                columns={[...columnas, columnaAcciones]}
                data={usuariosFiltrados}
                rowKey={(u) => u.id}
                estado={estadoTabla}
                emptyMessage="Sin usuarios para este filtro"
                onRetry={() => void recargar()}
                defaultVisibleColumns={[
                    'nombre_completo',
                    'email',
                    'rol_nombre',
                    'telefono',
                    'estado',
                    'created_at',
                ]}
                enableRowSelection
                rowSelection={seleccion}
                onRowSelectionChange={onSeleccionChange}
            />

            <UserModal
                mode={modo}
                usuario={seleccionado}
                roles={roles}
                open={modalOpen}
                onOpenChange={setModalOpen}
                onSuccess={recargar}
            />

            <CambiarPasswordModal
                usuario={cambiarPassUsuario}
                open={cambiarPassUsuario !== null}
                onOpenChange={(o) => {
                    if (!o) setCambiarPassUsuario(null)
                }}
                onSuccess={recargar}
            />

            {/* ⭐ ENRIQUECIMIENTO 02 Sep 2026 — Ver ficha (read-only) */}
            <UserDetailModal
                usuario={verUsuario}
                open={verUsuario !== null}
                onOpenChange={(o) => {
                    if (!o) setVerUsuario(null)
                }}
            />

            {/* ⭐ ENRIQUECIMIENTO 02 Sep 2026 — bulk "Cambiar rol" (sin tu cuenta) */}
            <CambiarRolDialog
                usuarios={seleccionSinMi}
                roles={roles}
                open={cambiarRolAbierto}
                onOpenChange={setCambiarRolAbierto}
                onSuccess={recargar}
            />

            <ConfirmDialog
                open={confirmar !== null}
                onOpenChange={(o) => {
                    if (!o) setConfirmar(null)
                }}
                titulo={dialogo?.titulo ?? ''}
                descripcion={dialogo?.descripcion ?? ''}
                confirmLabel={dialogo?.confirmLabel ?? 'Confirmar'}
                variant={dialogo?.variant ?? 'default'}
                isLoading={procesando}
                onConfirm={ejecutarConfirmacion}
            />
        </div>
    )
}
