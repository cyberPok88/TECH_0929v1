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
}
