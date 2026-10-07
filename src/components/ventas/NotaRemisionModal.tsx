'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA REMISION MODAL — EL ORQUESTADOR (Guía 1.8 · rediseño 05 Oct 2026)
//
// ⭐ QUÉ ES: el DUEÑO del borrador y de la emisión. Compone las zonas y las dos
//    pantallas del acto; **no captura campos** (eso es de las zonas) ni pinta tablas.
//
// ⭐ EL ACTO, EN DOS PANTALLAS (antes: 3 pasos con «Siguiente»/«Atrás»):
//      PANTALLA 1 · CAPTURA   → Zona 1 (cliente y condiciones) + Zona 3 (partidas)
//                               + Zona 4 (pie fijo: totales y acciones)
//      PANTALLA 2 · CONFIRMAR → `NotaRemisionConfirmacion` (resumen + qué va a pasar)
//    Los **NS** y la **excepción** NO son pasos: son diálogos hijos que se abren solos
//    (desde el renglón / cuando el servidor los pide).
//    ⚠️ Los 2 pasos que había se fueron porque el paso 1 estaba TRABADO: «Siguiente»
//    exigía partidas y las partidas solo se capturaban en el paso 2 ⇒ el modal no podía
//    avanzar nunca (medido el 04 Oct 2026).
//
// ⚠️ NO HAY BORRADOR: crear = emitir (mapa D-17). Cerrar pierde lo capturado y se avisa.
// ⚠️ La emisión es UNA transacción (el RPC `b7`): si algo falla, NADA quedó escrito.
//
// ═══════════════════════════════════════════════════════════════════════════════
// 📌 LAS ZONAS, PARA MODIFICAR SIN ADIVINAR
//    (esto es SOPORTE del código: en la vista final NO se ve ningún rótulo de zona)
//
//    ZONA 1 · CLIENTE Y CONDICIONES → `NotaRemisionCabecera.tsx`
//    ZONA 2 · DATOS DE ENVÍO        → ⏸ OCULTA (decisión del dueño, 05 Oct 2026):
//                                     `id_metodo_envio` sigue en el contrato y vuelve en V2.
//                                     NO se renderiza: se reserva el número.
//    ZONA 3 · PARTIDAS              → `PartidasRemisionGrid.tsx` (+ el kit `PartidasGrid`)
//    ZONA 4 · PIE: TOTALES Y ACCIONES → el `<footer>` de este archivo (abajo)
//    ZONA 5 · CONFIRMACIÓN          → `NotaRemisionConfirmacion.tsx` (la pantalla 02)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Ayuda } from '@/components/ui/Ayuda'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { formatearMoneda } from '@/lib/utils/formatters'
import { NotaRemisionCabecera, type CamposCabecera } from '@/components/ventas/NotaRemisionCabecera'
import {
    PartidasRemisionGrid,
    nuevaCortesia,
    type InfoRenglon,
} from '@/components/ventas/PartidasRemisionGrid'
import { NotaRemisionConfirmacion } from '@/components/ventas/NotaRemisionConfirmacion'
import { AsignarNSDialog } from '@/components/ventas/AsignarNSDialog'
import { AutorizacionDialog, type ActoAutorizacion } from '@/components/ventas/AutorizacionDialog'
import { crearNotaRemisionDirecta, resolverPrecioPartida } from '@/lib/actions/ventas'
import type { ClienteOpcion } from '@/types/clientes'
import type { NotaRemisionInput } from '@/types/ventas'
import type { PartidaRemisionForm } from '@/lib/validations/ventas'

/** Las DOS pantallas del acto. */
type Vista = 'captura' | 'confirmar'

/**
 * El borrador nace con **crédito marcado**: el dueño lo fijó el 05 Oct 2026 —
 * *«prácticamente todos tienen crédito, así es el modelo de negocio»*.
 * ⚠️ `fecha_vencimiento` **ya no se captura**: la deriva la SA (emisión + el plazo del cliente).
 */
