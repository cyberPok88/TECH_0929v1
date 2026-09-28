'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PLANTILLAS — LA RUTA (Guía 2.1 · P9 · página delgada)
//
// /dashboard/sistema/plantillas — la puerta del carril. Monta el Hub y NADA MÁS:
// el título, el subtítulo y los botones los registra la pestaña que esté montada.
//
// ⚠️ ESTA PÁGINA NO LLAMA `usePageConfig`, y es deliberado. Cada pestaña registra
// la suya porque el título y las acciones dependen de la pestaña activa. Si la
// página también lo llamara, el `clearPageConfig()` que dispara el DESMONTAJE de
// la pestaña al cambiar de solapa dejaría la toolbar VACÍA: el efecto de la página
// no vuelve a correr (sus dependencias no cambiaron). Un solo llamador, y su ciclo
// de vida pegado a lo que se ve.
//
// Precedente que NO se copia: `catalogos-basicos/page.tsx` sí llama usePageConfig
// porque sus pestañas comparten LOS MISMOS botones (los tiene el Hub y los expone
// por handle). Aquí cada pestaña tiene los suyos.
//
// El RBAC no se declara aquí: lo aplica el Shell (0.7) contra `submodulos` y
// `permisos_acciones`, y el submódulo de esta ruta ya está sembrado en la BD.
// ═══════════════════════════════════════════════════════════════════════════════

import { PlantillasHub } from '@/components/sistema/plantillas/PlantillasHub'

export default function PlantillasPage() {
    return <PlantillasHub />
}
