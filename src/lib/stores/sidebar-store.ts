// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR STORE — Guía 0.6
//
// Estado VISUAL del Sidebar. No guarda qué se muestra (eso es menu[] del
// auth-store): guarda cómo se ve. Por eso no conoce los módulos del ERP —
// trata los nombres de grupo como strings opacos y sigue funcionando cuando
// la BD siembra un módulo nuevo.
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SidebarState {
    /** Rail de iconos en escritorio. Persistido. */
    isCollapsed: boolean
    /** Drawer en móvil. VOLÁTIL — nunca se persiste. */
    isMobileOpen: boolean
    /**
     * Módulos con el acordeón desplegado.
     * string[] y NUNCA Set: JSON.stringify(new Set()) devuelve {} y el estado
     * se corrompería en silencio al recargar.
     */
    expandedGroups: string[]

    toggleCollapse: () => void
    setCollapsed: (valor: boolean) => void
    setMobileOpen: (valor: boolean) => void
    toggleGroup: (modulo: string) => void
    setExpandedGroups: (modulos: string[]) => void
}

export const useSidebarStore = create<SidebarState>()(
    persist(
        (set) => ({
            isCollapsed: false,
            isMobileOpen: false,
            expandedGroups: [],

            toggleCollapse: () =>
                set((s) => ({
                    isCollapsed: !s.isCollapsed,
                    // Colapsar cierra los acordeones: en modo rail no hay dónde dibujarlos.
                    expandedGroups: !s.isCollapsed ? [] : s.expandedGroups,
                })),

            setCollapsed: (valor) => set({ isCollapsed: valor }),

            setMobileOpen: (valor) => set({ isMobileOpen: valor }),

            toggleGroup: (modulo) =>
                set((s) => ({
                    expandedGroups: s.expandedGroups.includes(modulo)
                        ? s.expandedGroups.filter((m) => m !== modulo)
                        : [...s.expandedGroups, modulo],
                })),

            setExpandedGroups: (modulos) => set({ expandedGroups: modulos }),
        }),
        {
            name: 'erp-sidebar',
            storage: createJSONStorage(() => localStorage),
            // isMobileOpen queda fuera a propósito: un overlay abierto no debe
            // sobrevivir a la recarga.
            partialize: (state) => ({
                isCollapsed: state.isCollapsed,
                expandedGroups: state.expandedGroups,
            }),
        }
    )
)
