'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS GRID — Guía 0.8 · Parte 7 (componente compartido · PROMOCIÓN
// 01 Oct 2026 (9ª) — el grid genérico de renglones de partida: lo piden
// 1.7 Cotizaciones · 1.8 Ventas · 2.3 Devoluciones)
//
// ⭐ AMPLIACIÓN 02 Oct 2026 (10ª) — la pide **1.8 Ventas**, y es **aditiva**: 0 consumidores
//    antes de ella (`CATALOGO_UI` §PartidasGrid: «nadie todavía»), así que no rompe a nadie.
//    Dos RANURAS + un ARREGLO, todos medidos al implementar la Parte 3 de 1.8 (su grid local
//    NO compilaba y duplicaba 94 líneas del kit):
//      · `onProductoElegido(indice, idProducto)` — el kit **avisa**, no decide: la cascada de
//        precio (`resolverPrecioPartida`) y el piso del producto son del DOMINIO.
//      · `pie` — ranura al pie: el botón «Asignar números de serie» es una acción del CONJUNTO,
//        no de un renglón ⇒ no entra en `extraPorFila`.
//      · ⚠️ **ARREGLO:** `infoInicial` se leía **una sola vez al montar**, así que en la EDICIÓN
//        (el detalle llega async) el sku/nombre quedaba **vacío**. Ahora se fusiona.
//
// Sube desde la copia LOCAL de 1.4 (`components/compras/PartidasNotaGrid.tsx`),
// que SE QUEDA COMO ESTÁ — duplicado anotado, carril PROMOCIÓN: no se refactorizan
// CRUDs anteriores sin petición explícita ⇒ es un COPY con generalización, NO un
// `move`.
//
// ⭐ EL EJE REAL DE LA GENERALIZACIÓN (medición previa 01 Oct 2026) — no son las
//    columnas: es EL SELECTOR DE PRODUCTO. La copia de 1.4 trae el suyo, embebido
//    y atado a `listarProductosParaPartida` del dominio 1.4; este grid COMPONE
//    `SelectorProducto` del kit (Bloque 10), que existía justamente por esto.
//    Las columnas pasan a ser DECLARATIVAS: el grid no sabe qué captura un
//    renglón, lo declara el consumidor.
//
// QUÉ HACE (es suyo, no lo delega):
//   · el selector de producto por renglón (compone `SelectorProducto` del kit)
//   · agregar/quitar filas — quitar SIEMPRE con `ConfirmarAccionDialog`, la
//     decisión de UX de 1.4 que se conserva
//   · el importe por renglón y el total, formateados con `formatearMoneda` de
//     `@/lib/utils/formatters` (el formateador de la casa, dueño 0.2: NO se
//     inventa un 11º `formatearMXN` local — decisión medida el 01 Oct 2026)
//   · el estado deshabilitado
//
// QUÉ NO HACE (lo declara el consumidor): precios · descuentos · impuestos ·
// números de serie · validaciones de negocio · ni el `onChange` del dominio.
// ⚠️ `series[]` NO ES DEL KIT: los NS son concepto de Ventas + Inventario (1.7 y
//    2.3 no los usan) ⇒ 1.8 los inyecta como sub-tabla con `extraPorFila`.
//    `cantidad` está en el tipo base porque todo renglón la tiene, pero el grid NO
//    la pinta: la declara el consumidor como una columna más.
//
// Contrato (GUIAS/08 · Parte 7 Bloque 12):
//   <PartidasGrid
//     partidas={filas}
//     onChange={setFilas}
//     columnas={[
//       { clave: 'precio', encabezado: 'Precio',
//         render: (fila, actualizar, disabled) => (
//           <Input value={fila.precio} disabled={disabled}
//                  onChange={(e) => actualizar({ precio: e.target.value })} />
//         ) },
//     ]}
//     crearFila={() => ({ id: nuevoId(), id_producto: '', cantidad: '1', precio: '' })}
//     importeDe={(fila) => Number(fila.cantidad) * Number(fila.precio)}
//     etiquetaImporte="Importe"        // «Costo» en 1.4 · «Precio» · «Importe»
//     infoInicial={infoProductos}      // id_producto → { sku, nombre } (edición)
//     disabled={guardando}
//     extraPorFila={(fila, disabled) => <SubGridNS ... />}   // ⭐ solo 1.8
//     onProductoElegido={(i, id) => cascadaDePrecio(i, id)}  // ⭐ 1.8 (10ª promoción)
//     pie={<Button onClick={abrirNS}>Asignar números de serie</Button>}   // ⭐ 1.8
//   />
//
// `TFila` extiende `FilaPartidaBase` (id · id_producto · cantidad): el grid los
// necesita para identificar la fila y para componer el selector. Todo lo demás
// es del consumidor.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { SelectorProducto } from '@/components/form'
import { formatearMoneda } from '@/lib/utils/formatters'

