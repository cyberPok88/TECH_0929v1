// ═══════════════════════════════════════════════════════════════════════════════
// AYUDAS · ENTRADAS › RECEPCIÓN (Guía 1.6) — MEJORA 47 · 05 Oct 2026
//
// Los textos que EXPLICAN el puesto de Recepción: el modal de alta/edición de una entrada y,
// desde el 05 Oct 2026, el **desglose de la entrada** (el chevron → `EntradaDetalleModal`).
// El molde es `revision.ts`.
//
// ⚠️ REGLAS DEL REGISTRO (las mismas para todos los módulos):
//   ① Solo entran **explicaciones**. NO entran etiquetas de botones · placeholders ·
//      mensajes de validación · el DATO · ni **el porqué de un control apagado**
//      (ese texto es BANDERA: ocultarlo haría creer que la acción se puede hacer).
//   ② La clave es `modulo.algo-en-kebab` y el prefijo **tiene** que ser el módulo
//      (el interruptor agrupa por ese prefijo).
//   ③ `fijo: true` = no se puede ocultar. Un solo caso: el candado que vive DENTRO
//      de una confirmación, donde el texto **es** el botón.
//   ④ Los `{variables}` se pasan al consumirla: `<Ayuda k="…" vars={{ n: 2 }} />`.
//
// 📌 Para quitar estos textos del código: se borra ESTE archivo y queda a la vista
//    qué `<Ayuda k="recepcion.*" />` se quedaron sin texto.
//
// ⚠️ MEDIDO EL 05 Oct 2026 (antes de este archivo): Recepción **no tenía NI UNA
//    ayuda cableada** — sus frases vivían en el código y **no se podían apagar**.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RegistroAyudas } from '@/types/ayudas'

