// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO DE PLANTILLAS — `{clave → plantilla}` (Guía 2.1 · P6)
//
// EL REGISTRO (superficie 3 del mapa): el consumidor escribe `tipo="nota_compra"` y
// no sabe si el papel vive en la BD o en un componente de código.
//
// ⚠️ `null` NO es un error: es el caso normal del tipo que todavía vive como
// componente (los 2 que la 1.6 no ha migrado). El consumidor cae a su FALLBACK.
// Cambiar ese contrato por «lanzar» obligaría a cada consumidor a un try/catch para
// un caso esperado — y rompería el fallback de todos a la vez.
//
// ⚠️ El fallback es un TIPO, no un mapa: un mapa obligaría a este archivo (kit) a
// importar las plantillas de 1.6 (módulo de negocio) — la inversión de capas que el
// carril PROMOCIÓN existe para evitar. Lo aporta quien conoce sus documentos.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ComponentType } from 'react'

import { obtenerPlantillaActiva } from '@/lib/actions/plantillas'
import type { VariablesDocumento } from '@/lib/plantillas/motor'
import type { PlantillaActiva } from '@/types/plantillas'

/**
 * Una plantilla **en código**: el respaldo de un tipo cuya plantilla aún no vive en
 * la BD. Recibe los MISMOS `datos` que una plantilla de la BD — así migrar una
 * plantilla de código a la BD **no cambia al consumidor**.
 */
export type PlantillaFallback = ComponentType<{ datos: VariablesDocumento }>

/**
 * ⭐ EL REGISTRO. Devuelve la plantilla activa de un tipo, o `null` si no hay.
 *
 * `null` ⇒ el consumidor usa su `fallback` en código; y si tampoco lo tiene, **no
 * ofrece imprimir** (nunca un botón muerto — SISTEMA_COMPONENTES §8).
 */
export async function resolverPlantilla(clave: string): Promise<PlantillaActiva | null> {
    if (!clave) return null
    const plantilla = await obtenerPlantillaActiva(clave)
    return plantilla
}
