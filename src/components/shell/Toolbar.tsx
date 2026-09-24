'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLBAR — Guía 0.6 · Smart Component — filtro RBAC (Guía 0.7)
//
// Fusiona las acciones del diccionario (config por ruta) con las que la página
// inyecta vía usePageConfig. El merge es por `id`: lo inyectado GANA, porque el
// caso típico es "el diccionario declara el botón, la página le pone conducta".
// Si se sumaran, saldrían dos botones "Exportar".
//
// ⭐ GUÍA 0.7 — FILTRO RBAC (Decisión 12): tras fusionar, cada `accion` se cruza
// contra permisos[].clave_accion del store, mismo href. Sin permiso, el botón
// NO EXISTE para este usuario. toolbar-config.ts NO se modifica: el diccionario
// declara todas las acciones y este filtro decide cuáles se renderizan.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { getAccionesBase } from '@/config/toolbar-config'
import { useAuth } from '@/lib/stores/auth-store'
import { usePageContextStore } from '@/lib/stores/page-context-store'
import type { ToolbarAction } from '@/types/shell'

export function Toolbar() {
    const currentPath = usePageContextStore((s) => s.currentPath)
    const injectedActions = usePageContextStore((s) => s.injectedActions)

    // Referencia estable (no un booleano por botón): el filtro de abajo hace
    // un único `.some` por botón sobre el MISMO array, en un solo memo.
    const permisos = useAuth((s) => s.permisos)

    const acciones = useMemo<ToolbarAction[]>(() => {
        const base = getAccionesBase(currentPath)
        if (injectedActions.length === 0) return base

        // Map construido desde `base`: sobrescribir una clave CONSERVA su
        // posición original. Si el orden cambiara al inyectar, el botón
        // principal saltaría de sitio al terminar de cargar la página.
        const fusion = new Map(base.map((a) => [a.id, a]))
        for (const accion of injectedActions) {
            fusion.set(accion.id, accion)
        }
        return Array.from(fusion.values())
    }, [currentPath, injectedActions])

    // ⭐ GUÍA 0.7 — FILTRO RBAC, post-fusión. Memo PROPIO (no dentro del merge):
    // permisos[] puede rehidratarse en caliente (logout multipestaña), y este
    // memo debe re-evaluarse cuando cambie, sin depender de currentPath.
    // El cruce es doble: esta acción Y esta URL (contrato desnormalizado 0.5).
    const visibles = useMemo(
        () =>
            acciones.filter((a) =>
                permisos.some(
                    (p) => p.href === currentPath && p.clave_accion === a.accion
                )
            ),
        [acciones, permisos, currentPath]
    )

    // Sin acciones no se dibuja la barra: una franja vacía de 48px en cada
    // página roba espacio vertical sin comunicar nada. (0.6 — ahora también
    // se cumple cuando el rol no tiene NINGUNA acción en la ruta.)
    if (visibles.length === 0) return null

    return (
        // bg-surface, no bg-background: comparte tono con el Topbar para que
        // ambos se lean como un solo encabezado y el borde inferior marque dónde
        // empieza el contenido. Sobre bg-background la franja flotaba entre dos.
        // flex-wrap se queda: en móvil 4 acciones no caben en una línea.
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 md:px-4">
            {visibles.map((accion) => {
                const Icon = accion.icon
                return (
                    <Button
                        key={accion.id}
                        type="button"
                        size="sm"
                        variant={accion.variant ?? 'secondary'}
                        disabled={accion.disabled}
                        title={accion.title}
                        onClick={accion.onClick}
                        // data-accion: la aserción A4 y las pruebas manuales
                        // identifican el permiso de cada botón desde el DOM.
                        data-accion={accion.accion}
                    >
                        <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        {accion.label}
                    </Button>
                )
            })}
        </div>
    )
}
