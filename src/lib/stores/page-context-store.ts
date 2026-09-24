// ═══════════════════════════════════════════════════════════════════════════════
// PAGE CONTEXT STORE — Guía 0.6
//
// El telégrafo entre las páginas y el Shell.
//
// El problema: en el árbol de React la página es HIJA del layout, así que
// Topbar y Toolbar son sus hermanos mayores. No existen props que suban.
// La página escribe aquí (vía usePageConfig) y el Shell lee.
//
// ⚠️ SIN persist: describe la página abierta AHORA. Persistirlo mostraría el
//    título de la sesión anterior al arrancar, y JSON.stringify descartaría
//    los onClick sin avisar.
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { ReactNode } from 'react'

import { areActionsEqual } from '@/lib/utils'
import type { PageInfo, PageConfig, ToolbarAction } from '@/types/shell'

interface PageContextState {
    pageInfo: PageInfo
    currentPath: string
    injectedActions: ToolbarAction[]
    /** ⭐ Filtros de la página (FiltrosBar · decisión 25). null = sin sección. */
    filtros: ReactNode

    setPageConfig: (config: PageConfig) => void
    clearPageConfig: () => void
}

const ESTADO_INICIAL = {
    pageInfo: { title: '', subtitle: undefined } as PageInfo,
    currentPath: '',
    injectedActions: [] as ToolbarAction[],
    filtros: null as ReactNode,
}

export const usePageContextStore = create<PageContextState>()((set, get) => ({
    ...ESTADO_INICIAL,

    /**
     * Registra la página actual en el Shell.
     *
     * ⭐ GUARD ANTI-BUCLE — la razón de ser de este método.
     * Las páginas pasan objetos literales, que son referencias NUEVAS en cada
     * render. Sin esta comparación: set → render → array nuevo → set → …
     * hasta congelar la pestaña. Si nada cambió funcionalmente, no se escribe.
     */
    setPageConfig: (config) => {
        const actual = get()
        const nuevasAcciones = config.actions ?? []
        const nuevosFiltros = config.filtros ?? null

        const sinCambios =
            actual.pageInfo.title === config.info.title &&
            actual.pageInfo.subtitle === config.info.subtitle &&
            actual.currentPath === config.path &&
            areActionsEqual(actual.injectedActions, nuevasAcciones) &&
            // ⭐ Comparación por REFERENCIA: el elemento de filtros DEBE ser
            // estable (useMemo en la página) — JSX no se puede comparar profundo.
            actual.filtros === nuevosFiltros

        if (sinCambios) return

        set({
            pageInfo: { title: config.info.title, subtitle: config.info.subtitle },
            currentPath: config.path,
            injectedActions: nuevasAcciones,
            filtros: nuevosFiltros,
        })
    },

    /**
     * Limpia el contexto. Lo llama usePageConfig al desmontar la página.
     * Sin esto, al navegar el Topbar mostraría el título anterior hasta que
     * la página nueva terminara de montar.
     */
    clearPageConfig: () => set({ ...ESTADO_INICIAL }),
}))
