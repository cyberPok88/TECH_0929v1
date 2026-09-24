'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRADAS — página de aterrizaje del módulo (fix 18 Sep · delgada)
// ⭐ MEJORA 22 Sep 2026: el Sidebar volvió a desplegar las etapas (híbrido: el
// renglón del módulo navega aquí y el chevron abre las 5 etapas), así que esta
// ruta dejó de ser la única puerta al flujo. El panel muestra las tarjetas de
// etapa filtradas por rol.
// ═══════════════════════════════════════════════════════════════════════════════

import { EntradasDashboard } from '@/components/entradas/EntradasDashboard'

export default function Page() {
    return <EntradasDashboard />
}