function borradorInicial(): NotaRemisionInput {
    const hoy = new Date().toISOString().slice(0, 10)
    return {
        id_cliente: '',
        es_credito: true,
        fecha_emision: hoy,
        // ⭐ El descuento del DOCUMENTO (3er nivel): vacío = sin descuento (0%).
        descuento_global_porcentaje: '',
        id_vendedor: '',
        id_metodo_envio: '',
        notas: '',
        partidas: [],
        numeros_serie: [],
    }
}

interface NotaRemisionModalProps {
    open: boolean
    onOpenChange: (abierto: boolean) => void
    /** La emisión terminó: el listado se refresca. */
    onEmitida: () => void
}

/**
 * Una línea del desglose de totales del pie. `tono` elige el peso visual:
 * `descuento` va en el color de aviso (es plata que NO se cobra) y `fuerte` en el color del texto.
 */
function LineaTotal({
    etiqueta,
    valor,
    tono = 'normal',
}: {
    etiqueta: string
    valor: string
    tono?: 'normal' | 'descuento' | 'fuerte'
}) {
    const color =
        tono === 'descuento'
            ? 'text-warning'
            : tono === 'fuerte'
              ? 'text-foreground'
              : 'text-muted-foreground'
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className={`text-[11.5px] ${color}`}>{etiqueta}</span>
            <span className={`font-mono text-[12.5px] tabular-nums ${color}`}>{valor}</span>
        </div>
    )
}