/** Renglón mínimo que el grid sabe manipular. El consumidor lo extiende. */
export interface FilaPartidaBase {
    id: string
    id_producto: string
    cantidad: string
}

/** Display ya conocido de un producto (id_producto → { sku, nombre }) — edición. */
export interface InfoProducto {
    sku: string
    nombre: string
}

/** Columna declarada por el consumidor: qué captura el renglón. */
export interface ColumnaPartida<TFila> {
    clave: string
    encabezado: string
    render: (fila: TFila, actualizar: (parcial: Partial<TFila>) => void, disabled: boolean) => ReactNode
}

interface PartidasGridProps<TFila extends FilaPartidaBase> {
    partidas: TFila[]
    onChange: (partidas: TFila[]) => void
    /** ⭐ El consumidor declara qué captura su renglón (precio · descuento · …). */
    columnas: ColumnaPartida<TFila>[]
    /** ⭐ Cada dominio sabe cómo nace su fila. */
    crearFila: () => TFila
    /** ⭐ El grid NO calcula precios: los formatea y los suma. */
    importeDe: (fila: TFila) => number
    /** «Costo» (1.4) · «Importe» · «Precio». */
    etiquetaImporte?: string
    /** Map id_producto → display, para precargar en edición (viene del detalle). */
    infoInicial?: Record<string, InfoProducto>
    disabled?: boolean
    /** ⭐ 1.8 inyecta aquí su sub-grid de NS; 1.7 y 2.3 no lo pasan. */
    extraPorFila?: (fila: TFila, disabled: boolean) => ReactNode
    /**
     * ⭐ AMPLIACIÓN 02 Oct 2026 (10ª promoción · la pide **1.8 Ventas**): el grid **AVISA**
     * que se eligió un producto en el renglón `indice`; **no decide qué hacer**. La cascada
     * de precio y el piso del producto son del **dominio**, no del kit.
     * ⚠️ **A propósito NO recibe un `actualizar`**: la cascada de 1.8 es una **Server Action**
     * (`resolverPrecioPartida`), es decir **asíncrona** — un setter capturado antes del `await`
     * pisaría los cambios intercalados del usuario. El consumidor actualiza con **su propio
     * `onChange` en forma funcional** (`setEstado(p => …)`), que sí ve lo último.
     */
    onProductoElegido?: (indice: number, idProducto: string) => void
    /**
     * ⭐ 10ª promoción (**02 Oct 2026**) — acciones del CONSUMIDOR en la **barra del pie**, al lado
     * de «Agregar partida»: 1.8 pone «Cortesía» y «Asignar números de serie».
     * ⚠️ El kit NO conoce el dominio: solo abre el lugar. Desde la **ANEXIÓN del 05 Oct 2026** esta
     *    ranura es **la ÚNICA barra de acciones** — la cabecera se quitó con el rótulo «Partidas *»
     *    porque el mockup aprobado pone las acciones **abajo**.
     */
    pie?: ReactNode