export const AYUDAS_RECEPCION: RegistroAyudas = {
    // ── Z1 · el flujo de la entrada (la primera decisión) ──────────────────────
    'recepcion.flujo-no-nueva': {
        tipo: 'nota',
        donde: 'EntradaModal · Z1, bajo la opción «Mercancía NO nueva»',
        texto: '4 categorías · pide NS · pasa por Revisión',
    },
    'recepcion.flujo-nueva': {
        tipo: 'nota',
        donde: 'EntradaModal · Z1, bajo la opción «Mercancía nueva»',
        texto: 'las 18 categorías · no pide NS · directo a acondicionamiento',
    },
    'recepcion.sin-revision': {
        tipo: 'aviso',
        donde: 'EntradaModal · Z1, bajo el control del flujo',
        texto: 'Salta la revisión pieza a pieza y va directo a acondicionamiento.',
    },

    // ── Z3 · las partidas ──────────────────────────────────────────────────────
    'recepcion.partidas-que-captura': {
        tipo: 'nota',
        donde: 'EntradaModal · Z3, sobre el grid de partidas',
        texto: 'Elige la categoría de cada línea. Marca y atributos (capacidad, tipo, bus…) se capturan en revisión al resolver el SKU.',
    },
    'recepcion.cantidad-editable': {
        tipo: 'nota',
        donde: 'PartidasEntradaGrid · Z3.a, bajo el paso de cantidad',
        texto: 'Toca la cifra para escribirla directo (p. ej. 220).',
    },
    'recepcion.sin-atributos': {
        tipo: 'nota',
        donde: 'PartidasEntradaGrid · Z3.a, categoría sin atributos de entrada',
        texto: 'Se identifica al darla de alta: no hay nada que capturar acá.',
    },

    // ── Z3.a · el chip de número de serie ──────────────────────────────────────
    // 🔴 FIX 3 (05 Oct 2026 · dueño): **el control de NS no se muestra por ahora** —la mercancía de
    //    este ERP trae serial casi siempre— ⇒ sus 3 textos **salieron del registro**: una clave sin
    //    usar es deuda (se pudre sin que nadie la vea). Cuando el control vuelva, vuelven con estos
    //    literales EXACTOS:
    //      «En revisión se escaneará un NS por cada una de las {n} piezas.»  · chip encendido
    //      «La revisión no pedirá escaneos.»                                 · chip apagado
    //      «La mercancía nueva no pasa por revisión: aquí no se piden NS.»   · flujo nueva (aviso)

    // ── Z4 · el pie fijo ───────────────────────────────────────────────────────
    'recepcion.total-fijo': {
        tipo: 'nota',
        donde: 'EntradaModal · Z4, el pie fijo del modal',
        texto: 'El total y las acciones no se mueven: el grid tiene su propio scroll.',
    },

    // ── ⭐ MEJORA 05 Oct 2026 · EL DESGLOSE DE LA ENTRADA (el chevron → `EntradaDetalleModal`) ──
    // El mockup aprobado (`DOCS/design/entradas/01-recepcion/10-detalle-entrada.html`) cataloga
    // TODO lo que EXPLICA esta superficie nueva. Acá **sólo hay `nota`**: es una pantalla de sólo
    // lectura —no captura nada y no hay nada irreversible— ⇒ no hay `aviso` ni `candado`.
    // ⚠️ NO se cataloga, a propósito (clasificador del estándar · skill `ayudas-pantalla` §1.2):
    //    · la **frase de contexto** de Z1 («N piezas devueltas por ajustar · nota sin generar»):
    //      es **DATO** — una fila de estado. El interruptor apaga explicaciones, jamás el estado;
    //    · el porqué del **`Imprimir nota` de la toolbar de la PÁGINA** cuando no hay detalle
    //      abierto («Abre los detalles de una entrada para imprimir su nota de entrada.»): es
    //      **BANDERA** — vaciarla dejaría el botón mudo. Vive inline en `RecepcionCatalogo`;
    //    · el `title`/`aria-label` de los DOS chevrones (es el **nombre accesible**, no una
    //      explicación) · el texto de una **píldora de estado** · el `sr-only` «Acciones».

    // Z1 · la toolbar de detalles (las 4 puertas)
    'recepcion.etapas-ingreso': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z1, «Etapas del ingreso»',
        texto: 'Cómo va este ingreso por sus 4 etapas: Recepción · Revisión · Acondicionamiento · Almacén (solo lectura).',
    },
    'recepcion.ver-nota': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z1, «Ver nota» (encendido)',
        texto: 'La nota de compra de esta entrada.',
    },
    // ⭐ EL BORDE QUE HAY QUE DECIR EN VOZ ALTA (medido en el mockup): el `title` de `Ver nota`
    // APAGADO **sí** se cataloga. Su `disabled` sale de `!id_nota || !onVerNota` y **vaciar el
    // texto no cambia el flujo** ⇒ es una explicación, no una bandera. Si algún día el `disabled`
    // se derivara del texto, dejaría de catalogarse.
    'recepcion.ver-nota-apagada': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z1, «Ver nota» apagado',
        texto: 'Todavía no hay nota de compra de esta entrada.',
        /**
         * 🔴 `fijo: true` — **este texto NO se puede ocultar**, y no es un capricho: es el
         * **porqué de un control apagado**. Ocultarlo dejaría el botón mudo, que es justo lo que
         * la SPEC §2.2 prohíbe («deshabilitar sin decir por qué»). Es el mismo criterio con el que
         * el estándar marca `fijo` el candado que vive dentro de una confirmación: **el texto es
         * parte del control**, no una explicación que se pueda apagar.
         * (Corregido en la validación del 05 Oct 2026: había entrado como `nota` ocultable.)
         */
        fijo: true,
    },
    'recepcion.imprimir-nota': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z1, «Imprimir nota»',
        texto: 'Imprime la nota de entrada de esta entrada (el papel que se firma al recibir).',
    },

    // Z2 · la fila de PARTIDA (sus 2 control-píldoras)
    'recepcion.ajustar-nota': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, fila de PARTIDA, «Ajustar + nota»',
        texto: 'Ajusta la devolución y genera la nota de compra de la entrada.',
    },
    'recepcion.ver-devolucion': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, fila de PARTIDA, «Ver devolución»',
        texto: 'Ver la devolución: partida, producto, motivo y estado.',
    },

    // La toolbar de la PÁGINA (`RecepcionCatalogo`), con el folio del detalle abierto
    'recepcion.imprimir-nota-toolbar': {
        tipo: 'nota',
        donde: 'RecepcionCatalogo · toolbar de la página, «Imprimir nota» con detalle abierto',
        texto: 'Nota de entrada de {folio}, para firmar.',
    },

    // Z2 · los encabezados (los que explican qué mide cada columna)
    'recepcion.th-partida': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, encabezado «Partida / #»',
        texto: 'La partida y, bajo ella, el consecutivo de cada producto',
    },
    'recepcion.th-producto': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, encabezado «Producto»',
        texto: 'Categoría y atributos capturados en recepción (la huella declarada)',
    },
    'recepcion.th-recib': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, encabezado «Recib.»',
        texto: 'En la fila de PARTIDA, lo que la partida TIENE (ya con lo que salió por reclasificación y lo que llegó); en las de producto, las piezas de ese producto. ⭐ Antes decía lo DECLARADO, y una partida a la que se le fueron piezas seguía diciendo 4 cuando le quedaban 2: la verdad declarada vive en la nota.',
    },
    'recepcion.th-dev': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, encabezado «DEV»',
        texto: 'De la partida en su fila; de cada producto en la suya (la pieza devuelta dice su marca).',
    },
    'recepcion.th-final': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, encabezado «Final»',
        texto: 'Lo que queda tras el ajuste en la fila de partida; lo aprobado de cada producto en la suya.',
    },
    'recepcion.th-estado': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, encabezado «Estado»',
        texto: 'Estado de la PARTIDA',
    },
    'recepcion.th-costo': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, encabezado «Costo»',
        texto: 'Costo acordado de la PARTIDA',
    },

    // Z2 · las celdas de la fila de PARTIDA (lo de la partida, no lo de sus productos)
    'recepcion.celda-producto': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, celda «Producto» de la fila de PARTIDA',
        texto: 'Lo que Recepción declaró. Debajo, lo que la revisión encontró.',
    },
    'recepcion.celda-recibidas': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, celda «Recib.» de la fila de PARTIDA',
        texto: 'Piezas declaradas en recepción',
    },
    'recepcion.celda-dev-partida': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, celda «DEV» de la fila de PARTIDA',
        texto: 'DEV de la PARTIDA (Σ de sus productos)',
    },

    // Z2 · las celdas de la fila de PRODUCTO (la huella de cada pieza)
    'recepcion.celda-dev-producto': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, celda «DEV» de la fila de PRODUCTO',
        texto: 'DEV de ESTE producto (la pieza devuelta dice su marca)',
    },
    'recepcion.celda-recibidas-producto': {
        tipo: 'nota',
        donde: 'PartidasExpandidas · Z2, celda «Recib.» de la fila de PRODUCTO',
        texto: 'Piezas DE ESTE producto: aprobadas + devueltas',
    },

    // ⚠️ ACÁ **NO** VA el porqué de un control apagado («No entra en «NO nueva»: solo HDD · RAM ·
    //    SSD · M.2», el bloqueo del estado H). Es **BANDERA**: si se ocultara, el botón quedaría
    //    mudo y la pantalla **creería** que se puede registrar. El clasificador del estándar lo
    //    excluye (skill `ayudas-pantalla` §1.2) ⇒ vive **inline** en `EntradaModal`, no acá.
}
