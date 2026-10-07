'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA REMISION — ZONA 3 · PARTIDAS (Guía 1.8 · rediseño 05 Oct 2026)
//
// ⭐ QUÉ ES: la declaración de QUÉ CAPTURA UN RENGLÓN DE VENTA. El grid genérico
//    (renglones, producto, importe, quitar con confirmación, total, pie) vive en el
//    KIT (`PartidasGrid` · Guía 0.8 Parte 7) y acá solo se declara el dominio.
//
// ⭐ EL REDISEÑO DEL 05 OCT 2026 (decisión del dueño) CAMBIÓ 4 COSAS:
//   ① ⛔ **FUERA la columna «Cortesía».** La cortesía ya no es un checkbox por renglón:
//      es un **botón «Cortesía»** en la cabecera del grid (al lado de «Agregar partida»)
//      que agrega un renglón **ya marcado** (precio $0). ⚠️ El **motivo sigue siendo
//      obligatorio** (`ck_partidas_remision_cort` + el schema) y ahora se captura
//      **dentro del renglón**, en `extraPorFila`.
//   ② ⭐ El **NS es un BOTÓN «Asignar NS»** por renglón (antes: un texto `n/N NS`). El
//      contador sobrevive como chip al lado, **solo cuando hay captura parcial**.
//   ③ ⛔ **FUERA el aviso «Bajo el mínimo»** del renglón. El piso SIGUE siendo regla
//      (lo valida el RPC y lo confirma el diálogo 04) ⇒ **se conoce al emitir, no antes**.
//      Hmm — y el piso **sí** se sigue leyendo: el modal lo usa para CONTAR excepciones.
//   ④ ⛔ **NO se muestra el ID/sku del producto ni existencia/lote/base.** El renglón se
//      identifica por el selector (que ya muestra nombre y sku de lo elegido).
//
// 🔴 Y UN BUG QUE ESTE ARCHIVO TENÍA, corregido acá: el piso se leía con la clave
//    EQUIVOCADA (`pisos[fila.id_producto]` cuando el modal lo guardaba por **id de
//    renglón**) ⇒ el aviso «Bajo el mínimo» **nunca se pintó**. Ahora el contrato es
//    `info[id_de_renglón]` y está tipado: no puede volver a desalinearse en silencio.
//
// 📌 ZONA 3 — para ubicarla al modificar: columnas → `columnas`; acciones del conjunto →
//    `pie`; lo que va DENTRO de un renglón → `extraPorFila`.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { Hash, Plus, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ayuda } from '@/components/ui/Ayuda'
import { PartidasGrid, type ColumnaPartida } from '@/components/form'
import { formatearMoneda } from '@/lib/utils/formatters'
import type { PartidaRemisionForm } from '@/lib/validations/ventas'

/** La fila del dominio: la del schema de la Parte 1. ⚠️ NO se inventa un tipo nuevo. */
type Fila = PartidaRemisionForm

/** ⭐ Lo que el MODAL resolvió al elegir el producto, por **id de renglón**. */
export interface InfoRenglon {
    /** El piso de precio (R9) — el modal lo usa para contar excepciones. */
    piso: number | null
    /** ¿El producto maneja NS? ⇒ el renglón pide su botón «Asignar NS» (R30). */
    manejaNS: boolean
    /**
     * ⭐ ANEXIÓN 05 Oct 2026: ¿hay **al menos un lote con disponible**?
     * ⚠️ La emisión hace FIFO sobre `lotes`: sin ninguno **FALLA**. Es un aviso, no una
     * garantía (otro vendedor puede consumirlo antes de emitir).
     */
    hayLote: boolean
    /**
     * ⭐ EL PRECIO CON LA LISTA DEL CLIENTE, **tal como lo resolvió el servidor**
     * (`resolverPrecioPartida` → `precio_con_lista`), con el signo de `tipo_ajuste` ya aplicado.
     *
     * 🔴 POR QUÉ ESTÁ ACÁ Y NO SE CALCULA EN LA CELDA: la fórmula de la lista vivía en **3**
     *    lugares (el resolutor, la emisión y esta vista previa). Con `descuento` coincidían por
     *    casualidad; con **`incremento`** el de la vista previa habría seguido restando ⇒ **el
     *    renglón mostraría un precio y la nota emitiría otro**. Ahora la fórmula vive en **2** (los
     *    dos del servidor) y la pantalla **copia** el resultado.
     */
    precioConLista: number
}

