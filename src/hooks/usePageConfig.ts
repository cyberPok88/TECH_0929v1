// ═══════════════════════════════════════════════════════════════════════════════
// usePageConfig — Guía 0.6
//
// La ÚNICA vía por la que una página le habla al Shell.
//
//   usePageConfig({
//       info: { title: 'Cotizaciones', subtitle: 'Documentos de venta' },
//       path: '/dashboard/ventas/cotizaciones',
//       actions: [ ... ],   // opcional: se SUMAN a las de toolbar-config
//       filtros: <CotizacionFilters .../>,   // opcional: sección FiltrosBar (decisión 25)
//   })
//
// ⚠️ El elemento `filtros` DEBE ser estable (useMemo): el guard anti-bucle del
//    store lo compara por REFERENCIA (JSX no se puede comparar profundo).
// ⚠️ Llamarlo SIEMPRE antes de cualquier `return` condicional de la página.
//    React exige que el orden de los hooks sea idéntico en todos los renders.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react'

import { usePageContextStore } from '@/lib/stores/page-context-store'
import type { PageConfig } from '@/types/shell'

export function usePageConfig(config: PageConfig): void {
    const setPageConfig = usePageContextStore((s) => s.setPageConfig)
    const clearPageConfig = usePageContextStore((s) => s.clearPageConfig)

    // Se extraen los primitivos para que las dependencias sean estables.
    const { title, subtitle } = config.info
    const { path, actions, filtros } = config

    useEffect(() => {
        // No se memoiza `config`: el guard vive en setPageConfig y protege a las
        // páginas por igual. Que este efecto corra de más es inocuo —
        // el store no escribe si nada cambió funcionalmente.
        setPageConfig({ info: { title, subtitle }, path, actions, filtros })

        // Limpieza al desmontar: React desmonta la página vieja ANTES de montar
        // la nueva, así que este es el único punto donde el orden es correcto.
        return () => {
            clearPageConfig()
        }
    }, [title, subtitle, path, actions, filtros, setPageConfig, clearPageConfig])
}
