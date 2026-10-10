// ═══════════════════════════════════════════════════════════════════════════════
// AYUDAS · ENTRADAS › ALTA (Guía 1.6 · Fase 5) — 08 Oct 2026
//
// Los textos que EXPLICAN el puesto de Almacén, con su clave y su categoría.
// **El módulo NACE acá**: medido el 08/10/2026, `src/config/ayudas/` tenía 5 archivos
// (`index.ts` · `recepcion.ts` · `revision.ts` · `acondicionamiento.ts` · `ventas.ts`) y el
// prefijo `alta.` no existía — o sea que la explicación de este puesto **no se podía apagar**.
//
// ⚠️ REGLAS DEL REGISTRO (las mismas de todos los módulos · `acondicionamiento.ts:11-17`):
//   ① Solo entran **explicaciones**. NO entran etiquetas de botones ni mensajes de éxito.
//   ② La clave es `modulo.algo-en-kebab` y el prefijo **tiene** que ser el módulo.
//   ③ `fijo: true` = no se puede ocultar (solo el candado DENTRO de una confirmación, donde
//      el texto **es** el botón).
//   ④ Los `{variables}` se pasan al consumirla.
//
// 📌 Para quitar estos textos del código: se borra ESTE archivo y queda a la vista qué
//    `<Ayuda k="alta.*">` se quedaron sin texto. Ese es el rastreo.
//
// ⚠️ NO se cataloga, a propósito:
//    · la **etiqueta del botón «Editar»** y la de «Usar la pendiente»: son controles — un
//      botón sin su texto no es una ayuda, es un botón roto;
//    · el **conteo de pendientes** (`pendientes N`) y la **huella** de la línea: son DATO;
//    · el aviso de **«Mismo producto que otra línea»**: es una **bandera** — dice el estado
//      del cotejo, no una explicación, y apagarla dejaría al almacenista creyendo que está
//      resolviendo dos productos cuando es uno.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RegistroAyudas } from '@/types/ayudas'

export const AYUDAS_ALTA: RegistroAyudas = {
    /**
     * ⭐ 08 Oct 2026 — **el aviso de la cantidad FÍSICA editable** (lo pidió el dueño).
     *
     * ⚠️ **CORTO a propósito** (VF del dueño: *«solo un warning normal, cuadrito rojo… eso ni dan
     * ganas de leerlo jajaja, algo más sencillo **como cuando te equivocas de password**»*). El texto
     * visible es **una línea**, con el tono de un error de formulario; **el porqué completo se va al
     * `title`** (`alta.cantidad-fisica-porque`, abajo) — que es el patrón que este módulo ya
     * estableció para el aviso de capacidad (MEJORA 52): *la línea dice qué pasa, el `title` dice
     * por qué*.
     *
     * Es un `candado` y no un `aviso`: lo que se escribe va a `lotes` + `movimientos_inventario`, que
     * son **append-only** — no se deshacen, se corrigen con un asiento inverso.
     */
    'alta.cantidad-fisica': {
        tipo: 'candado',
        donde: 'CotejoAltaModal · el campo «Física» de la línea, al pulsar «Editar»',
        texto: 'Lo que entra al inventario no se deshace.',
    },
    /**
     * El porqué completo, para el `title` del aviso (tercera forma de `Ayuda` · `useAyuda`).
     * Las dos consecuencias están **medidas en `confirmarAltaBandeja`**, no supuestas: el reparto es
     * **FIFO** sobre las tandas entregadas, y la puerta de cierre (R34) exige **0 tandas sin
     * confirmar** en las dos ramas.
     */
    'alta.cantidad-fisica-porque': {
        tipo: 'nota',
        donde: 'CotejoAltaModal · el `title` del aviso de la cantidad FÍSICA',
        texto:
            'Lo que escribas acá es lo que ENTRA al inventario: nace un lote con esa cantidad y su ' +
            'movimiento, y ninguno de los dos se deshace (se corrigen con un ajuste). Si la bajás, las ' +
            'tandas se confirman en orden y el resto se queda en la bodega: la entrada NO cierra ' +
            'hasta confirmar todo. Si la subís por encima de lo entregado, queda mercancía sin su ' +
            'tanda y la entrada tampoco cierra.',
    },
}