/** La fila nace con un id TEMPORAL: la BD asigna el real al emitir (patrón de 1.4). */
export function nuevaPartida(): Fila {
    return {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id_producto: '',
        descripcion_snapshot: '',
        cantidad: '1',
        precio_base_snapshot: '0',
        descuento_lista_porcentaje: '0',
        // ⭐ El precio lista (M5): nace vacío ⇒ lo prellena el servidor al resolver el producto.
        precio_lista: '',
        descuento_adicional_porcentaje: '0',
        precio_unitario_final: '0',
        id_impuesto: '',
        es_cortesia: false,
        motivo_cortesia: '',
        series: [],
    }
}

/** ⭐ La fila de CORTESÍA: nace marcada, a $0 y SIN motivo (que es obligatorio). */
export function nuevaCortesia(): Fila {
    return { ...nuevaPartida(), es_cortesia: true, precio_unitario_final: '0' }
}

/**
 * ⭐ R32③ · R34 — **«Descuento por partida»** (rediseño 05 Oct 2026, pedido del dueño: *«el descuento
 * por partida o producto es el que sale en la fila… debe llamarse descuento por partida»*).
 *
 * 🔴 EL BUG QUE ESTO CIERRA (medido el 05 Oct): la columna de la BD guarda la **FRACCIÓN**
 *    (`0.05` = 5% — igual que `listas_precios.porcentaje_descuento = 0.1200`), pero la pantalla
 *    **pide un %**. Antes el valor tecleado viajaba tal cual ⇒ escribir **5** (creyendo 5%) se
 *    interpretaba como **500%** y el precio salía **−400** (`100 × (1 − 5)`).
 * ⭐ Ahora el campo es un **% de verdad**: se teclea `5` y significa 5%. La división por 100
 *    se hace **acá** (display) y en la **SA** (antes de guardar la fracción).
 *
 * ⚠️ El precio y el % se **recalculan entre sí** (dos campos, no un toggle): tecleás el % y
 *    aparece el precio; tecleás el precio y aparece el %.
 * ⚠️ La base del cálculo es el precio **con la lista del cliente** (R32②), no el `precio_base`.
 */
