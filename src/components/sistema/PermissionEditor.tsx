'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION EDITOR — Guía 0.10 · Smart Component (vista de página completa)
// Acordeones por módulo → submódulo → 5 acciones (ver es maestro). Guarda y
// restablece vía la RPC guardar_permisos_rol (R4/R6).
//
// El estado es Record<href, AccionEditor[]> — la MISMA forma del payload de la
// RPC, para no transformar al guardar. 'ver' habilita el submódulo (fail-closed:
// sin ver, el RPC descarta el submódulo entero).
//
// ⭐ MEJORA 20 Ago 2026 — MODELO ADITIVO: los permisos que el rol YA TIENE al
// cargar (su "base") quedan marcados y BLOQUEADOS — no se pueden desmarcar,
// solo se complementan (la idea: un rol base nunca pierde lo que tiene; para
// rehacerlo desde cero se crea uno nuevo). Solo lo agregado se puede quitar.
//
// ⭐ MEJORA 20 Ago 2026 — LAS ACCIONES VIVEN EN LA TOOLBAR DEL SHELL, no en el
// cuerpo: la página (Parte 5) inyecta Volver / Restablecer / Guardar vía
// usePageConfig y dispara este editor con el handle entregado por onReady
// (callback, no ref — el React Compiler de Next 16 rechaza useImperativeHandle).
// onOcupadoCambio(boolean) le dice a la página cuándo deshabilitar esos botones.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2, Lock } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from '@/components/ui/collapsible'
import { ConfirmDialog } from '@/components/data-table'
import { toast } from '@/components/ui/sonner'

import {
    listarArbolPermisos,
    obtenerPermisosRol,
    guardarPermisosRol,
    restablecerPermisosRol,
} from '@/lib/actions/roles'
import { ACCIONES_EDITOR, PERMISOS_SEMILLA } from '@/types/roles'
import type { AccionEditor, ModuloPermisos, PermisoPayload, RolLista } from '@/types/roles'

// Las 4 sub-acciones (todo menos 'ver', que es el interruptor maestro).
const SUB_ACCIONES: AccionEditor[] = ACCIONES_EDITOR.filter((a) => a !== 'ver')

const TEXTO_ACCION: Record<AccionEditor, string> = {
    ver: 'Ver',
    crear: 'Crear',
    editar: 'Editar',
    eliminar: 'Eliminar',
    exportar: 'Exportar',
}

export interface PermissionEditorHandle {
    /** Guarda los permisos actuales (lo invoca la Toolbar del Shell). */
    guardar: () => void
    /** Abre el ConfirmDialog de restablecer (lo invoca la Toolbar del Shell). */
    pedirRestablecer: () => void
}

interface PermissionEditorProps {
    rol: RolLista
    /** Avisa a la página cuándo el editor está ocupado (guardando/restableciendo). */
    onOcupadoCambio?: (ocupado: boolean) => void
    /** Entrega el handle de acciones a la página (la Toolbar las dispara). */
    onReady?: (handle: PermissionEditorHandle) => void
}

