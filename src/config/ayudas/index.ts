// ═══════════════════════════════════════════════════════════════════════════════
// AYUDAS — EL REGISTRO DEL ESTÁNDAR (MEJORA 47 · 04 Oct 2026 · ext. Guía 2.4)
//
// Un módulo = un archivo en `src/config/ayudas/<modulo>.ts`. Acá se juntan todos y
// viven las funciones que usan el interruptor y el `<Ayuda>`.
//
// ⭐ Por qué un registro y no textos sueltos:
//   · el interruptor necesita **saber qué existe** para poder contarlo y agruparlo;
//   · el dueño pidió poder **rastrear y quitar** estos textos ⇒ el registro es el
//     índice: se borra el archivo del módulo y quedan a la vista los `<Ayuda>` huérfanos;
//   · una clave mal escrita **se nota** (no falla en silencio como un string suelto).
//
// ⭐ GUÍA 2.4 (05 Oct 2026): `NOMBRE_MODULO` sube desde `AyudasToggler` (donde solo
//    cubría 2 de los 3 módulos y `recepcion` se veía con su clave cruda) y nace
//    `textosDe()`, que es lo que permite ofrecer **una casilla por texto**.
// ═══════════════════════════════════════════════════════════════════════════════

import { AYUDAS_ACONDICIONAMIENTO } from '@/config/ayudas/acondicionamiento'
import { AYUDAS_ALTA } from '@/config/ayudas/alta'
import { AYUDAS_RECEPCION } from '@/config/ayudas/recepcion'
import { AYUDAS_REVISION } from '@/config/ayudas/revision'
import { AYUDAS_VENTAS } from '@/config/ayudas/ventas'
import { TIPOS_AYUDA, type DefinicionAyuda, type RegistroAyudas, type TipoAyuda } from '@/types/ayudas'

/**
 * Todos los registros, por módulo.
 * ⚠️ Para sumar un módulo: crear su archivo y agregarlo ACÁ. Nada más.
 *    ⭐ Y agregarlo también a `NOMBRE_MODULO`, o se mostrará con su clave cruda.
 */
export const AYUDAS: Record<string, RegistroAyudas> = {
    recepcion: AYUDAS_RECEPCION,
    revision: AYUDAS_REVISION,
    // ⭐ 06 Oct 2026 (Guía 1.6 · Fase 3) — el puesto del acondicionador estrena su registro:
    // sus 3 `title` inline y los 4 encabezados de Z2 dejan de ser prosa que no se puede apagar.
    acondicionamiento: AYUDAS_ACONDICIONAMIENTO,
    // ⭐ 08 Oct 2026 (Guía 1.6 · Fase 5) — el puesto de Almacén estrena su registro: el candado de
    // la cantidad FÍSICA editable deja de ser prosa que no se puede apagar.
    alta: AYUDAS_ALTA,
    ventas: AYUDAS_VENTAS,
}

/** Los módulos que ya aportaron su registro (los que el interruptor puede listar). */
export const MODULOS_CON_AYUDAS: string[] = Object.keys(AYUDAS)

/**
 * ⭐ GUÍA 2.4 — el nombre del módulo **como lo lee el técnico**, no su id interno.
 * Vive acá (y no en el componente) porque lo usan **dos** consumidores: el interruptor
 * del Topbar y la pantalla de Configuración.
 * 🔑 La clave de este mapa es el `modulo` de la clave (`revision.algo` → `revision`).
 */
export const NOMBRE_MODULO: Record<string, string> = {
    recepcion: 'Entradas · Recepción',
    revision: 'Entradas · Revisión',
    // ⭐ Sin esta línea el interruptor mostraría la **clave cruda** (`acondicionamiento`),
    // que es el defecto que la Guía 2.4 vino a arreglar.
    acondicionamiento: 'Entradas · Acondicionamiento',
    // ⭐ Sin esta línea el interruptor mostraría la **clave cruda** (`alta`) — el defecto que la
    // Guía 2.4 vino a arreglar, aplicado al módulo que nace hoy.
    alta: 'Entradas · Alta en Almacén',
    ventas: 'Ventas · Notas de remisión',
}

/** El módulo de una clave: `revision.algo` → `revision`. */
export function moduloDeClave(clave: string): string {
    return clave.split('.')[0] ?? ''
}

/**
 * La definición de una clave, o `null` si no existe.
 * ⚠️ Devuelve `null` en vez de lanzar: un `<Ayuda>` con la clave mal escrita **no
 *    puede tumbar la pantalla** — pero el consumidor lo avisa (ver `Ayuda.tsx`).
 */
export function definicionDe(clave: string): DefinicionAyuda | null {
    const modulo = moduloDeClave(clave)
    return AYUDAS[modulo]?.[clave] ?? null
}

/** Cuántas ayudas tiene un módulo, por categoría. */
export function contarPorTipo(modulo: string): Record<TipoAyuda, number> {
    const registro = AYUDAS[modulo] ?? {}
    const cuenta = { nota: 0, aviso: 0, candado: 0 } as Record<TipoAyuda, number>
    for (const def of Object.values(registro)) cuenta[def.tipo] += 1
    return cuenta
}

/** Cuántas ayudas tiene un módulo en total (para el «35 en Revisión» del panel). */
export function contarAyudas(modulo: string): number {
    return Object.keys(AYUDAS[modulo] ?? {}).length
}

/**
 * ¿Esta ayuda se puede ocultar?
 * 🔴 `fijo: true` NO se oculta **nunca** (el candado dentro de una confirmación:
 *    ahí el texto es el botón). El interruptor lo ignora.
 */
export function esOcultable(clave: string): boolean {
    return !definicionDe(clave)?.fijo
}

/** Las claves de un módulo. */
export function clavesDe(modulo: string): string[] {
    return Object.keys(AYUDAS[modulo] ?? {})
}

/** Un texto suelto, listo para pintar su casilla. */
export interface TextoAyuda {
    clave: string
    tipo: TipoAyuda
    texto: string
    /** `true` = `fijo`: NO se puede ocultar, así que su casilla NO se ofrece. */
    fijo: boolean
}

/**
 * ⭐ GUÍA 2.4 — los textos de un módulo, para la casilla **por texto**.
 *
 * 🔴 **Excluye los `fijo`**: no se pueden apagar, y ofrecer su casilla sería mentir.
 *    El panel los cuenta aparte y lo dice (misma invariante que el interruptor).
 *
 * Los devuelve **agrupables por `tipo`** y en el orden del registro (que es el orden
 * en que el dueño los escribió — no se reordena).
 */
export function textosDe(modulo: string): TextoAyuda[] {
    const registro = AYUDAS[modulo] ?? {}
    return Object.entries(registro)
        .filter(([, def]) => !def.fijo)
        .map(([clave, def]) => ({ clave, tipo: def.tipo, texto: def.texto, fijo: false }))
}

/** Cuántas ayudas `fijo` tiene un módulo (no se pueden apagar: se informan aparte). */
export function contarFijas(modulo: string): number {
    return Object.values(AYUDAS[modulo] ?? {}).filter((def) => def.fijo).length
}

/** Las categorías, re-exportadas para que la UI no tenga que importar dos rutas. */
export { TIPOS_AYUDA }