function CeldaPrecio({
    fila,
    conLista,
    actualizar,
    disabled,
}: {
    fila: Fila
    /** ⭐ El precio con la lista del cliente, resuelto por el SERVIDOR (prellenado del precio lista). */
    conLista: number
    actualizar: (parcial: Partial<Fila>) => void
    disabled: boolean
}) {
    const bloqueado = disabled || fila.es_cortesia
    /**
     * ⭐ **EL PRECIO LISTA ES LA PRIMERA VERDAD** (M5 · dueño, 05 Oct 2026):
     *   · nace del servidor (`base × (1 ± lista)`) — *«jala el disco de 100 y mayoreo → 85»*;
     *   · **el vendedor lo puede cambiar** — *«dice no, mejor se lo doy a $90»* ⇒ manda 90;
     *   · el **descuento por partida** se aplica **encima** y **no lo toca** (toca el importe);
     *   · el **precio unitario** es el **resultado** (solo lectura) — es lo que multiplica el RPC.
     * ⚠️ Antes el campo editable era el *precio final*: con la lista en 85, escribir 90 daba un
     *    **descuento negativo** (y el % se recalculaba solo). Ahora cada dato tiene su lugar.
     */
    const precioLista = Number(fila.precio_lista) || conLista

    /** Teclea el PRECIO LISTA ⇒ se recalcula el unitario (el % de partida no se toca). */
    const porPrecioLista = (valor: string) => {
        const lista = Number(valor) || 0
        const pct = Number(fila.descuento_adicional_porcentaje) || 0
        actualizar({
            precio_lista: valor,
            precio_unitario_final: String(Number((lista * (1 - pct / 100)).toFixed(4))),
        })
    }

    /** Teclea el % de PARTIDA ⇒ se recalcula el unitario. El precio lista NO se modifica. */
    const porPorcentaje = (valor: string) => {
        const pct = Number(valor) || 0
        actualizar({
            descuento_adicional_porcentaje: valor,
            precio_unitario_final: String(Number((precioLista * (1 - pct / 100)).toFixed(4))),
        })
    }

    return (
        <div className="flex items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Precio lista $
                </span>
                <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    inputMode="decimal"
                    className="font-mono tabular-nums"
                    value={fila.precio_lista || String(conLista || '')}
                    disabled={bloqueado}
                    onChange={(e) => porPrecioLista(e.target.value)}
                    aria-label="Precio de lista, modificable"
                />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Desc. partida %
                </span>
                <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    inputMode="decimal"
                    className="font-mono tabular-nums"
                    placeholder="0"
                    value={fila.descuento_adicional_porcentaje}
                    disabled={bloqueado}
                    onChange={(e) => porPorcentaje(e.target.value)}
                    aria-label="Descuento por partida, en por ciento"
                />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    P. unitario $
                </span>
                {/* ⭐ RESULTADO: solo lectura. `precio_lista × (1 − desc. partida)`. */}
                <p className="flex h-9 items-center font-mono text-[13px] tabular-nums text-muted-foreground">
                    {formatearMoneda(Number(fila.precio_unitario_final) || 0)}
                </p>
            </div>
        </div>
    )
}

interface PartidasRemisionGridProps {
    /** El borrador lo posee el MODAL: el grid está controlado por el padre. */
    partidas: Fila[]
    onChange: (partidas: Fila[]) => void
    /**
     * ⭐ El grid **AVISA** que se eligió un producto en el renglón `indice`; **no decide**.
     * La cascada (`resolverPrecioPartida`) es del modal, que es quien tiene el `idCliente`.
     */
    onProductoElegido?: (indice: number, idProducto: string) => void
    /** ⭐ Abre el diálogo de NS: es una acción del **CONJUNTO** (R30), no de un renglón. */
    onAsignarNS?: () => void
    /** ⭐ Agrega un renglón de cortesía: acción del CONJUNTO (decisión del 05 Oct 2026). */
    onAgregarCortesia?: () => void
    /** ⭐ Lo que el modal resolvió por renglón (piso + NS + lote), por **id de renglón**. */
    info?: Record<string, InfoRenglon>
    /**
     * ⭐ ¿Todavía no hay cliente? Cambia el **estado vacío**: sin cliente el grid nace
     * apagado y lo DICE (escenario A del mockup) — el precio sale de SU lista.
     */
    sinCliente?: boolean
    /**
     * ⭐ EL DESGLOSE DE TOTALES (05 Oct 2026, pedido del dueño: *«van en la barra de total de
     * partidas, justo abajo de las partidas»*). El modal lo arma —es quien tiene las cifras—;
     * el grid solo lo coloca en esa barra.
     */
    totales?: ReactNode
    disabled?: boolean
}

