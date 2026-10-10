// ═══════════════════════════════════════════════════════════════════════════════
// AYUDAS · ENTRADAS › ACONDICIONAMIENTO (Guía 1.6 · Fase 3) — 06 Oct 2026
//
// Los textos que EXPLICAN el puesto del acondicionador, con su clave y su categoría.
// **El módulo NACE acá**: medido el 06/10/2026, `src/config/ayudas/` tenía 4 archivos
// (`index.ts` · `recepcion.ts` · `revision.ts` · `ventas.ts`) y el prefijo
// `acondicionamiento.` no existía — o sea que **hasta hoy la explicación de este
// puesto no se podía apagar** (medido: `AcondicionamientoCatalogo` tenía 3 `title`
// inline y **0 `useAyuda`**).
//
// ⚠️ REGLAS DEL REGISTRO (las mismas de todos los módulos · `revision.ts:7-14`):
//   ① Solo entran **explicaciones**. NO entran etiquetas de botones ni mensajes de
//      éxito: un botón sin su texto no es una ayuda, es un botón roto.
//   ② La clave es `modulo.algo-en-kebab` y el prefijo **tiene** que ser el módulo
//      (el interruptor agrupa por ese prefijo).
//   ③ `fijo: true` = no se puede ocultar (solo el candado dentro de una confirmación).
//   ④ Los `{variables}` se pasan al consumirla (`useAyuda('…', { n: 4 })`).
//
// 📌 Para quitar estos textos del código: se borra ESTE archivo y queda a la vista
//    qué `useAyuda('acondicionamiento.*')` se quedaron sin texto. Ese es el rastreo.
//
// ⚠️ NO se cataloga, a propósito (clasificador del estándar · §1.2 del mockup
//    `DOCS/design/entradas/03-acondicionamiento/01-detalle-acondicionamiento.html`):
//    · la **píldora de estado de la tanda** (`TEXTO_ESTADO_TANDA`) y el **saldo/conteo**
//      de la frase de Z1: son **DATO** — el interruptor apaga explicaciones, jamás el
//      estado;
//    · el **porqué de cada control apagado** («Esta tanda ya salió de acondicionamiento.» ·
//      «No tienes permiso para acondicionar.» · «No queda nada por limpiar en este
//      ingreso.» · «No hay nada en limpieza en este ingreso.»): es **BANDERA** — vaciarla
//      dejaría el botón **mudo** y el puesto creería que puede (SPEC §2.3/§2.6). Vive
//      inline en `AcondicionamientoCatalogo`;
//    · el **vacío de la etapa** («Este ingreso no tiene tandas liberadas todavía: lo que
//      le falta a esta etapa es cerrar el documento.»): es el estado del proceso **Y** su
//      bandera — es el texto que dice qué hacer (mismo caso que `revision.ts:30-35`
//      documenta para el lector de discos). Vive inline en `BandejasDeIngreso`;
//    · la **etiqueta de un control** y el **nombre accesible del chevron** (que lo pone
//      el kit desde `DataTable.etiquetaFila`).
//
// ⚠️ Y este archivo nace **sin ningún `candado`**: el detalle no captura nada
//    irreversible por sí solo. La entrega masiva la confirma el `ConfirmarAccionDialog`
//    (`AcondicionamientoCatalogo:439-443`), y **ese texto es de la confirmación, no del
//    detalle**: catalogarlo es una decisión aparte (declarada en el mockup).
//
// ⚠️ Las 2 claves de Z1 y las 2 de las acciones de bandeja son **literales del código**
//    (`AcondicionamientoCatalogo.tsx`); los 4 encabezados de Z2 **no tenían `title` hoy**
//    (medido: la sub-tabla no pasaba ninguno) ⇒ nacen con este cableado.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RegistroAyudas } from '@/types/ayudas'

export const AYUDAS_ACONDICIONAMIENTO: RegistroAyudas = {
    // ── Z1 · la barra del ingreso (las 2 puertas masivas del puesto) ───────────
    'acondicionamiento.limpiar-todas': {
        tipo: 'nota',
        donde: 'AcondicionamientoCatalogo · Z1 del detalle, «Limpiar todas (n)»',
        texto: 'Pone a limpieza TODO lo que está por limpiar de este ingreso.',
    },
    'acondicionamiento.entregar-todo': {
        tipo: 'nota',
        donde: 'AcondicionamientoCatalogo · Z1 del detalle, «Terminar y entregar todo (n)»',
        texto: 'Entrega al almacén TODO lo que está en limpieza de este ingreso.',
    },

    // ── Z2 · los encabezados de la sub-tabla de BANDEJAS ──────────────────────
    'acondicionamiento.detalle-th-tanda': {
        tipo: 'nota',
        donde: 'BandejasDeIngreso · Z2, encabezado «Tanda»',
        texto: 'El folio de la tanda que trajo esta mercancía. Una bandeja agrupa TODAS las tandas del mismo producto: por eso puede decir «T1, T2».',
    },
    'acondicionamiento.detalle-th-producto': {
        tipo: 'nota',
        donde: 'BandejasDeIngreso · Z2, encabezado «Producto»',
        texto: 'La huella resuelta por la revisión (marca + atributos). En la fila de PARTIDA, la categoría declarada en recepción.',
    },
    'acondicionamiento.detalle-th-piezas': {
        tipo: 'nota',
        donde: 'BandejasDeIngreso · Z2, encabezado «Piezas»',
        texto: 'Piezas de esta bandeja. Es lo que se limpia y se entrega.',
    },
    'acondicionamiento.detalle-th-estado': {
        tipo: 'nota',
        donde: 'BandejasDeIngreso · Z2, encabezado «Estado»',
        texto: 'Estado de la tanda en el puesto: por limpiar · en limpieza · lista para almacén · en almacén.',
    },

    // ── Z2 · la acción de la fila de PRODUCTO (el control ENCENDIDO) ──────────
    // ⚠️ El `title` del control APAGADO es bandera (el porqué) y vive inline en el
    //    catálogo: son dos textos distintos para dos momentos distintos.
    'acondicionamiento.detalle-iniciar': {
        tipo: 'nota',
        donde: 'AcondicionamientoCatalogo · Z2, «Iniciar acondicionamiento» de la fila de producto',
        texto: 'Inicia la limpieza de ESTA huella: {n} pieza(s).',
    },
    'acondicionamiento.detalle-entregar': {
        tipo: 'nota',
        donde: 'AcondicionamientoCatalogo · Z2, «Terminar y entregar» de la fila de producto',
        texto: 'Entrega al almacén ESTA huella: {n} pieza(s) en limpieza.',
    },
}
