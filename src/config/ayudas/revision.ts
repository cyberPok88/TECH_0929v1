// ═══════════════════════════════════════════════════════════════════════════════
// AYUDAS · ENTRADAS › REVISIÓN (Guía 1.6) — MEJORA 47 · 04 Oct 2026
//
// Los textos que EXPLICAN la pantalla de Revisión, con su clave y su categoría.
// Es el primer módulo del estándar: el molde para los demás.
//
// ⚠️ REGLAS DEL REGISTRO (las mismas para todos los módulos):
//   ① Solo entran **explicaciones**. NO entran etiquetas de botones ni mensajes
//      de éxito: un botón sin su texto no es una ayuda, es un botón roto.
//   ② La clave es `modulo.algo-en-kebab` y el prefijo **tiene** que ser el módulo
//      (el interruptor agrupa por ese prefijo).
//   ③ `fijo: true` = no se puede ocultar. Un solo caso: el candado que vive
//      DENTRO de una confirmación, donde el texto **es** el botón (decidido D2-A).
//   ④ Los `{variables}` se pasan al consumirla: `<Ayuda k="…" vars={{ n: 2 }} />`.
//
// 📌 Para quitar estos textos del código: se borra ESTE archivo y queda a la vista
//    qué `<Ayuda k="revision.*" />` se quedaron sin texto. Ese es el rastreo.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RegistroAyudas } from '@/types/ayudas'

