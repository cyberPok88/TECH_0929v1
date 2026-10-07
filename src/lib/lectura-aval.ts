// ═══════════════════════════════════════════════════════════════════════════════
// LECTURA Y AVAL — la regla de la salud, sin React (Guía 1.6 · MEJORA 44)
// ═══════════════════════════════════════════════════════════════════════════════
// Esta lógica vivía dentro de `PanelLectorDiscos.tsx`. Se separó por una razón concreta:
// **es la regla que decide si una pieza se devuelve o se vende**, y una regla así tiene
// que poder probarse sin montar un componente. Acá no hay hooks ni JSX: entra un disco,
// sale un veredicto.
//
// ⭐ LA REGLA DEL AVAL (decisión del usuario, 30 Sep 2026)
// La salud tiene TRES fuentes y NO son equivalentes:
//   · `hdsentinel` — el reporte del taller. **Decide.**
//   · `nvme`       — el % que informa el propio disco. **Decide.**
//   · `formula`    — el respaldo NUESTRO. **NO decide.**
//
// Por qué `formula` no decide, medido en `agente.py:1116`: **arranca en 100** y resta 30
// por atributo crítico en falla, el peso por sector dañado, 20 si hay otros y 10 si la
// temperatura pasa de 55 °C. O sea: si HDSentinel no tiene el disco en su reporte, la
// fórmula dice «100 %, pasa» POR DEFECTO — un falso aprobado, el error caro, porque la
// pieza sale a la venta. Y al revés: un disco con daño real puntuado por la fórmula
// mandaba una devolución con un número que el taller nunca avaló.
//
// Sin esta distinción, las tres fuentes se veían IGUAL en la ficha.
// ═══════════════════════════════════════════════════════════════════════════════

import type { DiscoLeido, EventoFormateo } from '@/lib/lector-discos'

/** Cómo se presenta el veredicto de un disco. */
export type Veredicto = 'PASA' | 'DEVOLUCION' | 'SIN_AVAL'

/**
 * ⚠️ Umbral de frescura del archivo de HDSentinel: **24 h**. Más allá de eso la salud es
 * del taller pero puede no ser la de HOY, y se avisa. No se usa un umbral corto porque
 * HDSentinel reescribe cada cierto tiempo y avisar a los 15 minutos sería ruido puro.
 */
export const SEGUNDOS_VIEJO = 24 * 60 * 60

export interface EvaluacionSalud {
    veredicto: Veredicto
    /** ¿El número salió de HDSentinel o del propio disco? Solo entonces puede decidir. */
    conAval: boolean
    /** ¿El archivo de HDSentinel es reciente? `true` si no se pudo medir la antigüedad. */
    fresco: boolean
    /** La frase que la ficha muestra al lado del número. */
    dice: string
    /** El aviso largo, cuando hay algo que el técnico tiene que saber. `null` si no hay. */
    nota: string | null
}

/**
 * ⭐ LA EVALUACIÓN DE LA SALUD — una sola función, para que la ficha y el `registrar` no
 * puedan discrepar. Dos lugares diciendo cosas distintas es el defecto más caro del
 * proyecto, y acá costaría una devolución mal puesta o una pieza mala en el anaquel.
 */
export function evaluarSalud(disco: DiscoLeido, atrasoSegundos: number | null): EvaluacionSalud {
    const puntaje = disco.salud.puntaje
    const conAval = disco.salud.apto_para_decidir && puntaje !== null
    const fresco = atrasoSegundos === null || atrasoSegundos < SEGUNDOS_VIEJO

    if (!conAval) {
        return {
            veredicto: 'SIN_AVAL',
            conAval: false,
            fresco,
            dice: 'sin salud de HDSentinel · la decide el técnico',
            nota:
                `⚠ Este número no es de HDSentinel (fuente: ${disco.salud.fuente}). ` +
                'El agente no lo encontró en su reporte y usó su fórmula propia, que arranca en 100: ' +
                'puede verse igual que un 100 % del taller y no lo es. No manda a devolución solo — ' +
                'revisá el disco y, si desconfiás, rechazalo a mano.',
        }
    }
    if (!fresco) {
        const dias = Math.floor((atrasoSegundos ?? 0) / 86400)
        return {
            veredicto: puntaje === 100 ? 'PASA' : 'DEVOLUCION',
            conAval: true,
            fresco: false,
            dice: puntaje === 100 ? 'Health 100 · pasa' : 'Health < 100 · devolución',
            nota:
                `⚠ La salud de HDSentinel tiene ${dias} día(s). El número es del taller, pero puede no ` +
                'reflejar el disco de hoy: el archivo se reescribe cada cierto tiempo, no al instante.',
        }
    }
    return {
        veredicto: puntaje === 100 ? 'PASA' : 'DEVOLUCION',
        conAval: true,
        fresco: true,
        dice: puntaje === 100 ? 'Health 100 · pasa' : 'Health < 100 · devolución',
        nota: null,
    }
}

