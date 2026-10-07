// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES — VENTAS (Guía 1.8 · 01 Oct 2026)
// Forma PURA (patrón 1.1): opcionales viajan como ''. Reglas (PLAN Ventas ·
// bd-ventas · mapa D-21):
//   · emisión: cliente obligatorio · al menos UNA partida · ⭐ el VENCIMIENTO es
//     DERIVADO (`emisión + clientes.dias_credito`, lo calcula la SA — NO se captura) ·
//     cortesía exige motivo · producto de venta espera número de serie si lo maneja
//   · edición: SOLO vencimiento · método de envío · notas (las partidas NO se editan)
//   · cancelación: motivo obligatorio
// El PISO de precio, LAS TRES PUERTAS de crédito, el FIFO y el stock NO son forma:
// son regla de negocio (triggers de BD + Server Action).
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod'

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/
const REGEX_DECIMAL = /^\d+(\.\d{1,4})?$/
const REGEX_PORCENTAJE = /^\d+(\.\d{1,4})?$/
/** El techo del descuento: `< 1` lo exige el CHECK de `partidas_remision`. */
const TOPE_PORCENTAJE = 99.99

const fecha = (msg: string) => z.string().regex(REGEX_FECHA, msg)

// ── Un renglón del grid ───────────────────────────────────────────────────────
export const partidaRemisionSchema = z
    .object({
        /** `''` = renglón nuevo sin guardar. */
        id: z.string(),
        id_producto: z.string().min(1, 'Elige el producto del renglón.'),
        descripcion_snapshot: z.string().trim().max(300, 'La descripción es demasiado larga.'),
        cantidad: z
            .string()
            .min(1, 'Indica la cantidad.')
            .refine((v) => REGEX_DECIMAL.test(v), 'La cantidad debe ser un número.')
            .refine((v) => Number(v) > 0, 'La cantidad debe ser mayor a 0.'),
        precio_base_snapshot: z.string(),
        descuento_lista_porcentaje: z.string(),
        /**
         * ⭐ **EL PRECIO LISTA** (M5 · 05 Oct 2026): el precio DESPUÉS de la lista del cliente
         * (`base × (1 ± lista)`) y **ANTES** del descuento por partida. Es **la primera verdad** y
         * el vendedor **lo puede modificar a mano** (85 → 90).
         * ⚠️ `''` es válido: la emisión deriva el valor con la lista del cliente como red de
         *    seguridad, así que un formulario que no lo mande **sigue emitiendo**.
         * ⚠️ Tiene que estar **en el schema**: zod descarta las claves que no declara, y un campo
         *    que no viaja al `p_input` es un campo que **nunca se guarda** (el defecto que ya se
         *    pagó con `autorizacion`).
         */
        precio_lista: z
            .string()
            .refine((v) => v === '' || REGEX_DECIMAL.test(v), 'El precio lista debe ser un número.')
            .refine((v) => v === '' || Number(v) >= 0, 'El precio lista no puede ser negativo.'),
        descuento_adicional_porcentaje: z
            .string()
            .refine((v) => v === '' || REGEX_PORCENTAJE.test(v), 'El descuento debe ser un número.')
            .refine(
                (v) => v === '' || Number(v) <= TOPE_PORCENTAJE,
                `El descuento no puede llegar a ${TOPE_PORCENTAJE}%.`
            ),
        precio_unitario_final: z
            .string()
            .min(1, 'Indica el precio.')
            .refine((v) => REGEX_DECIMAL.test(v), 'El precio debe ser un número.')
            .refine((v) => Number(v) >= 0, 'El precio no puede ser negativo.'),
        id_impuesto: z.string(),
        /** ⭐ Los N NS del renglón — uno por PIEZA (PLAN §6.5). La BD los guarda en `series_partida`. */
        series: z.array(z.string().trim().min(1, 'El número de serie no puede ir vacío.'))
            .max(500, 'Demasiados números de serie en un renglón.')
            .default([]),
        es_cortesia: z.boolean(),
        motivo_cortesia: z.string().trim().max(300, 'El motivo es demasiado largo.'),
    })
    // ⭐ La cortesía exige motivo (espejo de `ck_partidas_remision_cort`)
    .refine((p) => !p.es_cortesia || p.motivo_cortesia.length > 0, {
        message: 'Indica por qué es cortesía.',
        path: ['motivo_cortesia'],
    })