export const AYUDAS_REVISION: RegistroAyudas = {
    // ── Wizard de revisión ─────────────────────────────────────────────────────
    'revision.atras-vuelve-a-la-lista': {
        tipo: 'nota',
        donde: 'WizardRevision · cabecera de la primera pantalla',
        texto: 'Para tomar otra partida, «← Atrás» vuelve a la lista.',
    },
    // ── El lector de discos (el panel) ─────────────────────────────────────────
    // ⚠️ OJO: el texto de «El lector no encontró discos…» NO está acá **a propósito**.
    //    Vive en el estado `nota` del panel, que es **el mensaje Y la bandera** (cambia
    //    el borde, la etiqueta del botón y su variante). Si se ocultara quedaría vacío
    //    ⇒ el panel creería que NO hubo error y el técnico perdería el «Volver a
    //    intentar». **Un mensaje de estado o de error NO es una ayuda:** ocultarlo no
    //    limpia la pantalla, esconde una falla. (Medido al cablearlo, 04 Oct 2026.)
    'revision.lector-consultando': {
        tipo: 'aviso',
        donde: 'PanelLectorDiscos · leyendo',
        texto: 'El lector está consultando cada disco del dock (CrystalDiskInfo + HDSentinel). Tarda unos segundos.',
    },
    'revision.lector-que-hace': {
        tipo: 'nota',
        donde: 'PanelLectorDiscos · pie del bloque del lector',
        texto: 'El lector de esta PC lee cada disco y devuelve marca · modelo · NS · horas · salud. No capturás nada a mano.',
    },
    'revision.lector-no-ve-discos': {
        tipo: 'aviso',
        donde: 'PanelLectorDiscos · leer (tras un intento sin discos)',
        texto: 'Cuando el lector los vea, volvé a intentar. Si el dock está encendido y con discos, avisá a sistemas: puede faltar el agente o el permiso de red local.',
    },
    'revision.expulsar-que-hace': {
        tipo: 'nota',
        donde: 'PanelLectorDiscos · barra de acciones · botón expulsar (title)',
        texto: 'Apaga el puente USB para poder desconectar el dock sin riesgo.',
    },
    'revision.expulsar-con-formateo': {
        tipo: 'aviso',
        donde: 'PanelLectorDiscos · barra de acciones · botón expulsar (title)',
        texto: 'No se puede expulsar con un formateo en curso.',
    },
    // ── ⭐ MEJORA 52 (07 Oct 2026) — la pieza que NO es de lo que dice la entrada ──────────
    // El aviso en pantalla es de DOS LÍNEAS (decisión del dueño: *«si me agrada el mensaje solo
    // que dice mucho»*): el rótulo, el botón, y la consecuencia. **El porqué vive acá**, en el
    // `title` del botón — es el patrón de la casa (MEJORA 47, tercera forma de `Ayuda`).
    'revision.capacidad-diferente': {
        tipo: 'aviso',
        donde: 'PanelLectorDiscos · ficha del disco · botón «Crear partida» (title)',
        texto: 'Este disco NO es de lo que dice la entrada: la partida declara {declarada} y el disco mide {medida}. «Crear partida» manda la pieza a la partida de {medida} (reclasificación) y RECEPCIÓN valida el ajuste al cerrar la revisión; la nota original no se modifica. Si no se corrige, el inventario queda descuadrado: el SKU diría {medida} dentro de una partida de {declarada}. La otra salida es rechazarla con su motivo.',
    },
    // ── El modal del formateo ─────────────────────────────────────────────────
    'revision.formateo-por-que-relee': {
        tipo: 'aviso',
        donde: 'ModalFormateo · estado preparando',
        texto: 'El lector vuelve a leer los discos ANTES de tocar nada, para confirmar que son los mismos que revisaste.',
    },
    'revision.formateo-que-hace': {
        tipo: 'candado',
        donde: 'ModalFormateo · estado corriendo',
        texto: 'Se le borran TODAS las particiones y se formatea en NTFS. No se puede cerrar hasta que termine.',
    },
    'revision.formateo-como-quedo': {
        tipo: 'nota',
        donde: 'ModalFormateo · estado terminado',
        texto: 'Los discos quedaron NTFS con su etiqueta. El disco del sistema nunca se toca.',
    },
    'revision.formateo-revisa-antes': {
        tipo: 'aviso',
        donde: 'ModalFormateo · estado cortado',
        texto: 'Nada se escribe a ciegas: revisá el disco antes de seguir.',
    },
    'revision.formateo-no-se-cierra': {
        tipo: 'candado',
        donde: 'ModalFormateo · aviso del candado (mientras corre)',
        texto: 'El disco se está borrando: si el proceso se corta a la mitad, el disco queda a medio formatear. La salida se abre con el resultado.',
    },
    // ── La salida con algo sin guardar (la confirmación) ──────────────────────
    // 🔴 `fijo: true` en las DOS: viven en el `detalle` de un `ConfirmarAccionDialog`,
    //    que el kit pinta en ROJO y es lo ÚNICO que dice qué se pierde. Apagarlas
    //    dejaría un «Salir igual» a ciegas ⇒ no se ocultan (decisión D2-A del dueño).
    'revision.salir-pierde-avance-lista': {
        tipo: 'candado',
        fijo: true,
        donde: 'WizardRevision · confirmación de «volver a la lista» · detalle',
        texto: 'Si volvés sin guardar el avance, esas piezas se pierden y hay que revisarlas otra vez. Los discos leídos quedan sin registrar y el formateo, si está corriendo, sigue sin que nadie lo mire.',
    },
    'revision.salir-pierde-avance': {
        tipo: 'candado',
        fijo: true,
        donde: 'WizardRevision · confirmación de «salir» · detalle',
        texto: 'Si salís sin guardar el avance, esas piezas se pierden. Los discos leídos quedan sin registrar y el formateo, si está corriendo, sigue sin que nadie lo mire.',
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // ⭐ EL DESGLOSE DE REVISIÓN EN UN MODAL (Fase 2 · 06 Oct 2026 · mockup aprobado
    //    `DOCS/design/entradas/02-revision/01-detalle-revision.html`)
    //
    // El chevron de la cola ya no despliega la fila: abre `AvanceRevisionModal` con el MISMO
    // desglose (`PartidasAvance`, que gana `enModal`). Y sus `title` —que eran LITERALES inline
    // (medido: `PartidasAvance.tsx:361, 367, 372, 378, 391, 397, 403, 476, 506, 630, 648, 655,
    // 717, 734, 785`)— pasan al registro: **hasta hoy la explicación de esta superficie no se
    // podía apagar**.
    //
    // ⚠️ Acá SÓLO hay `nota`: es una superficie de sólo lectura —no captura nada y no hay nada
    // irreversible— ⇒ no hay `aviso` ni `candado`.
    // ⚠️ NO se cataloga, a propósito (clasificador del estándar · skill `ayudas-pantalla` §1.2):
    //    · la **frase de avance** de Z1 («1 pieza aprobada sin liberar en 2 productos»): es **DATO**
    //      — el interruptor apaga explicaciones, jamás el estado;
    //    · el **porqué de cada control apagado** (`motivoRevisar` · `motivoLiberar` · `motivoVer` y
    //      el «Esta vista es de solo lectura.»): es **BANDERA** — vaciarla dejaría el botón mudo,
    //      que es justo lo que la SPEC §2.3 prohíbe. Vive **inline** en `PartidasAvance`;
    //    · el `title` de la celda «#» cuando la línea NO viene de una partida múltiple
    //      («Partida 3») y el del caso de sólo lectura de la DEV («2 piezas devueltas de X…»):
    //      **nombran el dato**, no lo explican;
    //    · la etiqueta de un control · el **nombre accesible del chevron** · el `sr-only` «Acciones».
    //
    // ⚠️ Las claves de `recepcion.ts` **no se renombran ni se mueven**: los dos desgloses dicen
    //    cosas PARECIDAS pero NO idénticas del mismo encabezado (el «DEV» de Recepción explica otra
    //    tabla que el de Revisión). Es deliberado; unificarlas es una decisión aparte.
    //
    // ⚠️ Los `{marcadores}` se pasan al consumir la ayuda (`useAyuda` en un `title` fijo,
    //    `textoAyuda` cuando el texto depende de la FILA que se está pintando).
    // ═══════════════════════════════════════════════════════════════════════════

    // Z2 · los encabezados — qué mide cada columna
    'revision.detalle-th-numero': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, encabezado «#»',
        texto: 'En la fila de PARTIDA, el número de la partida declarada; en las de producto, el consecutivo del producto en la entrada.',
    },
    'revision.detalle-th-producto': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, encabezado «Producto»',
        texto: 'En la fila de PARTIDA, lo declarado en recepción. En las de producto, la huella (marca + atributos) que produjo la REVISIÓN.',
    },
    'revision.detalle-th-recib': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, encabezado «Recib.»',
        texto: 'Piezas DE ESTE PRODUCTO: aprobadas + devueltas. En una partida sin revisar, lo declarado en recepción.',
    },
    'revision.detalle-th-revisadas': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, encabezado «Revisadas»',
        texto: 'Aprobadas + devueltas de ESTE producto, sobre las piezas de esta línea',
    },
    'revision.detalle-th-aprob': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, encabezado «Aprob.»',
        texto: 'Piezas aprobadas de este producto (se pagarán)',
    },
    'revision.detalle-th-dev': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, encabezado «DEV»',
        texto: 'Piezas rechazadas de este producto — abre la devolución',
    },
    'revision.detalle-th-faltan': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, encabezado «Faltan»',
        texto: 'Piezas que faltan por revisar en la PARTIDA: nadie las revisó, así que todavía no tienen huella y no se reparten por línea.',
    },
    'revision.detalle-th-estado': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, encabezado «Estado»',
        texto: 'Estado de la PARTIDA en la etapa (sus líneas lo comparten: es el mismo hecho)',
    },

    // Z2 · las celdas que EXPLICAN de dónde sale el dato
    'revision.detalle-celda-producto-padre': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, celda «Producto» de la fila de PARTIDA',
        texto: 'Lo que Recepción declaró (categoría + atributos de recepción). Debajo, lo que la revisión encontró.',
    },
    'revision.detalle-celda-producto-hijo': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, celda «Producto» de la fila de PRODUCTO',
        texto: 'Declarado en recepción: {huella}',
    },
    'revision.detalle-celda-linea': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, celda «#» de una línea que viene de una partida múltiple',
        texto: 'Línea {n} de la entrada · viene de la partida {partida} declarada',
    },

    // Z1 · la toolbar de avance (las 4 puertas), con el título del control ENCENDIDO
    'revision.detalle-revisar': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z1, «Revisar (n)»',
        texto: 'Abre la revisión en la partida #{partida}, que es la que tiene piezas pendientes.',
    },
    'revision.detalle-liberar-todo': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z1, «Liberar todo (n)»',
        texto: 'Abre la liberación con TODOS los productos de la entrada ya cargados ({n} pieza(s) aprobadas).',
    },
    'revision.detalle-ver': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z1, «Ver revisión completa»',
        texto: 'El resultado de la revisión de toda la entrada.',
    },
    'revision.detalle-imprimir': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z1, «Imprimir revisión»',
        texto: 'Acta de revisión para firmar: partidas, productos, aprobadas y DEV.',
    },

    // Z2 · las acciones de las filas de PARTIDA y de PRODUCTO
    'revision.detalle-revisar-partida': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, fila de PARTIDA, «Revisar (n)»',
        texto: 'Abrir la revisión de la partida #{partida}: {n} pieza(s) por revisar.',
    },
    'revision.detalle-liberar-partida': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, fila de PARTIDA, «Liberar n»',
        texto: '{n} pieza(s) aprobadas de la partida #{partida} (todos sus productos) pueden pasar ya a limpieza.',
    },
    'revision.detalle-liberar-producto': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, fila de PRODUCTO, «Liberar n»',
        texto: '{n} pieza(s) aprobadas de ESTE producto pueden pasar ya a limpieza, sin esperar al resto de la partida.',
    },
    /**
     * ⚠️ La DEV se cuenta y puede ser UNA o VARIAS (`1 mala` / `2 malas`): el `{objeto}` entra ya
     * conjugado («la devolución» · «las 2 devoluciones») porque el registro guarda el texto
     * LITERAL del componente y el singular/plural es parte de él. Son DOS claves y no una porque
     * son dos frases distintas: la de la partida no dice la marca, la del producto sí.
     */
    'revision.detalle-ver-dev': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, píldora DEV de la fila de PRODUCTO',
        texto: 'Ver {objeto} de {marca} en la partida #{partida}.',
    },
    'revision.detalle-ver-dev-partida': {
        tipo: 'nota',
        donde: 'PartidasAvance · Z2, píldora DEV de la fila de PARTIDA',
        texto: 'Ver {objeto} de la partida #{partida}.',
    },
}