export function NotaRemisionModal({ open, onOpenChange, onEmitida }: NotaRemisionModalProps) {
    const [borrador, setBorrador] = useState<NotaRemisionInput>(borradorInicial)
    const [vista, setVista] = useState<Vista>('captura')
    /** ⭐ Lo que la cascada resolvió por renglón (piso + NS + lote), por **id de renglón**. */
    const [info, setInfo] = useState<Record<string, InfoRenglon>>({})
    /**
     * ⭐ ANEXIÓN 05 Oct 2026: la OPCIÓN del cliente elegido (no solo su id) — de ahí sale el
     * `dias_credito` que la confirmación muestra como plazo, sin una consulta extra.
     */
    const [clienteSel, setClienteSel] = useState<ClienteOpcion | null>(null)
    const [nsAbierto, setNsAbierto] = useState(false)
    const [autorizacion, setAutorizacion] = useState<ActoAutorizacion | null>(null)
    const [motivoAut, setMotivoAut] = useState('')
    const [autAbierta, setAutAbierta] = useState(false)
    const [emitiendo, setEmitiendo] = useState(false)
    /**
     * ⭐ ESCENARIO D del mockup: la lista del cliente no respondió. Se guarda QUÉ renglón
     * quedó sin precio para poder **reintentar sin volver a teclear**.
     */
    const [errorCascada, setErrorCascada] = useState<{
        indice: number
        idProducto: string
    } | null>(null)
    /** ⭐ ESCENARIO E del mockup: el descarte se confirma con cifras, no con un `window.confirm`. */
    const [descartarAbierto, setDescartarAbierto] = useState(false)

    const partidas = borrador.partidas

    // ── Lo que el pie y la confirmación MUESTRAN (una sola definición de cada cifra) ──
    // ⚠️ `total` es el NETO que se va a emitir: el RPC hace `v_total := v_subtotal − descuento_global`.
    //    Si el pie mostrara solo la suma de renglones, **mentiría** en cuanto hay descuento del documento.
    const subtotal = partidas.reduce(
        (acc, p) => acc + (Number(p.cantidad) || 0) * (Number(p.precio_unitario_final) || 0),
        0
    )
    const pctDocumento = Number(borrador.descuento_global_porcentaje) || 0
    const descuentoDocumento = Number(((subtotal * pctDocumento) / 100).toFixed(4))
    const total = subtotal - descuentoDocumento
    /**
     * ⭐ LOS TOTALES DEL PIE (dueño, 05 Oct 2026: *«el que es precio de lista no va ahí, ahí va el
     * valor que está en el campo final»*).
     *
     * ⚠️ **Ya NO se calcula ningún «precio de lista»**: ese número (`base × (1 − lista)`) **no
     *    refleja lo que se va a cobrar** en cuanto el vendedor toca el precio a mano. El dato que
     *    manda es el **capturado**, `Σ (precio_unitario_final × cantidad)`, que ya trae la lista
     *    **y** el descuento por partida adentro — y por eso tampoco hay línea de partida (se
     *    contaría dos veces).
     * ⚠️ Y el descuento del documento se calcula **sobre ese subtotal**, igual que el RPC
     *    (`v_total := v_subtotal − v_descuento_glob`): si se calculara sobre la lista, el total
     *    que ve el vendedor no sería el que se emite.
     */
    const piezas = partidas.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0)
    const nsAmarrados = partidas.reduce((acc, p) => acc + (p.series?.length ?? 0), 0)
    const cortesias = partidas.filter((p) => p.es_cortesia).length
    /** El piso es AVISO: el bloqueo real lo hace el trigger sobre el precio re-derivado. */
    const renglonesBajoPiso = partidas.filter((p) => {
        const piso = info[p.id]?.piso
        const precio = Number(p.precio_unitario_final) || 0
        return !p.es_cortesia && piso != null && precio > 0 && precio < piso
    }).length
    /** ⭐ R30: un producto con NS no se emite sin sus N piezas capturadas. */
    const renglonesSinNS = partidas.filter(
        (p) => info[p.id]?.manejaNS && (p.series?.length ?? 0) < (Number(p.cantidad) || 0)
    ).length
    /**
     * ⭐ ANEXIÓN 05 Oct 2026: renglones que **no tienen de dónde surtir** (ningún lote con
     * disponible). La emisión hace FIFO sobre `lotes` ⇒ con esto, **va a fallar**.
     */
    const renglonesSinLote = partidas.filter(
        (p) => info[p.id]?.hayLote === false && (Number(p.cantidad) || 0) > 0
    ).length

    const listo = Boolean(borrador.id_cliente) && partidas.length > 0 && renglonesSinNS === 0

    const patchCabecera = (parcial: Partial<CamposCabecera>) =>
        setBorrador((b) => ({ ...b, ...parcial }))

    const patchPartidas = (nuevas: PartidaRemisionForm[]) =>
        setBorrador((b) => ({ ...b, partidas: nuevas }))

    /** ⭐ La cortesía se AGREGA desde la cabecera del grid (ya no es un checkbox por renglón). */
    const agregarCortesia = () =>
        setBorrador((b) => ({ ...b, partidas: [...b.partidas, nuevaCortesia()] }))

    /**
     * ⭐ LA CASCADA (R32) — vive acá, que es quien tiene el `idCliente` y el borrador.
     * La dispara el grid con `onProductoElegido(indice, idProducto)`: el grid AVISA, no decide.
     * ⚠️ Se actualiza con la forma **funcional**: `resolverPrecioPartida` es asíncrona y un
     * setter capturado antes del `await` pisaría lo que el usuario tecleó mientras tanto.
     */
    const cascadaDePrecio = async (indice: number, idProducto: string) => {
        const idFila = borrador.partidas[indice]?.id
        if (!idFila) return

        // Producto limpiado: el renglón no puede quedar con el precio del producto ANTERIOR.
        if (!idProducto) {
            setBorrador((b) => ({
                ...b,
                partidas: b.partidas.map((p, i) =>
                    i === indice
                        ? {
                              ...p,
                              id_producto: '',
                              precio_base_snapshot: '0',
                              descuento_lista_porcentaje: '0',
                              descuento_adicional_porcentaje: '0',
                              precio_unitario_final: '0',
                          }
                        : p
                ),
            }))
            setInfo((prev) => ({
                ...prev,
                [idFila]: { piso: null, manejaNS: false, hayLote: true, precioConLista: 0 },
            }))
            return
        }

        const res = await resolverPrecioPartida(borrador.id_cliente, idProducto)
        if (!res.success || !res.data) {
            // ⭐ ESCENARIO D — la lista no respondió: se DICE, y el renglón queda con el precio
            //    VACÍO hasta que responda (no se deja el precio del producto anterior, que sería
            //    un dato falso). Lo capturado no se toca: el reintento no vuelve a teclear nada.
            setErrorCascada({ indice, idProducto })
            setInfo((prev) => ({
                ...prev,
                [idFila]: { piso: null, manejaNS: false, hayLote: true, precioConLista: 0 },
            }))
            setBorrador((b) => ({
                ...b,
                partidas: b.partidas.map((fila, i) =>
                    i === indice
                        ? {
                              ...fila,
                              id_producto: idProducto,
                              precio_base_snapshot: '0',
                              descuento_lista_porcentaje: '0',
                              descuento_adicional_porcentaje: '0',
                              precio_unitario_final: '0',
                          }
                        : fila
                ),
            }))
            return
        }
        // Respondió: el aviso se va solo.
        setErrorCascada(null)

        const p = res.data
        // ⭐ El piso, el NS y el LOTE se guardan POR ID DE RENGLÓN (el bug anterior los cruzaba
        //    con el id del producto) ⇒ ahora el aviso y el botón de NS no pueden desalinearse.
        setInfo((prev) => ({
            ...prev,
            [idFila]: {
                piso: p.precio_minimo,
                manejaNS: p.maneja_numero_serie,
                hayLote: p.lotes_disponibles > 0,
                // ⭐ El precio con la lista —ya con el signo de `tipo_ajuste`— lo resuelve el
                //    SERVIDOR: la vista previa del renglón lo COPIA, no lo recalcula.
                precioConLista: p.precio_con_lista,
            },
        }))
        setBorrador((b) => ({
            ...b,
            partidas: b.partidas.map((fila, i) =>
                i === indice
                    ? {
                          ...fila,
                          id_producto: idProducto,
                          precio_base_snapshot: String(p.precio_base),
                          descuento_lista_porcentaje: String(p.descuento_lista_porcentaje),
                          // ⭐ M5 — el PRECIO LISTA nace del servidor (`base × (1 ± lista)`) y es
                          //    **editable**: lo que se ve en el campo es lo que se va a mandar.
                          precio_lista: String(p.precio_con_lista),
                          // Nace sin negociar: el % de partida en 0 ⇒ unitario = precio lista.
                          precio_unitario_final: String(p.precio_con_lista),
                          descuento_adicional_porcentaje: '0',
                      }
                    : fila
            ),
        }))
    }

    const limpiar = () => {
        setBorrador(borradorInicial())
        setVista('captura')
        setInfo({})
        setClienteSel(null)
        setAutorizacion(null)
        setErrorCascada(null)
    }

    /**
     * ⭐ CERRAR — ESCENARIO E del mockup. ⚠️ No hay borrador (D-17): cerrar **destruye** el
     * trabajo, así que el aviso **dice cuánto se pierde** (renglones · piezas · total) y se
     * confirma en el **diálogo de la casa**, cuya salida segura se llama **«Seguir capturando»**
     * — porque «Cancelar», acá, destruye trabajo.
     * ⚠️ Un `window.confirm` con cifras ya era mejor que uno sin ellas, pero no es de la casa y
     *    su botón dice «Aceptar/Cancelar»: no distingue descartar de seguir.
     */
    const cerrar = (abierto: boolean) => {
        if (!abierto && borrador.partidas.length > 0) {
            setDescartarAbierto(true)
            return
        }
        if (!abierto) limpiar()
        onOpenChange(abierto)
    }

    /** El descarte REAL, ya confirmado en el diálogo. */
    const descartar = () => {
        setDescartarAbierto(false)
        limpiar()
        onOpenChange(false)
    }

    /**
     * ⭐ EMITE. ⚠️ `aut` llega POR PARÁMETRO: el estado recién seteado NO se ve en este
     * render, así que reintentar leyendo `autorizacion` mandaría `undefined` y volvería a
     * bloquear (era el defecto del MVP, corregido el 02 Oct 2026).
     */
    const emitir = async (aut: ActoAutorizacion | null = autorizacion) => {
        setEmitiendo(true)
        const res = await crearNotaRemisionDirecta({
            ...borrador,
            partidas,
            numeros_serie: partidas.flatMap((p) => p.series ?? []),
            // El motivo VIAJA: se registra como `motivo_autorizacion` (el piso) y destraba
            // las tres puertas (MVP · sin 2º nivel).
            autorizacion: aut ?? undefined,
        })
        setEmitiendo(false)

        if (!res.success) {
            const texto = res.error ?? 'No se pudo emitir.'
            const esAutorizable = /autoriza|MOROSO|límite|mínimo/i.test(texto)
            if (esAutorizable) {
                setMotivoAut(texto)
                setAutAbierta(true)
                return
            }
            toast.error(texto)
            return
        }

        toast.success(`Nota ${res.data?.folio} emitida.`)
        onEmitida()
        cerrar(false)
        onOpenChange(false)
    }

    return (
        <>
            <Dialog open={open} onOpenChange={cerrar}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>
                            {vista === 'captura' ? 'Nueva nota de remisión' : 'Confirmar la emisión'}
                        </DialogTitle>
                        <DialogDescription>
                            {vista === 'captura' ? (
                                <Ayuda k="ventas.modal-que-hace" />
                            ) : (
                                <Ayuda k="ventas.confirmar-irreversible" />
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {vista === 'captura' ? (
                        <div className="flex flex-col gap-4">
                            {/* ═══ ZONA 1 · CLIENTE Y CONDICIONES ═══════════════════════ */}
                            <NotaRemisionCabecera
                                valor={{
                                    id_cliente: borrador.id_cliente,
                                    es_credito: borrador.es_credito,
                                    fecha_emision: borrador.fecha_emision,
                                    descuento_global_porcentaje:
                                        borrador.descuento_global_porcentaje,
                                }}
                                onPatch={patchCabecera}
                                onClienteElegido={setClienteSel}
                                disabled={emitiendo}
                            />

                            {/* ═══ ZONA 2 · DATOS DE ENVÍO — ⏸ OCULTA ═══════════════════
                                Decisión del dueño (05 Oct 2026): el método de envío vuelve en
                                V2. El campo sigue en el contrato (`id_metodo_envio`, nullable)
                                y NO se pide. Se reserva el número para no renumerar el mapa de
                                zonas. ⚠️ NO renderizar nada acá hasta V2. */}

                            {/* ═══ ZONA 3 · PARTIDAS ════════════════════════════════════
                                ⚠️ El estado vacío lo pinta el PROPIO grid (escenario A del
                                mockup): invitación + botón + porqué. Acá NO se repite. */}

                            {/* ⭐ ESCENARIO D — la lista del cliente no respondió. Se avisa ACÁ
                                (no en un toast que se va) y se ofrece REINTENTAR: el renglón
                                quedó con el precio vacío, pero nada de lo capturado se perdió.
                                ⚠️ El aviso en sí es ERROR (por lo que pasó) ⇒ no se cataloga; lo
                                que se cataloga son sus dos explicaciones. */}
                            {errorCascada && (
                                <div className="rounded-md border border-warning/45 bg-warning/10 px-3 py-2.5">
                                    <p className="text-[13px] font-semibold">
                                        La lista de precios del cliente no respondió.
                                    </p>
                                    <Ayuda
                                        k="ventas.cascada-reintentar"
                                        className="text-[12.5px] text-muted-foreground"
                                    />
                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                void cascadaDePrecio(
                                                    errorCascada.indice,
                                                    errorCascada.idProducto
                                                )
                                            }
                                        >
                                            Reintentar
                                        </Button>
                                        <Ayuda
                                            k="ventas.cascada-precio-vacio"
                                            className="text-[11.5px] text-muted-foreground"
                                        />
                                    </div>
                                </div>
                            )}

                            <PartidasRemisionGrid
                                partidas={partidas}
                                onChange={patchPartidas}
                                onProductoElegido={(indice, idProducto) =>
                                    void cascadaDePrecio(indice, idProducto)
                                }
                                onAsignarNS={() => setNsAbierto(true)}
                                onAgregarCortesia={agregarCortesia}
                                info={info}
                                sinCliente={!borrador.id_cliente}
                                /**
                                 * ⭐ EL DESGLOSE, en la barra de abajo de las partidas (pedido del
                                 * dueño, 05 Oct 2026). Se arma acá porque las cifras son de este
                                 * componente; el grid solo le da el lugar.
                                 */
                                totales={
                                    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-surface px-3 py-2">
                                        {/*
                                         * ⭐ EL DATO QUE MANDA ES EL **PRECIO FINAL** (dueño, 05 Oct 2026):
                                         * *«el que es precio de lista no va ahí, ahí va el valor que está en
                                         * el campo final»*. Y tiene razón por un caso concreto: **si el
                                         * usuario cambia el precio a mano**, una línea de «precio de lista»
                                         * seguiría mostrando `base × lista` — un número que **ya no es el
                                         * que se va a cobrar**.
                                         * ⚠️ Es `Σ (precio_unitario_final × cantidad)` = el **subtotal** de la
                                         * BD: ya trae **la lista Y el descuento por partida** adentro, que es
                                         * justo el orden que el dueño pidió («es después también del descuento
                                         * por partida»). Por eso **no** hay línea de descuento por partida:
                                         * estaría contada dos veces.
                                         */}
                                        <LineaTotal
                                            etiqueta="Importe de las partidas"
                                            valor={formatearMoneda(subtotal)}
                                            tono="fuerte"
                                        />
                                        {descuentoDocumento > 0 && (
                                            <LineaTotal
                                                etiqueta={`Descuento del documento ${pctDocumento}%`}
                                                valor={`− ${formatearMoneda(descuentoDocumento)}`}
                                                tono="descuento"
                                            />
                                        )}
                                        <div className="mt-1 flex items-baseline justify-between border-t border-border pt-1.5">
                                            <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                                                Total
                                            </span>
                                            <span className="font-display text-xl font-extrabold tabular-nums">
                                                {formatearMoneda(total)}
                                            </span>
                                        </div>
                                    </div>
                                }
                                // ⚠️ Sin cliente el grid nace APAGADO: el precio sale de SU lista.
                                disabled={!borrador.id_cliente || emitiendo}
                            />

                            {/* ═══ ZONA 4 · PIE: ACCIONES ════════════════════════════════
                                ⚠️ Los TOTALES ya NO van acá: el dueño los pidió **en la barra de
                                partidas, justo abajo de ellas** (05 Oct 2026) y viajan al grid
                                por su ranura `totales`. Acá queda solo la salida y la acción. */}
                            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                                <span className="text-[11.5px] text-muted-foreground">
                                    {partidas.length}{' '}
                                    {partidas.length === 1 ? 'renglón' : 'renglones'} · {piezas}{' '}
                                    {piezas === 1 ? 'pieza' : 'piezas'}
                                </span>
                                <div className="ml-auto flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => cerrar(false)}
                                        disabled={emitiendo}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => setVista('confirmar')}
                                        disabled={!listo || emitiendo}
                                        title={
                                            !borrador.id_cliente
                                                ? 'Elegí el cliente para empezar.'
                                                : partidas.length === 0
                                                  ? 'Agregá al menos una partida.'
                                                  : renglonesSinNS > 0
                                                    ? `Faltan números de serie en ${renglonesSinNS} ${renglonesSinNS === 1 ? 'renglón' : 'renglones'}.`
                                                    : undefined
                                        }
                                    >
                                        Revisar y emitir
                                    </Button>
                                </div>
                            </div>

                            {/* ⚠️ EL BLOQUEO SE DICE (E1-⑧): no se esconde detrás de un botón gris.
                                Es DATO + BANDERA ⇒ NO es una ayuda y no se puede apagar. */}
                            {renglonesSinNS > 0 && (
                                <p className="rounded-md border border-warning/45 bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
                                    <b>
                                        Faltan números de serie: {renglonesSinNS}{' '}
                                        {renglonesSinNS === 1 ? 'renglón' : 'renglones'} sin
                                        completar.
                                    </b>{' '}
                                    La nota no se emite hasta capturarlos todos — usá «Asignar NS»
                                    en el renglón.
                                </p>
                            )}
                        </div>
                    ) : (
                        /* ═══ ZONA 5 · LA CONFIRMACIÓN (pantalla 02) ═══════════════════ */
                        <NotaRemisionConfirmacion
                            clienteNombre={clienteSel?.nombre_comercial ?? '—'}
                            esCredito={borrador.es_credito}
                            diasCredito={clienteSel?.dias_credito ?? null}
                            fechaEmision={borrador.fecha_emision}
                            renglones={partidas.length}
                            piezas={piezas}
                            subtotal={subtotal}
                            descuentoPorcentaje={pctDocumento}
                            descuentoMonto={descuentoDocumento}
                            total={total}
                            nsAmarrados={nsAmarrados}
                            renglonesBajoPiso={renglonesBajoPiso}
                            cortesias={cortesias}
                            renglonesSinLote={renglonesSinLote}
                            onVolver={() => setVista('captura')}
                            onConfirmar={() => void emitir()}
                            emitiendo={emitiendo}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AsignarNSDialog
                open={nsAbierto}
                onOpenChange={setNsAbierto}
                partidas={partidas}
                // ⭐ Las series se DERIVAN de las filas: no hay estado paralelo que se desincronice.
                // ⚠️ El diálogo habla en `Record<id_partida, string[]>`, así que la conversión se
                //    hace AQUÍ, en el borde: es la única frontera con esa forma.
                series={Object.fromEntries(partidas.map((p) => [p.id, p.series ?? []])) as Record<
                    string,
                    string[]
                >}
                onConfirmar={(s) => {
                    // ⭐ El diálogo escribe DENTRO de la fila (que es donde el tipo declara las series)
                    setBorrador((b) => ({
                        ...b,
                        partidas: b.partidas.map((p) => ({ ...p, series: s[p.id] ?? [] })),
                    }))
                }}
            />

            <AutorizacionDialog
                open={autAbierta}
                onOpenChange={setAutAbierta}
                motivo={motivoAut}
                onAutorizar={(acto) => {
                    // ⭐ MVP — al confirmar se REINTENTA la emisión con el acto en la mano.
                    setAutorizacion(acto)
                    void emitir(acto)
                }}
            />

            {/* ⭐ ESCENARIO E — el descarte, CON cifras y con la salida segura bien nombrada.
                ⚠️ El texto lo arma el modal porque lleva los números del caso. */}
            <ConfirmarAccionDialog
                open={descartarAbierto}
                onOpenChange={setDescartarAbierto}
                titulo="¿Descartar lo capturado?"
                descripcion={`La nota no se guarda hasta emitirse. Si cerrás ahora, se pierden ${partidas.length} ${
                    partidas.length === 1 ? 'renglón' : 'renglones'
                } y ${piezas} ${piezas === 1 ? 'pieza' : 'piezas'} (${formatearMoneda(
                    total
                )}) y no hay forma de recuperarlos.`}
                confirmLabel="Descartar y cerrar"
                // 🔴 La salida segura NO se llama «Cancelar»: acá cancelar destruye trabajo.
                cancelLabel="Seguir capturando"
                variant="destructive"
                onConfirm={async () => {
                    descartar()
                    return { error: null }
                }}
            />
        </>
    )
}
