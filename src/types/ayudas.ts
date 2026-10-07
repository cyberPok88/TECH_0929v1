// ═══════════════════════════════════════════════════════════════════════════════
// AYUDAS DE PANTALLA — los tipos del ESTÁNDAR (04 Oct 2026 · MEJORA 47)
//
// El problema que resuelve: cada pantalla del ERP explica lo que hace, y esa prosa
// —buena, y necesaria la primera vez— **satura** cuando ya se sabe el flujo. El
// dueño lo pidió así: *«son útiles y mucho, pero también muy invasivos… un tipo
// "ver descripción" que las muestre u oculte»*.
//
// La solución es un **registro** + un **interruptor por usuario**:
//   · cada texto vive en `src/config/ayudas/<modulo>.ts` con su CLAVE y su TIPO;
//   · la pantalla lo consume con `<Ayuda k="…" />` (o `useAyuda('…')` en props);
//   · el usuario prende y apaga por CATEGORÍA, por MÓDULO y —desde la 2.4— por
//     TEXTO SUELTO, y la preferencia se guarda en `usuarios.preferencias.ayudas`
//     (el JSONB que ya existe) ⇒ **cero SQL**.
//
// ⚠️ El registro es también el ÍNDICE: para quitar estos textos del código, se
//    borra el archivo del módulo y queda a la vista qué `<Ayuda>` se quedaron sin
//    texto. Ese rastreo es un requisito explícito del dueño, no un extra.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Las **3 categorías**. No son decorativas: son lo que se prende y se apaga.
 * · `nota`    — explica **cómo se usa** algo. La que más satura y la más inocua.
 * · `aviso`   — dice una **consecuencia** o **cómo salir** de un problema.
 * · `candado` — justifica algo **irreversible** o una **prohibición**. Apagarlo es
 *               a conciencia (decisión del dueño, 04 Oct 2026).
 */
export type TipoAyuda = 'nota' | 'aviso' | 'candado'

/** Un texto de ayuda, tal como vive en el registro de su módulo. */
export interface DefinicionAyuda {
    /** La categoría: decide a qué interruptor obedece. */
    tipo: TipoAyuda
    /** Dónde vive (`Archivo · superficie`), para poder rastrearlo y borrarlo. */
    donde: string
    /** El texto. Admite `{variables}` que se pasan al consumirlo. */
    texto: string
    /**
     * 🔴 `fijo: true` = **NO se puede ocultar**, y el interruptor lo ignora.
     *
     * Un solo caso lo usa, y está decidido: el **candado que vive DENTRO de una
     * confirmación** (`ConfirmarAccionDialog`). Ahí el texto **es** el botón —
     * «Sí, formatear de todos modos» sin decir qué se borra es un botón a ciegas.
     */
    fijo?: boolean
}

/** El registro de un módulo: clave → definición. */
export type RegistroAyudas = Record<string, DefinicionAyuda>

/**
 * ⭐ GUÍA 2.4 (05 Oct 2026) — **la 4ª dimensión.**
 *
 * Lo que un módulo puede tener declarado en la preferencia del usuario:
 *   · las **3 categorías** (lo de siempre), y
 *   · `textos`: el **TEXTO SUELTO** — `{ 'revision.lector-que-hace': false }`.
 *
 * 🔑 **Los dos niveles conviven y NO compiten: la CATEGORÍA es el maestro.**
 *    Apagar `nota` apaga **todas** las notas de ese módulo, aunque un texto suelto
 *    esté prendido; apagar un texto apaga **solo ese**. La regla completa vive en
 *    `textoAyuda()` (`components/ui/Ayuda.tsx`), que es donde se decide si un
 *    `<Ayuda>` se pinta.
 *
 * ⚠️ Retrocompatible por construcción: todo es opcional, y una preferencia guardada
 *    antes de esta guía **sigue siendo válida** (solo tiene las 3 categorías).
 */
export interface PreferenciaModulo {
    nota?: boolean
    aviso?: boolean
    candado?: boolean
    /**
     * El texto suelto, por CLAVE del registro. **Lo que no está declarado, se ve**
     * (el defecto del estándar es VER).
     */
    textos?: Record<string, boolean>
}

/**
 * La PREFERENCIA, por módulo:
 * `{ revision: { nota: true, aviso: false, textos: { 'revision.x': false } } }`.
 *
 * ⚠️ Se guarda en `usuarios.preferencias.ayudas` (JSONB) y se escribe con el mismo
 *    `actualizarPreferencias()` del tema: **merge parcial**, y `ayudas` entra
 *    completo (igual que `tema`), así que la clave nunca pisa a las otras.
 */
export type PreferenciasAyudas = Record<string, PreferenciaModulo>

/** Las 3 categorías en orden de presentación (de la más inocua a la más seria). */
export const TIPOS_AYUDA: readonly TipoAyuda[] = ['nota', 'aviso', 'candado'] as const

/** Cómo se llama cada categoría en la pantalla. */
export const NOMBRE_TIPO: Record<TipoAyuda, string> = {
    nota: 'Cómo se usa',
    aviso: 'Consecuencias',
    candado: 'Irreversible',
}