    /**
     * ⭐ ANEXIÓN 05 Oct 2026 — el **estado VACÍO del consumidor** (0 partidas).
     * Existe porque el estado vacío es del DOMINIO, no del kit: dice QUÉ hacer primero
     * («elegí el cliente»), trae **su propio botón** y su nota. Si viene, el kit **no**
     * pinta el suyo ni duplica el «Agregar partida» del pie.
     */
    vacio?: ReactNode

    /**
     * ⭐ ANEXIÓN 05 Oct 2026 — el **desglose de totales del consumidor**, en la barra que va
     * **justo debajo de las partidas**. Si viene, reemplaza el «Total de partidas» del kit
     * (el desglose ya trae el total adentro).
     */
    totales?: ReactNode
}

export function PartidasGrid<TFila extends FilaPartidaBase>({
    partidas,
    onChange,
    columnas,
    crearFila,
    importeDe,
    etiquetaImporte = 'Importe',
    infoInicial,
    disabled = false,
    extraPorFila,
    onProductoElegido,
    pie,
    vacio,
    totales,
}: PartidasGridProps<TFila>) {
    // ⭐ 10ª promoción (02 Oct 2026): `infoInicial` se leía **UNA SOLA VEZ al montar**
    //    (`useState(() => ({ ...infoInicial }))`), así que en la EDICIÓN —donde el detalle llega
    //    **ASYNC** después del primer render— el sku/nombre quedaba **VACÍO para siempre**.
    //    ⚠️ El arreglo es **no cachearlo**: se lee de la prop en cada render. Cachearlo exigía un
    //    `useEffect` con `setState`, que la regla `react-hooks/set-state-in-effect` **prohíbe**
    //    (renders en cascada), más una fusión a mano para no entrar en bucle.
    const infoProductos: Record<string, InfoProducto> = infoInicial ?? {}
    const [eliminarIndex, setEliminarIndex] = useState<number | null>(null)

    const actualizarFila = (indice: number, parcial: Partial<TFila>) => {
        onChange(partidas.map((fila, i) => (i === indice ? { ...fila, ...parcial } : fila)))
    }

    const cambiarProducto = (indice: number, idProducto: string) => {
        onChange(partidas.map((fila, i) => (i === indice ? { ...fila, id_producto: idProducto } : fila)))
        // ⭐ El AVISO va después del cambio local (10ª promoción, 02 Oct 2026): el consumidor
        //    ya ve el producto elegido en su propio estado cuando su cascada resuelva.
        onProductoElegido?.(indice, idProducto)
    }

    const confirmarEliminar = async (): Promise<{ error: string | null }> => {
        if (eliminarIndex === null) return { error: null }
        onChange(partidas.filter((_, i) => i !== eliminarIndex))
        setEliminarIndex(null)
        return { error: null }
    }

    const total = partidas.reduce((acc, fila) => acc + (importeDe(fila) || 0), 0)

    return (
        <div className="flex flex-col gap-2">
            {/* ⛔ FUERA el rótulo «Partidas *» (05 Oct 2026): el mockup aprobado NO lo tiene —
                su grilla se identifica con los encabezados de campo y el estado vacío dice la
                consigna («Elegí el cliente para empezar» / «Sin partidas todavía»). */}
            {partidas.length === 0 ? (
                /* ⭐ `vacio` (ANEXIÓN 05 Oct 2026): el estado vacío del CONSUMIDOR — con su
                   invitación y su botón. Por defecto, el texto de siempre. */
                (vacio ?? (
                    <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                        Agrega al menos una partida.
                    </p>
                ))
            ) : (
                <div className="flex flex-col gap-2">
                    {partidas.map((fila, i) => {
                        // ⭐ El display precargado: sirve en EDICIÓN, cuando el renglón ya
                        //    trae producto y el selector todavía no cargó su catálogo.
                        const info = fila.id_producto ? infoProductos[fila.id_producto] : undefined
                        return (
                            <div
                                key={fila.id}
                                className="rounded-md border border-border bg-surface px-2 py-2"
                            >
                                <div className="flex flex-wrap items-end gap-2">
                                    {/* Producto — el selector del kit, no una copia local */}
                                    <div className="min-w-0 basis-full sm:basis-64 sm:flex-none">
                                        <SelectorProducto
                                            value={fila.id_producto || null}
                                            onChange={(id) => cambiarProducto(i, id ?? '')}
                                            disabled={disabled}
                                            etiqueta="Producto"
                                        />
                                        {info && (
                                            <p
                                                className="truncate px-1 pt-0.5 font-mono text-[11px] text-muted-foreground"
                                                title={`${info.sku} — ${info.nombre}`}
                                            >
                                                {info.sku} — {info.nombre}
                                            </p>
                                        )}
                                    </div>

                                    {/* Columnas declaradas por el consumidor */}
                                    {columnas.map((columna) => (
                                        <div
                                            key={columna.clave}
                                            role="group"
                                            aria-label={columna.encabezado}
                                            className="min-w-0 flex-1 basis-32"
                                        >
                                            <Label className="text-xs font-medium text-muted-foreground">
                                                {columna.encabezado}
                                            </Label>
                                            {columna.render(
                                                fila,
                                                (parcial) => actualizarFila(i, parcial),
                                                disabled
                                            )}
                                        </div>
                                    ))}

                                    {/* Importe del renglón — formateado, nunca calculado aquí */}
                                    <div className="ml-auto min-w-0 basis-24 flex-none text-right">
                                        <Label className="text-xs font-medium text-muted-foreground">
                                            {etiquetaImporte}
                                        </Label>
                                        <p className="flex h-9 items-center justify-end font-mono text-xs tabular-nums">
                                            {formatearMoneda(importeDe(fila) || 0)}
                                        </p>
                                    </div>

                                    {/* Quitar */}
                                    <div className="flex flex-none items-end pb-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            disabled={disabled}
                                            aria-label={`Quitar partida ${i + 1}`}
                                            onClick={() => setEliminarIndex(i)}
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </div>

                                {/* ⭐ Contenido extra del renglón (los NS de 1.8) */}
                                {extraPorFila?.(fila, disabled)}
                            </div>
                        )
                    })}

                    {/* ⭐ `totales` (ANEXIÓN 05 Oct 2026): el desglose del CONSUMIDOR — el
                        dueño lo pidió «en la barra de total de partidas, justo abajo de las
                        partidas». Si viene, REEMPLAZA esta barra simple (el desglose ya
                        incluye el total). El kit no sabe de niveles de descuento: solo el lugar. */}
                    {totales ?? (
                        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                            <span className="text-xs font-medium text-muted-foreground">
                                Total de partidas
                            </span>
                            <span className="font-mono text-sm font-semibold tabular-nums">
                                {formatearMoneda(total)}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* ⭐ EL PIE ES LA BARRA DE ACCIONES DEL CONJUNTO (mockup 05 Oct 2026): acá vive
                «Agregar partida» —del kit— junto a lo que sume el consumidor («Cortesía»,
                «Asignar números de serie»). Antes el botón de agregar estaba en una cabecera
                arriba, y el mockup lo pone **abajo, al lado de las demás**.
                ⚠️ Si el consumidor trae su PROPIO estado vacío (`vacio`), ese estado ya tiene
                su «Agregar partida»: duplicarlo daría DOS botones con la misma etiqueta. */}
            <div className="flex flex-wrap items-center gap-2">
                {!(partidas.length === 0 && vacio) && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => onChange([...partidas, crearFila()])}
                    >
                        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                        Agregar partida
                    </Button>
                )}
                {pie}
            </div>

            {/* Confirmación al quitar partida — la decisión de UX de 1.4, conservada */}
            <ConfirmarAccionDialog
                open={eliminarIndex !== null}
                onOpenChange={(o) => {
                    if (!o) setEliminarIndex(null)
                }}
                titulo="Quitar partida"
                descripcion="Se elimina esta línea de la nota. Los cambios se aplican al guardar."
                confirmLabel="Quitar"
                variant="destructive"
                successMessage="Partida quitada"
                onConfirm={confirmarEliminar}
            />
        </div>
    )
}
