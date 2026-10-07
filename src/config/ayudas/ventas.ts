// ═══════════════════════════════════════════════════════════════════════════════
// AYUDAS — VENTAS · NOTA DE REMISIÓN (MEJORA 47 · 05 Oct 2026)
//
// Los textos que EXPLICAN esta pantalla, catalogados para que el usuario los prenda
// y apague desde el interruptor del Topbar (por módulo y por categoría).
//
// ⚠️ LO QUE **NO** ENTRA ACÁ (la frontera de la skill `ayudas-pantalla` §1):
//   · el DATO — folio, total, cantidad, `n/N NS`, existencia, plazos → es la pantalla;
//   · los ERRORES y los `toast` — aparecen por lo que el usuario hizo;
//   · 🔴 **el aviso de «Sin existencia» del renglón**: va a estado Y es BANDERA (dice que
//     la emisión va a fallar) ⇒ apagarlo cambiaría el flujo. Queda SIEMPRE visible;
//   · los textos que llevan cifras (`Se pierden 3 renglones`) — no se pueden catalogar.
//
// ⭐ Y es el ÍNDICE para poder quitarlos después: se borra este archivo y quedan a la
//    vista los `<Ayuda>` que se quedaron sin texto.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RegistroAyudas } from '@/types/ayudas'

export const AYUDAS_VENTAS: RegistroAyudas = {
    // ── El modal de emisión · cabecera ────────────────────────────────────────
    'ventas.modal-que-hace': {
        tipo: 'nota',
        donde: 'NotaRemisionModal · descripción del diálogo',
        texto: 'Al emitir, la nota descuenta inventario y abre la cuenta por cobrar del cliente.',
    },

    // ── Zona 1 · cliente y condiciones ───────────────────────────────────────
    'ventas.cliente-hereda': {
        tipo: 'nota',
        donde: 'NotaRemisionCabecera · Zona 1 · debajo del selector de cliente',
        texto: 'De acá salen el precio (su lista), la marca de la nota y el vendedor: no se eligen a mano.',
    },
    'ventas.credito-preseleccionado': {
        tipo: 'nota',
        donde: 'NotaRemisionCabecera · Zona 1 · debajo de «¿Crédito?»',
        texto: 'Preseleccionado: el negocio es de crédito y el contado es el caso minoritario.',
    },
    'ventas.emision-hoy': {
        tipo: 'nota',
        donde: 'NotaRemisionCabecera · Zona 1 · debajo de Emisión',
        texto: 'Viene en hoy; se puede cambiar.',
    },
    /**
     * ⭐ EL 3er NIVEL DE DESCUENTO (05 Oct 2026). Es `nota` y no `aviso` porque **enseña el
     * orden** de los descuentos: sin esta frase, un 4% acá parece sumarse al de la partida
     * en vez de aplicarse después. La regla vive en `docs/logica-negocio.md`.
     */
    'ventas.descuento-documento': {
        tipo: 'nota',
        donde: 'NotaRemisionCabecera · Zona 1 · debajo de «Desc. documento %»',
        texto: 'Se escribe en % (4 = 4%) y se aplica al TOTAL de la nota, después del descuento de la lista y del de cada renglón.',
    },

    // ── Zona 3 · partidas ────────────────────────────────────────────────────
    'ventas.sin-cliente-no-captura': {
        tipo: 'aviso',
        donde: 'PartidasRemisionGrid · estado vacío sin cliente (escenario A)',
        texto: 'El renglón toma su precio de la lista de ESE cliente, así que el cliente va primero. Después agregás partidas y el total se arma solo.',
    },
    'ventas.cortesia-a-cero': {
        tipo: 'nota',
        donde: 'PartidasRemisionGrid · renglón de cortesía',
        texto: 'La cortesía manda el renglón a $0 y lo exime del piso de precio.',
    },
    'ventas.cortesia-motivo-obligatorio': {
        tipo: 'candado',
        donde: 'PartidasRemisionGrid · renglón de cortesía · campo del motivo',
        texto: 'El motivo es obligatorio: una cortesía sin motivo no se puede emitir.',
    },
    'ventas.ns-desde-el-renglon': {
        tipo: 'nota',
        donde: 'PartidasRemisionGrid · pie del grid · botón «Asignar NS»',
        texto: 'Un número de serie por PIEZA, y se capturan desde el renglón que los pide.',
    },
    'ventas.quitar-pregunta': {
        tipo: 'nota',
        donde: 'PartidasRemisionGrid · pie del grid',
        texto: 'Quitar un renglón siempre pregunta (diálogo del kit).',
    },
    /** ⭐ Escenario D del mockup: la lista del cliente no respondió. */
    'ventas.cascada-reintentar': {
        tipo: 'aviso',
        donde: 'NotaRemisionModal · Zona 3 · aviso de la cascada caída',
        texto: 'Lo capturado sigue ahí: reintentá sin volver a teclear.',
    },
    'ventas.cascada-precio-vacio': {
        tipo: 'nota',
        donde: 'NotaRemisionModal · Zona 3 · aviso de la cascada caída',
        texto: 'El renglón queda con el precio vacío hasta que responda.',
    },

    // ── Pantalla de confirmación ─────────────────────────────────────────────
    'ventas.confirmar-irreversible': {
        tipo: 'candado',
        donde: 'NotaRemisionConfirmacion · cabecera',
        texto: 'Emitir es irreversible: descuenta inventario y abre la cuenta por cobrar del cliente.',
    },
    'ventas.plazo-derivado': {
        tipo: 'nota',
        donde: 'NotaRemisionConfirmacion · Zona 1 · vencimiento',
        texto: 'El vencimiento se calcula solo: la emisión más el plazo de crédito del cliente.',
    },
    'ventas.acto-atomico': {
        tipo: 'aviso',
        donde: 'NotaRemisionConfirmacion · Zona 5 · pie',
        texto: 'El acto es atómico: o pasa todo, o no pasa nada.',
    },
}
