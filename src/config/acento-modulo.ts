// ═══════════════════════════════════════════════════════════════════════════════
// ACENTO POR MÓDULO — Remasterización Fase 2 (Guía 0.6)
//
// Cada dominio tiene su color (DOCS/design/tokens/SPEC_TOKENS_ACENTOS.md).
// Este config traduce la clave del módulo (= modulos.clave en BD, = segmento de
// ruta `/dashboard/{clave}/...`) a las CLASES de acento que el Shell consume.
// Es presentacional: vive en config, no en la BD, y el color vive en los tokens
// --acc-* (globals.css). Aquí solo se elige QUÉ clase, nunca un valor oklch.
//
// Disciplina (SISTEMA_COMPONENTES): el acento aparece ≤3 veces por pantalla.
// Fallback: rutas sin módulo declarado (/dashboard, /perfil, Ventas futuro)
// caen a NEUTRO (primary) — "sin dominio específico".
//
// ⭐ FIX 22 Sep 2026 — `fondo` y `borde` RETIRADOS: quedaron sin consumidor cuando
//    el ítem activo del sidebar pasó a fondo/texto uniformes (MEJORA 6) y nadie los
//    usaba (verificado con grep). El patrón de tinte sigue vigente —pero se escribe
//    INLINE donde hace falta (`bg-acc-{m}/10`, `border-acc-{m}/30`: p. ej. el badge
//    de las fichas de Entradas)—, no como campo del helper: un campo muerto hace
//    creer que algo lo consume.
// ═══════════════════════════════════════════════════════════════════════════════

export interface AcentoModulo {
    /** Nombre del módulo para el eyebrow del modal ('' = sin dominio → sin eyebrow). */
    nombre: string
    /** Texto/icono a pleno color: `text-acc-entradas`. */
    texto: string
    /** Relleno sólido (rail, punto, dot): `bg-acc-entradas`. */
    punto: string
}

const MAPA: Record<string, AcentoModulo> = {
    sistema: { nombre: 'Sistema', texto: 'text-acc-sistema', punto: 'bg-acc-sistema' },
    catalogos: { nombre: 'Catálogos', texto: 'text-acc-catalogos', punto: 'bg-acc-catalogos' },
    compras: { nombre: 'Compras', texto: 'text-acc-compras', punto: 'bg-acc-compras' },
    inventario: { nombre: 'Inventario', texto: 'text-acc-inventario', punto: 'bg-acc-inventario' },
    entradas: { nombre: 'Entradas', texto: 'text-acc-entradas', punto: 'bg-acc-entradas' },
}

const NEUTRO: AcentoModulo = {
    nombre: '',
    texto: 'text-primary',
    punto: 'bg-primary',
}

/** Segmento de módulo de una ruta `/dashboard/{clave}/...`. */
export function claveDeRuta(pathname: string): string {
    const partes = pathname.split('/').filter(Boolean)
    return partes[1] ?? ''
}

/** Acento del módulo dueño de la ruta. Desconocido → NEUTRO. */
export function acentoDeRuta(pathname: string): AcentoModulo {
    return MAPA[claveDeRuta(pathname)] ?? NEUTRO
}