export function PartidasRemisionGrid({
    partidas,
    onChange,
    onProductoElegido,
    onAsignarNS,
    onAgregarCortesia,
    info,
    sinCliente = false,
    totales,
    disabled = false,
}: PartidasRemisionGridProps) {
    /** El kit pone el producto, el importe, el total y el quitar: acá solo las del dominio. */
    const columnas: ColumnaPartida<Fila>[] = [
        {
            clave: 'cantidad',
            encabezado: 'Cantidad',
            render: (fila, actualizar, bloqueado) => (
                <Input
                    type="number"
                    min="0"
                    step="1"
                    value={fila.cantidad}
                    disabled={bloqueado}
                    onChange={(e) => actualizar({ cantidad: e.target.value })}
                    aria-label="Cantidad"
                />
            ),
        },
        {
            clave: 'precio',
            encabezado: 'Descuento por partida',
            render: (fila, actualizar, bloqueado) => (
                <CeldaPrecio
                    fila={fila}
                    // ⭐ El precio de lista lo resuelve el SERVIDOR; acá solo se muestra.
                    conLista={info?.[fila.id]?.precioConLista ?? (Number(fila.precio_base_snapshot) || 0)}
                    actualizar={actualizar}
                    disabled={bloqueado}
                />
            ),
        },
    ]

    /** El motivo de la cortesía se actualiza por ÍNDICE (el grid es del padre). */
    const actualizarMotivo = (indice: number, motivo: string) => {
        if (indice < 0) return
        onChange(partidas.map((p, k) => (k === indice ? { ...p, motivo_cortesia: motivo } : p)))
    }

    return (
        <PartidasGrid<Fila>
            partidas={partidas}
            onChange={onChange}
            columnas={columnas}
            crearFila={nuevaPartida}
            importeDe={(fila) =>
                (Number(fila.cantidad) || 0) * (Number(fila.precio_unitario_final) || 0)
            }
            etiquetaImporte="Importe"
            disabled={disabled}
            // ⭐ El desglose viaja al kit, que lo pinta en la barra de abajo de las partidas.
            totales={totales}
            onProductoElegido={onProductoElegido}
            // ⭐ LA BARRA DE ABAJO (así lo dibuja el mockup): «Agregar partida» lo pone el kit,
            //    y acá van «Cortesía» y «Asignar números de serie» — las 3 acciones del CONJUNTO,
            //    una al lado de la otra. `extraPorFila` es otra cosa: lo que va DENTRO de un renglón.
            pie={
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={onAgregarCortesia}
                        title="Agrega un renglón ya marcado como cortesía (precio $0, con su motivo)"
                    >
                        Cortesía
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || partidas.length === 0}
                        onClick={onAsignarNS}
                    >
                        <Hash className="mr-1 h-4 w-4" aria-hidden="true" />
                        Asignar números de serie
                    </Button>
                    <Ayuda
                        k="ventas.ns-desde-el-renglon"
                        className="text-[11px] leading-snug text-muted-foreground"
                    />
                    <Ayuda
                        k="ventas.quitar-pregunta"
                        className="ml-auto text-[11px] leading-snug text-muted-foreground"
                    />
                </div>
            }
            /**
             * ⭐ EL ESTADO VACÍO ES DEL DOMINIO (escenario A del mockup): dice QUÉ hacer
             * primero y trae **su propio botón**. Son DOS estados distintos, no uno:
             *   · sin cliente → la invitación + el botón APAGADO + el porqué;
             *   · con cliente → «sin partidas todavía» + el botón LISTO.
             * ⚠️ `Agregar partida` del kit se oculta cuando este slot viene (no se duplica).
             */
            vacio={
                <div className="rounded-md border border-dashed border-border bg-surface-2 px-5 py-6 text-center">
                    {sinCliente ? (
                        <>
                            <h4 className="text-sm font-semibold">Elegí el cliente para empezar</h4>
                            <Ayuda
                                k="ventas.sin-cliente-no-captura"
                                className="mx-auto mt-1 max-w-[56ch] text-[12.5px] text-muted-foreground"
                            />
                            <Button type="button" className="mt-3" disabled>
                                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                                Agregar partida
                            </Button>
                            <span className="mt-2 block text-[10.5px] text-muted-foreground">
                                Apagado: primero el cliente.
                            </span>
                        </>
                    ) : (
                        <>
                            <h4 className="text-sm font-semibold">Sin partidas todavía</h4>
                            <p className="mx-auto mt-1 max-w-[56ch] text-[12.5px] text-muted-foreground">
                                Agregá el primer producto. El precio de partida sale de{' '}
                                <b className="text-foreground">la lista del cliente</b>; el
                                descuento adicional lo negociás vos. Y si hay que regalar algo, el
                                botón <b className="text-foreground">Cortesía</b> agrega un renglón
                                ya marcado como cortesía.
                            </p>
                            <Button
                                type="button"
                                className="mt-3"
                                disabled={disabled}
                                onClick={() => onChange([...partidas, nuevaPartida()])}
                            >
                                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                                Agregar partida
                            </Button>
                        </>
                    )}
                </div>
            }
            /**
             * ⭐ Lo que va DENTRO de un renglón (el kit lo pinta debajo del renglón):
             *   · el **motivo de la cortesía** — obligatorio, y antes vivía en la columna que
             *     se quitó (decisión del 05 Oct);
             *   · el **botón «Asignar NS»** de ese renglón, con su chip `n/N` cuando hay
             *     captura parcial.
             */
            extraPorFila={(fila, bloqueado) => {
                const indice = partidas.findIndex((p) => p.id === fila.id)
                const dato = info?.[fila.id]
                const pideNS = Boolean(fila.id_producto) && (dato?.manejaNS ?? false)
                const cantidad = Number(fila.cantidad) || 0
                const series = fila.series?.length ?? 0
                const faltanNS = series > 0 && series < cantidad
                /** ⭐ Sin lote con disponible la emisión FALLA (FIFO). Bloqueo duro, no ayuda. */
                const sinLote = Boolean(fila.id_producto) && cantidad > 0 && dato?.hayLote === false

                if (!fila.es_cortesia && !pideNS && !sinLote) return null

                return (
                    <div className="mt-2 flex flex-wrap items-start gap-x-5 gap-y-2">
                        {fila.es_cortesia && (
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <Label
                                    htmlFor={`motivo-cortesia-${fila.id}`}
                                    className="text-xs font-medium text-muted-foreground"
                                >
                                    Motivo de la cortesía *
                                </Label>
                                <Input
                                    id={`motivo-cortesia-${fila.id}`}
                                    className="h-8 max-w-md"
                                    placeholder="Por qué se regala (obligatorio)"
                                    value={fila.motivo_cortesia}
                                    disabled={bloqueado}
                                    onChange={(e) => actualizarMotivo(indice, e.target.value)}
                                />
                                <Ayuda
                                    k="ventas.cortesia-a-cero"
                                    className="text-[11px] leading-snug text-muted-foreground"
                                />
                                <Ayuda
                                    k="ventas.cortesia-motivo-obligatorio"
                                    className="text-[11px] leading-snug text-warning"
                                />
                            </div>
                        )}

                        {pideNS && (
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={bloqueado}
                                    onClick={onAsignarNS}
                                    title="Abrir el diálogo de números de serie"
                                >
                                    <Hash className="mr-1 h-4 w-4" aria-hidden="true" />
                                    Asignar NS
                                </Button>
                                {series > 0 && (
                                    <span
                                        className={`font-mono text-[11px] tabular-nums ${
                                            faltanNS ? 'text-warning' : 'text-muted-foreground'
                                        }`}
                                    >
                                        {series}/{cantidad} NS
                                    </span>
                                )}
                            </div>
                        )}

                        {/* ⚠️ EL BLOQUEO SE DICE (E1-④): no se esconde. Es DATO + BANDERA ⇒
                            NO es una ayuda y no se puede apagar. */}
                        {sinLote && (
                            <div
                                className={`flex items-start gap-1.5 text-[11.5px] leading-snug text-destructive${
                                    fila.es_cortesia || pideNS ? '' : ' flex-1'
                                }`}
                            >
                                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                                <span>
                                    <b>Sin existencia:</b> este producto no tiene lotes
                                    disponibles. <b>La emisión va a fallar</b> — resolvelo antes de
                                    emitir o quitá el renglón.
                                </span>
                            </div>
                        )}
                    </div>
                )
            }}
        />
    )
}