/** Los pasos del formateo, en orden y con su texto en el idioma del operador. */
export const PASOS_FORMATEO: { clave: string; texto: string }[] = [
    { clave: 'limpiando', texto: 'limpiando (clean)…' },
    { clave: 'particion', texto: 'creando la partición…' },
    { clave: 'formato', texto: 'formateando NTFS…' },
    { clave: 'letra', texto: 'asignando letra…' },
]

export interface AvanceDisco {
    pct: number
    texto: string
    fin: boolean
    fallo: boolean
}

/**
 * ⭐ LAS FASES QUE NO SON DE UN DISCO, SINO DEL TRABAJO ENTERO.
 *
 * Error de diseño corregido el 1 Oct 2026: traté **todos** los pasos como si fueran por disco,
 * y no lo son. El `.ps1` hace una **lectura FRESCA del dock antes de tocar nada** que tarda
 * **1-2 MINUTOS**, y ese paso es global (no tiene `ns`). Como `avanceDeDisco` filtra por `ns`,
 * ese evento se descartaba **en silencio**: la barra quedaba en 0 % con la etiqueta «en cola»
 * durante dos minutos, y el técnico creía que estaba trabado — con razón.
 *
 * `texto` es la frase que ve el operador; `detalle` la letra chica.
 */
export const FASE_GLOBAL: Record<string, { texto: string; detalle: string }> = {
    preparando: {
        texto: 'Confirmando el estado del dock…',
        detalle:
            'El lector confirma qué discos son ANTES de tocar nada: si la lectura que ya tenés en ' +
            'pantalla es reciente (hasta 90 s) y vino completa, la reutiliza —así que normalmente es ' +
            'instantáneo—; si no, vuelve a leer el dock (8-11 s medidos, y hasta 1-2 minutos si la ' +
            'lectura sale incompleta y se reintenta). No vuelvas a apretar.',
    },
    /**
     * ⭐ MEJORA 49 (06 Oct 2026) — **LA PASADA ÚNICA**, y por qué la pantalla cambia.
     *
     * Medido en el puesto ese día: **cada invocación de `diskpart` cuesta ~26,5 s fijos**,
     * porque levanta y baja el servicio VDS entero (un ciclo «Servicio iniciado»/«detenido»
     * por invocación, visible en los eventos de Windows; y también en las corridas donde los
     * dos discos estaban online, así que no lo causaba el disco offline). Con 4 invocaciones
     * por disco —una por paso, para poder reportar el avance— una tanda de 2 discos pagaba
     * **8 arranques ≈ 210 s de puro overhead**: los 4 pasos medían 31,8 / 26,7 / 26,9 / 26,6 s,
     * incluido `assign`, que solo escribe una letra de unidad.
     *
     * Ahora los N discos van en **UNA sola invocación** (como hacía el `diskpart.bat` viejo,
     * que por eso «parecía» rápido). Consecuencia honesta: NO hay «un disco en curso» y los 4
     * pasos ya no llegan uno por uno, así que el modal no puede fingir que va por el primero.
     * Lo que se muestra es esta fase, con el **cronómetro** como prueba de vida.
     */
    formateando: {
        texto: 'Formateando los discos en una sola pasada…',
        detalle:
            'Los discos se preparan JUNTOS en una sola operación (limpiar → partición → NTFS → letra): ' +
            'es lo que evita pagar el arranque del servicio de discos una vez por comando. Por eso no se ' +
            've el paso por paso. El cronómetro es la prueba de vida: no cierres esta ventana.',
    },
}

/**
 * En qué fase global está el formateo. `null` = ya terminó esa parte y empezó lo de los discos.
 * Gana el ÚLTIMO evento global visto.
 */
export function faseGlobalDe(eventos: EventoFormateo[]): { clave: string; texto: string; detalle: string } | null {
    let actual: { clave: string; texto: string; detalle: string } | null = null
    for (const e of eventos) {
        if (e.evento !== 'paso' || !e.paso) continue
        const def = FASE_GLOBAL[e.paso]
        if (def) actual = { clave: e.paso, texto: def.texto, detalle: def.detalle }
    }
    return actual
}

/**
 * El avance de UN disco según los eventos que reportó el `.ps1`.
 * El último evento del disco manda: un «listo» gana sobre cualquier paso anterior, y un
 * «fallo» deja el disco marcado aunque antes hubiera avanzado.
 *
 * ⚠️ Acepta `ns` como string **o como arreglo**: el `.ps1` manda `-Ns` como lista, y hay
 * eventos (`rechazo`) donde PowerShell serializa el arreglo. Sin esto, un rechazo no se
 * pintaba en ningún disco y el técnico no sabía cuál se había dejado sin tocar.
 */
