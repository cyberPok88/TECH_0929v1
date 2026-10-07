'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA REMISION — ZONA 1 · CLIENTE Y CONDICIONES (Guía 1.8 · rediseño 05 Oct 2026)
//
// ⭐ QUÉ ES: la franja de TRES controles que abre el formulario de emisión.
//    `NotaRemisionModal` la monta; NO tiene estado propio (el borrador es del modal).
//
// ⭐ POR QUÉ EXISTE SEPARADA (y no dentro del modal):
//    el modal pasó de 373 líneas con todo dentro a un ORQUESTADOR delgado + una zona
//    por archivo. Así «cambiar la cabecera» no obliga a leer el grid ni la emisión.
//
// ⛔ LO QUE YA NO ESTÁ (recorte del dueño, 05 Oct 2026):
//    `marca comercial` · `lista de precios` · `vencimiento` · `vendedor`.
//    ⚠️ Los TRES primeros los DERIVA el servidor del cliente (nunca se capturaron) ⇒
//    quitarlos fue solo display. El **vencimiento SÍ se capturaba**: ahora se deriva
//    (`emisión + clientes.dias_credito`) en `crearNotaRemisionDirecta`.
//
// 📌 ZONA 1 — para ubicarla al modificar: es LA ÚNICA zona que captura el encabezado.
//    Si un cambio toca el cliente, el crédito o la fecha de emisión, es acá.
// ═══════════════════════════════════════════════════════════════════════════════

import { Ayuda } from '@/components/ui/Ayuda'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectorCliente } from '@/components/form'
import type { ClienteOpcion } from '@/types/clientes'
import type { NotaRemisionInput } from '@/types/ventas'

/**
 * Lo que captura la Zona 1 — y **nada más**.
 * ⚠️ El resto del encabezado (`fecha_vencimiento` · `id_vendedor` · `id_marca_comercial` ·
 *    `id_lista_precio` · `id_metodo_envio` · `notas`) NO se teclea: lo deriva la SA.
 */
export type CamposCabecera = Pick<
    NotaRemisionInput,
    'id_cliente' | 'es_credito' | 'fecha_emision' | 'descuento_global_porcentaje'
>

interface NotaRemisionCabeceraProps {
    /** El valor actual (lo posee el modal: esto es un componente controlado). */
    valor: CamposCabecera
    /** ⚠️ `onPatch` y no `onChange`: se actualiza **parcial**, como `CeldaPrecio` del grid. */
    onPatch: (parcial: Partial<CamposCabecera>) => void
    /**
     * ⭐ ANEXIÓN 05 Oct 2026: la **opción completa** del cliente (no solo el id), para que el
     * modal lea el `dias_credito` que la confirmación muestra. Se reenvía tal cual al selector.
     */
    onClienteElegido?: (cliente: ClienteOpcion | null) => void
    disabled?: boolean
}

export function NotaRemisionCabecera({
    valor,
    onPatch,
    onClienteElegido,
    disabled = false,
}: NotaRemisionCabeceraProps) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            {/* ── Cliente: EL primer gesto (sin él no se captura ni un renglón) ──
                ⚠️ El `Label` lo pinta el SELECTOR (su prop `etiqueta`): poner otro acá
                duplicaba el rótulo («Cliente *» encima de «Cliente») y el de arriba salía
                en `text-sm` — el doble de lo que manda la casa para una etiqueta de campo. */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
                <SelectorCliente
                    value={valor.id_cliente || null}
                    onChange={(id) => onPatch({ id_cliente: id ?? '' })}
                    onSeleccionada={onClienteElegido}
                    etiqueta="Cliente *"
                    disabled={disabled}
                />
                <Ayuda
                    k="ventas.cliente-hereda"
                    className="text-[11px] leading-snug text-muted-foreground"
                />
            </div>

            {/* ── ¿Crédito? — preseleccionado: el negocio es de crédito ── */}
            <div className="flex flex-col gap-1.5">
                <Label
                    htmlFor="nota-credito"
                    className="text-xs font-medium text-muted-foreground"
                >
                    ¿Crédito?
                </Label>
                <label
                    htmlFor="nota-credito"
                    className="flex min-h-9 items-center gap-2 text-[13px]"
                >
                    <input
                        id="nota-credito"
                        type="checkbox"
                        className="h-4 w-4 accent-[oklch(var(--primary))]"
                        checked={valor.es_credito}
                        disabled={disabled}
                        onChange={(e) => onPatch({ es_credito: e.target.checked })}
                    />
                    Es a crédito
                </label>
                <Ayuda
                    k="ventas.credito-preseleccionado"
                    className="text-[11px] leading-snug text-muted-foreground"
                />
            </div>

            {/* ── Emisión — viene en hoy y es elegible ── */}
            <div className="flex flex-col gap-1.5">
                <Label
                    htmlFor="nota-emision"
                    className="text-xs font-medium text-muted-foreground"
                >
                    Emisión
                </Label>
                <Input
                    id="nota-emision"
                    type="date"
                    /* ⚠️ `font-mono`: es una FECHA (dato, no prosa) — así lo pinta la casa. */
                    className="font-mono"
                    value={valor.fecha_emision}
                    disabled={disabled}
                    onChange={(e) => onPatch({ fecha_emision: e.target.value })}
                />
                <Ayuda k="ventas.emision-hoy" className="text-[11px] leading-snug text-muted-foreground" />
            </div>

            {/* ── Descuento del DOCUMENTO (3er nivel) — va acá, con las condiciones ── */}
            <div className="flex flex-col gap-1.5">
                <Label
                    htmlFor="nota-descuento-doc"
                    className="text-xs font-medium text-muted-foreground"
                >
                    Desc. documento %
                </Label>
                <Input
                    id="nota-descuento-doc"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    inputMode="decimal"
                    className="font-mono tabular-nums"
                    placeholder="0"
                    value={valor.descuento_global_porcentaje}
                    disabled={disabled}
                    onChange={(e) =>
                        onPatch({ descuento_global_porcentaje: e.target.value })
                    }
                />
                <Ayuda
                    k="ventas.descuento-documento"
                    className="text-[11px] leading-snug text-muted-foreground"
                />
            </div>
        </div>
    )
}