export function PermissionEditor({ rol, onOcupadoCambio, onReady }: PermissionEditorProps) {
    const [arbol, setArbol] = useState<ModuloPermisos[]>([])
    // href → acciones marcadas (siempre incluye 'ver' cuando el submódulo está habilitado).
    const [estado, setEstado] = useState<Record<string, AccionEditor[]>>({})
    // ⭐ BASE (MEJORA 20 Ago — modelo aditivo): href → acciones que el rol YA
    // tenía al cargar. Quedan marcadas y bloqueadas: no se pueden desmarcar.
    const [base, setBase] = useState<Record<string, AccionEditor[]>>({})
    const [cargando, setCargando] = useState(true)
    const [errorServidor, setErrorServidor] = useState('')
    const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
    const [restableciendo, setRestableciendo] = useState(false)

    // ⭐ Avisa a la página para deshabilitar los botones de la Toolbar.
    const avisarOcupado = useCallback(
        (ocupado: boolean) => {
            onOcupadoCambio?.(ocupado)
        },
        [onOcupadoCambio]
    )

    // ⭐ FIX 20 Ago — la BASE (bloqueada) es el SEED del rol (PERMISOS_SEMILLA[clave]),
    // NO lo que la BD devuelve. Si la base fuera "todo lo que tiene", los permisos
    // agregados quedarían bloqueados tras guardar+recargar y no se podrían quitar
    // (bug reportado). El estado (marcado) sí viene de la BD: seed + lo agregado.
    // Lo agregado SIEMPRE es desmarcable; solo el seed es intocable.
    const construirBase = useCallback((): Record<string, AccionEditor[]> => {
        const semilla = PERMISOS_SEMILLA[rol.clave] ?? []
        const mapa: Record<string, AccionEditor[]> = {}
        for (const p of semilla) {
            if (p.acciones.includes('ver')) mapa[p.href] = p.acciones
        }
        return mapa
    }, [rol.clave])

    // Construye el estado de checkboxes a partir del payload leído (BD).
    // La base bloqueada es el seed del rol, no el payload (FIX 20 Ago).
    const aplicarPermisos = useCallback(
        (permisos: PermisoPayload[]) => {
            const mapa: Record<string, AccionEditor[]> = {}
            for (const p of permisos) {
                // fail-closed: un submódulo sin 'ver' no se muestra como habilitado.
                if (p.acciones.includes('ver')) mapa[p.href] = p.acciones
            }
            setBase(construirBase())
            setEstado(mapa)
        },
        [construirBase]
    )

    // Carga inicial: fetch puro en el efecto, setState DENTRO del .then()
    // (callback asíncrono — permitido; un setState síncrono en el cuerpo rompería
    // react-hooks/set-state-in-effect).
    useEffect(() => {
        let activo = true
        Promise.all([listarArbolPermisos(), obtenerPermisosRol(rol.clave)]).then(
            ([arbolRes, permRes]) => {
                if (!activo) return
                if (arbolRes.success) {
                    setArbol(arbolRes.data ?? [])
                } else {
                    setErrorServidor(arbolRes.error ?? 'No se pudo cargar el árbol de permisos.')
                }
                if (permRes.success) {
                    aplicarPermisos(permRes.data ?? [])
                } else if (!arbolRes.success) {
                    setErrorServidor(permRes.error ?? 'No se pudieron cargar los permisos.')
                }
                setCargando(false)
            }
        )
        return () => {
            activo = false
        }
    }, [rol.clave, aplicarPermisos])

    const tieneVer = (href: string) => (estado[href] ?? []).includes('ver')
    const verEsBase = (href: string) => (base[href] ?? []).includes('ver')
    const accionEsBase = (href: string, accion: AccionEditor) =>
        (base[href] ?? []).includes(accion)

    // ⭐ Aditivo: si 'ver' ya es base, NO se puede desmarcar. Si no es base,
    // marcar habilita el submódulo (con solo 'ver'); desmarcar lo descarta.
    const alternarVer = (href: string, marcado: boolean) => {
        setEstado((prev) => {
            if (!marcado && verEsBase(href)) return prev // base intocable
            const siguiente = { ...prev }
            if (marcado) {
                siguiente[href] = ['ver']
            } else {
                delete siguiente[href]
            }
            return siguiente
        })
    }

    // ⭐ Aditivo: las acciones base no se desmarcan; las nuevas se alternan libre.
    const alternarAccion = (href: string, accion: AccionEditor) => {
        setEstado((prev) => {
            const actual = prev[href] ?? []
            if (!actual.includes('ver')) return prev // sin ver no hay sub-acciones
            if (actual.includes(accion) && accionEsBase(href, accion)) return prev // base intocable
            const siguiente = actual.includes(accion)
                ? actual.filter((a) => a !== accion)
                : [...actual, accion]
            return { ...prev, [href]: siguiente }
        })
    }

    // Total de acciones marcadas (para el resumen visual).
    const totalAcciones = useMemo(
        () => Object.values(estado).reduce((suma, acciones) => suma + acciones.length, 0),
        [estado]
    )

    const guardar = useCallback(async () => {
        avisarOcupado(true)
        setErrorServidor('')
        try {
            const payload: PermisoPayload[] = Object.entries(estado)
                .filter(([, acciones]) => acciones.includes('ver'))
                .map(([href, acciones]) => ({ href, acciones }))
            const res = await guardarPermisosRol(rol.clave, payload)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudieron guardar los permisos.')
                return
            }
            // ⭐ FIX 20 Ago — NO se actualiza la base tras guardar: la base es lo
            // que el rol YA tenía al cargar (o la semilla tras restablecer). Lo
            // recién agregado sigue siendo desmarcable en esta sesión; al recargar,
            // la BD lo devuelve y pasa a ser base (lo que el rol "tiene").
            toast.success('Permisos guardados')
        } catch {
            setErrorServidor('Error de conexión. Intenta de nuevo.')
        } finally {
            avisarOcupado(false)
        }
    }, [estado, rol.clave, avisarOcupado])

    const restablecer = useCallback(async () => {
        setRestableciendo(true)
        avisarOcupado(true)
        try {
            const res = await restablecerPermisosRol(rol.clave)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo restablecer.')
                setConfirmarRestablecer(false)
                return
            }
            // ⭐ El toast de éxito lo muestra el ConfirmDialog (successMessage):
            // un solo toast, sin duplicar (MEJORA 20 Ago).
            // Recargar los permisos actuales para reflejar la semilla (nueva base).
            const permRes = await obtenerPermisosRol(rol.clave)
            if (permRes.success) aplicarPermisos(permRes.data ?? [])
            setConfirmarRestablecer(false)
        } catch {
            setErrorServidor('Error de conexión. Intenta de nuevo.')
        } finally {
            setRestableciendo(false)
            avisarOcupado(false)
        }
    }, [rol.clave, avisarOcupado, aplicarPermisos])

    // ⭐ Exponer las acciones a la Toolbar del Shell: la página inyecta los botones
    // y estos disparan la lógica del editor vía el handle entregado con onReady.
    useEffect(() => {
        onReady?.({
            guardar: () => void guardar(),
            pedirRestablecer: () => setConfirmarRestablecer(true),
        })
        // onReady es estable en la página (useCallback); el handle se re-entrega
        // cuando cambia guardar (depende del estado de checkboxes).
    }, [guardar, onReady])

    return (
        <div className="flex flex-col gap-4">
            {/* ── Identidad del rol (las ACCIONES viven en la Toolbar del Shell) ── */}
            <div>
                <h2 className="text-lg font-semibold">{rol.nombre}</h2>
                <p className="text-sm text-muted-foreground">
                    Clave: <code className="font-mono">{rol.clave}</code> · {totalAcciones}{' '}
                    acciones marcadas
                </p>
            </div>

            {/* ⭐ Aviso del modelo aditivo (MEJORA 20 Ago — FIX: solo el seed es fijo) */}
            <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                Los permisos <strong>de semilla</strong> de este rol quedan fijos (marcados). Lo que
                agregues se puede quitar cuando quieras — solo el seed no se desmarca.
            </p>

            {errorServidor && (
                <p className="rounded-lg border border-destructive/20 bg-destructive-bg px-4 py-2.5 text-sm text-destructive">
                    {errorServidor}
                </p>
            )}

            {/* ── Acordeones por módulo ── */}
            {cargando ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando permisos…
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {arbol.map((modulo) => (
                        <Collapsible key={modulo.id} defaultOpen className="overflow-hidden rounded-lg border border-border">
                            {/* ⭐ MEJORA 20 Ago — títulos de módulo diferenciados:
                                fondo, peso y versalitas los separan del contenido. */}
                            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 bg-surface-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                                {modulo.nombre}
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="bg-surface px-4 pb-3 pt-2">
                                <div className="flex flex-col gap-1">
                                    {modulo.submodulos.map((sub) => {
                                        const habilitado = tieneVer(sub.href)
                                        return (
                                            <div
                                                key={sub.href}
                                                className="flex flex-col gap-2 rounded-md px-2 py-2 hover:bg-surface-2"
                                            >
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                                    {/* ⭐ ver: interruptor maestro */}
                                                    <Checkbox
                                                        id={`ver-${sub.href}`}
                                                        checked={habilitado}
                                                        onCheckedChange={(v) => alternarVer(sub.href, v === true)}
                                                        aria-label={`Habilitar ${sub.nombre}`}
                                                    />
                                                    <Label htmlFor={`ver-${sub.href}`} className="font-medium">
                                                        {sub.nombre}
                                                    </Label>
                                                    {verEsBase(sub.href) && (
                                                        <span
                                                            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                                            title="Permiso base del rol — no se puede quitar"
                                                        >
                                                            <Lock className="h-3 w-3" aria-hidden="true" />
                                                            Base
                                                        </span>
                                                    )}
                                                </div>

                                                {/* ⭐ MEJORA 20 Ago — el hint de "marca Ver" es visible
                                                    ANTES de marcar: las sub-acciones de un submódulo sin
                                                    ver se muestran con su explicación, no como bloqueo. */}
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-6">
                                                    {SUB_ACCIONES.map((accion) => {
                                                        const marcada = (estado[sub.href] ?? []).includes(accion)
                                                        const esBase = accionEsBase(sub.href, accion)
                                                        return (
                                                            <label
                                                                key={accion}
                                                                className="flex items-center gap-1.5 text-sm"
                                                            >
                                                                <Checkbox
                                                                    checked={marcada}
                                                                    disabled={!habilitado || (marcada && esBase)}
                                                                    onCheckedChange={() => alternarAccion(sub.href, accion)}
                                                                    aria-label={`${TEXTO_ACCION[accion]} en ${sub.nombre}`}
                                                                />
                                                                <span
                                                                    className={
                                                                        !habilitado || (marcada && esBase)
                                                                            ? 'text-muted-foreground'
                                                                            : ''
                                                                    }
                                                                >
                                                                    {TEXTO_ACCION[accion]}
                                                                </span>
                                                                {marcada && esBase && (
                                                                    <Lock
                                                                        className="h-3 w-3 text-muted-foreground"
                                                                        aria-hidden="true"
                                                                    />
                                                                )}
                                                            </label>
                                                        )
                                                    })}
                                                </div>

                                                {/* ⭐ Hint de habilitación (MEJORA 20 Ago — punto 6) */}
                                                {!habilitado && (
                                                    <p className="pl-6 text-xs text-muted-foreground">
                                                        Marca <strong>Ver</strong> para habilitar las
                                                        acciones de «{sub.nombre}».
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    ))}
                </div>
            )}

            {/* ── Confirmación de restablecer (warning, no destructivo) ── */}
            <ConfirmDialog
                open={confirmarRestablecer}
                onOpenChange={(o) => {
                    if (!o) setConfirmarRestablecer(false)
                }}
                titulo="Restablecer permisos a la semilla"
                descripcion={`«${rol.nombre}» volverá a los permisos originales (los que sembró la Guía 0.4). Se perderán los cambios manuales de este rol; no afecta a otros roles.`}
                confirmLabel="Restablecer"
                cancelLabel="Cancelar"
                variant="default"
                isLoading={restableciendo}
                successMessage="Permisos restablecidos a la semilla"
                onConfirm={async () => {
                    await restablecer()
                    return { error: null }
                }}
            />
        </div>
    )
}