export function avanceDeDisco(eventos: EventoFormateo[], ns: string): AvanceDisco {
    const esMio = (e: EventoFormateo): boolean =>
        e.ns === ns || (Array.isArray(e.ns) && (e.ns as unknown as string[]).includes(ns))
    let pasoIdx = -1
    let fin = false
    let fallo = false
    let texto = 'en cola…'
    for (const e of eventos) {
        // ⚠️ Los eventos SIN `ns` son globales (ver `faseGlobalDe`): no son de este disco.
        if (!e.ns) continue
        if (!esMio(e)) continue
        if (e.evento === 'paso' && e.paso) {
            pasoIdx = PASOS_FORMATEO.findIndex((p) => p.clave === e.paso)
            texto = e.texto ?? PASOS_FORMATEO[pasoIdx]?.texto ?? 'trabajando…'
        } else if (e.evento === 'inicio') {
            texto = 'empezando…'
        } else if (e.evento === 'listo') {
            fin = true
            pasoIdx = PASOS_FORMATEO.length - 1
            texto = `listo (${e.segundos ?? 0} s)`
        } else if (e.evento === 'fallo') {
            fallo = true
            texto = `falló en «${e.paso ?? '?'}»${e.motivo ? `: ${e.motivo}` : ''}`
        } else if (e.evento === 'rechazo') {
            fallo = true
            texto = e.motivo ? `no se tocó: ${e.motivo}` : 'no se tocó'
        }
    }
    const pct = fin ? 100 : pasoIdx < 0 ? 0 : Math.round(((pasoIdx + 1) / PASOS_FORMATEO.length) * 100)
    return { pct, texto, fin, fallo }
}

/**
 * ⭐ MEJORA 46 — **EN QUÉ PASO VA UN DISCO.** Devuelve el índice dentro de `PASOS_FORMATEO`
 * (0..3), o `-1` si ese disco todavía no emitió ningún paso.
 *
 * Existe separado de `avanceDeDisco` por una razón concreta: aquélla devuelve el `pct` y el
 * texto (para la barra y el renglón), pero la ficha del modal necesita el **índice** para saber
 * **qué forma dibujar** (círculo → triángulo → cuadrado → rombo). Y sale de la MISMA fuente (los
 * eventos), así que la forma y la barra no pueden decir cosas distintas.
 *
 * 🔴 **Y arregla un defecto medido del código que reemplaza:** el indicador de pasos del panel
 * (`PanelLectorDiscos.tsx`, bloque «③ EL AVANCE REAL») recorría los eventos y hacía `return`
 * **en el PRIMER `paso`** del disco — o sea que `clavePaso` quedaba **siempre en 0**: durante
 * toda la corrida se veía «limpiando» como el paso activo, aunque el disco ya estuviera en
 * `formateando NTFS`. Acá **gana el ÚLTIMO `paso`** del disco, que es el que dice dónde está
 * de verdad (mismo criterio que `avanceDeDisco`).
 */
export function pasoDeDisco(eventos: EventoFormateo[], ns: string): number {
    const esMio = (e: EventoFormateo): boolean =>
        e.ns === ns || (Array.isArray(e.ns) && (e.ns as unknown as string[]).includes(ns))
    let idx = -1
    for (const e of eventos) {
        if (e.evento !== 'paso' || !e.paso || !esMio(e)) continue
        const i = PASOS_FORMATEO.findIndex((p) => p.clave === e.paso)
        if (i >= 0) idx = i // ⚠️ NO se corta: el último paso del disco es el que manda.
    }
    return idx
}

/**
 * ⭐ MEJORA 46 — **QUÉ DISCO SE ESTÁ FORMATEANDO AHORA** (su NS), o `null`.
 *
 * El modal necesita saberlo para poner el disco en grande; el panel, para saber si ya terminó
 * todo. Se deriva de los eventos y no de un contador propio: el `inicio` abre un disco y su
 * desenlace (`listo` / `fallo` / `rechazo`) lo cierra.
 *
 * ⚠️ Los eventos de la **fase global** (`paso: 'preparando'`) **no traen `ns`** y por eso no
 * cuentan: son del trabajo entero, no de un disco (ver `faseGlobalDe`).
 */
export function nsEnCurso(eventos: EventoFormateo[]): string | null {
    const ns_de = (e: EventoFormateo): string | null =>
        typeof e.ns === 'string' ? e.ns : Array.isArray(e.ns) ? ((e.ns[0] as string) ?? null) : null
    let ultimo: string | null = null
    for (const e of eventos) {
        const ns = ns_de(e)
        if (!ns) continue
        if (e.evento === 'inicio' || e.evento === 'paso') ultimo = ns
        else if (e.evento === 'listo' || e.evento === 'fallo' || e.evento === 'rechazo') {
            if (ultimo === ns) ultimo = null
        }
    }
    return ultimo
}

/** ¿El trabajo terminó por un error global (no de un disco)? */
export function errorGlobalDe(eventos: EventoFormateo[]): string | null {
    let motivo: string | null = null
    for (const e of eventos) {
        if (e.evento === 'error') motivo = e.motivo ?? 'El formateo no se pudo completar.'
    }
    return motivo
}