// ── El acto de autorizar (PLAN §6.2) — ⭐ MVP: es una CONFIRMACIÓN, sin credenciales ──────────
// ⚠️ Antes pedía `usuario` + `contrasena` y **nadie las verificaba** (ni el RPC ni el trigger) ⇒
//    era teatro, y encima el trigger de las puertas bloqueaba SIEMPRE. Decisión del dueño
//    (02 Oct 2026): en el MVP alcanza con **el motivo** (por qué se excepciona); la autorización
//    de segundo nivel vuelve en V2.
// ⚠️ Va **ANTES** de `notaRemisionSchema` porque ese schema lo **referencia** (TDZ).
export const autorizacionSchema = z.object({
    motivo: z.string().trim().min(1, 'Indica el motivo de la excepción.').max(300),
})

// ── La emisión completa (encabezado + partidas + los NS) ──────────────────────
// ⚠️ `fecha_vencimiento` **NO está acá a propósito** (rediseño 05 Oct 2026): el formulario
//    no la captura y la **deriva la SA** (emisión + `clientes.dias_credito`). Dejarla en el
//    schema sería aceptar una fecha que ya nadie teclea y que podría contradecir al plazo.
export const notaRemisionSchema = z.object({
    id_cliente: z.string().min(1, 'Elige el cliente.'),
    es_credito: z.boolean(),
    fecha_emision: fecha('La fecha de emisión no es válida.'),
    id_vendedor: z.string(),
    /**
     * ⭐ DESCUENTO DEL DOCUMENTO (05 Oct 2026) — en **%** (0–100). La SA lo convierte al
     * **monto** que guarda `notas_remision.descuento_global`.
     * ⚠️ Se valida el rango: un 150% daría un total NEGATIVO y el RPC lo asentaría igual
     *    (no tiene guarda de signo) ⇒ el rango se controla acá, en el borde.
     */
    descuento_global_porcentaje: z
        .string()
        .refine(
            (v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100),
            'El descuento del documento va entre 0 y 100.'
        ),
    id_metodo_envio: z.string(),
    notas: z.string().trim().max(500, 'Las notas son demasiado largas.'),
    partidas: z.array(partidaRemisionSchema).min(1, 'Agrega al menos un producto.'),
    /** ⭐ Los NS del paso de asignación: uno por PIEZA, no por renglón. */
    numeros_serie: z.array(z.string().trim().min(1)).default([]),
    // ⭐ FIX 02 Oct 2026 — LA AUTORIZACIÓN TIENE QUE ESTAR **EN EL SCHEMA**: zod **descarta** las
    //    claves que no declara, así que el acto que capturaba el modal **NUNCA llegaba** al
    //    `p_input` — aunque el tipo `NotaRemisionInput` sí lo declaraba y el RPC lo lee
    //    (`->>'autorizado_por'`, `->>'motivo'`). Sin esta línea, `motivo_autorizacion` quedaba
    //    vacío SIEMPRE y la salida de emergencia del piso era inalcanzable desde la pantalla.
    autorizacion: autorizacionSchema.optional(),
})

// ── La edición (SOLO lo que no mueve nada · mapa D-21) ────────────────────────
export const editarNotaRemisionSchema = z.object({
    fecha_vencimiento: fecha('La fecha de vencimiento no es válida.'),
    id_metodo_envio: z.string(),
    notas: z.string().trim().max(500, 'Las notas son demasiado largas.'),
})

// ── La cancelación (total, irreversible, con motivo · mapa D-15) ──────────────
export const cancelarNotaRemisionSchema = z.object({
    id: z.string().min(1),
    motivo_cancelacion: z
        .string()
        .trim()
        .min(1, 'Indica el motivo de la cancelación.')
        .max(500, 'El motivo es demasiado largo.'),
})

// ── El acto de autorizar (PLAN §6.2) — declarado ARRIBA (lo referencia `notaRemisionSchema`) ──

export type PartidaRemisionForm = z.infer<typeof partidaRemisionSchema>
export type NotaRemisionForm = z.infer<typeof notaRemisionSchema>
export type EditarNotaRemisionForm = z.infer<typeof editarNotaRemisionSchema>
export type CancelarNotaRemisionForm = z.infer<typeof cancelarNotaRemisionSchema>
export type AutorizacionForm = z.infer<typeof autorizacionSchema>
