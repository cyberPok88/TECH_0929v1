'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AJUSTE DEV MODAL — la DEV de la entrada: VERLA y resolverla (Guía 1.6 · P4)
//
// Camino A: el recepcionista **ve la devolución** (de qué partida y de qué producto declarado
// se devuelve, con qué motivo y en qué estado), valida, ajusta la partida (original vs vigente)
// y genera la NOTA DE COMPRA por las aprobadas (`ajustarYGenerarNota`, transaccional).
//
// ⭐ MEJORA 23 Sep 2026 (12) — la columna «DEV» de Recepción dejó de ser un número muerto: su
// píldora es **botón** y abre ESTE modal (`crearColumnaDevolucion`). Dos puertas, una sola
// superficie: la píldora DEV (consultar) y el botón «Ajustar y generar nota» de la columna
// «Final» / del desglose (actuar). No se duplicó nada — el modal ya tenía la acción y el
// mensaje; le faltaba **decir qué se devuelve**:
//   · partida (#) + **producto declarado** = categoría + atributos de recepción (la huella)
//   · motivo · cantidad · % de salud · NS · **estado** de la DEV (por cotejar / ajustada) y su fecha
//   · y, si la entrada ya tiene nota, el botón que **abre la nota** (`NotaCompraDetalleModal`,
//     dueño 1.4 — el mismo de la MEJORA 11): «✅ Nota NC-0006 generada y ligada a la entrada» →
//     «Ver nota», sin salir de Recepción.
//
// ⚠️ Honestidad del dato: una pieza devuelta **no tiene SKU** (lo resuelve Almacén y solo para lo
// **aprobado**) y la marca que el técnico elige en el wizard se descarta al agrupar los NO_PASA por
// (partida, motivo). Por eso el «producto» aquí es la **huella declarada en recepción**, que es
// exactamente el mismo lenguaje con el que la nota describe su línea (`lineaSoftDe`).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Pildora } from '@/components/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { NotaCompraDetalleModal } from '@/components/compras/NotaCompraDetalleModal'
import { formatearFechaEntrada, huellaDeclarada } from '@/components/entradas/columnas-entrada'
import { ajustarYGenerarNota, listarResultadoRevision } from '@/lib/actions/entradas'
import type { Entrada, ResultadoRevision } from '@/types/entradas'
import { puedeAjustarNota, TEXTO_ESTADO_DEVOLUCION, TONO_ESTADO_DEVOLUCION } from '@/types/entradas'

interface AjusteDevModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
    /**
     * ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — **acota la devolución a una partida**.
     * La píldora «n malas» del desglose de Revisión vive en una partida: el número que tocaste es
     * de ESA partida, así que el modal llega diciendo cuál y un enlace devuelve el alcance
     * completo. `null` = todas (el alcance clásico, el de la píldora DEV de Recepción).
     * **Una puerta, dos profundidades** — mismo criterio que la MEJORA 12.
     */
    idPartidaFiltro?: string | null
    onGuardado?: () => void
}

/** La DEV de una entrada: verla (partida · producto declarado · motivo · estado) y resolverla. */
export function AjusteDevModal({
    open,
    onOpenChange,
    entrada,
    idPartidaFiltro = null,
    onGuardado,
}: AjusteDevModalProps) {
    const [resultado, setResultado] = useState<ResultadoRevision | null>(null)
    const [cargando, setCargando] = useState(false)
    /** Folio recién generado (para el mensaje de éxito). */
    const [generada, setGenerada] = useState<{ id: string; folio: string } | null>(null)
    const [verNota, setVerNota] = useState(false)
    /** ¿El usuario pidió ver TODA la entrada aunque la píldora fuera de una partida? */
    const [verTodas, setVerTodas] = useState(false)

    // ⚠️ NO hay efecto que reinicie `verTodas`: los dos padres montan este modal con `key`
    // (`{entrada}-{partida}` en Revisión, `{entrada}` en Recepción), así que cada apertura es un
    // montaje nuevo y el estado arranca limpio. Un `setState` dentro de un `useEffect` sería un
    // render en cascada por algo que el `key` ya garantiza (lo marca `react-hooks`).

    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void listarResultadoRevision(entrada.id).then((r) => {
            if (activo && r.success) setResultado(r.data ?? null)
        })
        return () => {
            activo = false
        }
    }, [open, entrada])

    // El modal se monta con `key={entrada.id}`: al cambiar de entrada se reinicia el estado.
    //
    // ⚠️ `aprobadasTodas` (no `aprobadas`) manda en `puedeAjustar` y en `motivoApagado`: acotar el
    // DISPLAY a una partida no puede cambiar lo que la entrada puede hacer — si la partida que
    // tocaste no tuviera aprobadas, el botón de ajustar quedaría apagado por un filtro de vista.
    const aprobadasTodas = resultado?.aprobadas ?? []
    const devolucionesTodas = resultado?.devoluciones ?? []
    const acotado = Boolean(idPartidaFiltro) && !verTodas
    const aprobadas = acotado
        ? aprobadasTodas.filter((a) => a.id_partida_entrada === idPartidaFiltro)
        : aprobadasTodas
    const devoluciones = acotado
        ? devolucionesTodas.filter((d) => d.id_partida_entrada === idPartidaFiltro)
        : devolucionesTodas
    /** Total del INGRESO: no cambia al acotar (es el número del documento). */
    const devTotalIngreso = devolucionesTodas.reduce((s, d) => s + Number(d.cantidad), 0)
    /** Total de lo que se está viendo (la partida acotada, o todo). */
    const devTotal = devoluciones.reduce((s, d) => s + Number(d.cantidad), 0)
    const partidaNumero =
        devolucionesTodas.find((d) => d.id_partida_entrada === idPartidaFiltro)?.partida_numero ?? null
    const hayMas = acotado && devolucionesTodas.length > devoluciones.length

    /** La nota de la entrada: la recién generada, o la que ya estaba ligada (`id_nota`). */
    const notaId = generada?.id ?? entrada?.id_nota ?? null
    const notaFolio = generada?.folio ?? entrada?.nota_folio ?? null

    const enPasoDeAjuste = puedeAjustarNota(
        (entrada?.estado ?? 'recien_creada') as Entrada['estado'],
        entrada?.id_nota ?? null
    )
    /**
     * ⭐ FIX 24 Sep 2026 (usuario) — `revisada_sin_dev` significa **revisada SIN devoluciones**:
     * aquí no hay nada que ajustar, solo se genera la nota. El título, el resumen y la etiqueta del
     * botón lo dicen; con `con_dev` (sí hubo rechazos) se conserva «Ajustar y generar nota».
     */
    const soloGenerarNota = entrada?.estado === 'revisada_sin_dev'
    const puedeAjustar = !notaId && enPasoDeAjuste && aprobadasTodas.length > 0

    /** Por qué el botón está apagado — se dice, no se deja al usuario adivinando.
     *  ⚠️ El ESTADO manda: una entrada `en_revision` con DEV ya registrada **no** se puede ajustar
     *  todavía (caso real ING-0007), y decir «ya se ajustó» sería mentir. */
    const motivoApagado =
        notaId || puedeAjustar
            ? null
            : ['recien_creada', 'lista_para_revision', 'en_revision'].includes(entrada?.estado ?? '')
              ? 'La revisión todavía no cierra: la devolución se ajusta y la nota se genera cuando la entrada quede revisada.'
              : entrada?.estado === 'bloqueada_por_divergencia'
                ? 'La entrada está bloqueada por una divergencia: se resuelve antes de ajustar y generar la nota.'
                : aprobadasTodas.length === 0
                  ? 'No hay piezas aprobadas: la nota se genera con lo que sí se recibe.'
                  : null

    const ajustar = async () => {
        if (!entrada) return
        setCargando(true)
        const res = await ajustarYGenerarNota(entrada.id)
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo ajustar.')
            return
        }
        setGenerada(res.data ?? null)
        void listarResultadoRevision(entrada.id).then((r) => {
            if (r.success) setResultado(r.data ?? null)
        })
        // ⭐ MEJORA 26 — si no quedaba saldo por ingresar (todo salió por tandas), la misma
        // operación cierra el documento: se dice, en vez de dejar al usuario esperando una
        // fase de Acondicionamiento que ya no tiene mercancía.
        toast.success(
            res.data?.cerrada
                ? `Nota ${res.data.folio} generada · la entrada quedó cerrada (su mercancía ya entró por tandas)`
                : `Nota de compra ${res.data?.folio} generada`
        )
        onGuardado?.()
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                    {/* ⭐ 24 Sep 2026 (usuario) — «que se vea que tiene ESTRUCTURA, dónde va el título
                        y el botón de atrás». La banda del encabezado se separa del cuerpo (superficie
                        + borde) y dentro va UNA fila: [← Atrás 44][Título].
                        ⚠️ NO se usa `flex-row` en el `DialogHeader`: el eyebrow de dominio lo inyecta
                        la primitiva como PRIMER hijo, así que caería dentro de la fila, y el
                        `space-y-1.5` del kit le pondría 6px de margen al título → desalineado con
                        «Atrás» (deriva §4 #9 de la SPEC, medida en código). Con el eyebrow fuera de la
                        fila queda la anatomía de §2.1: eyebrow → fila de retroceso + título. */}
                    <DialogHeader className="-mx-6 -mt-6 space-y-2 border-b border-border bg-surface-2 px-6 pb-4 pt-5 text-left">
                        <div className="flex flex-row items-center gap-3">
                            {/* Retroceso visible, no la × de la esquina (ley L13). */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={cargando}
                                className="min-h-11 gap-1.5 px-3 text-[14px]"
                            >
                                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                                Atrás
                            </Button>
                            <DialogTitle>
                                {soloGenerarNota ? 'Nota de compra' : 'Devolución'} ·{' '}
                                {entrada?.folio ?? 'Entrada'}
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                    <div className="space-y-5">
                        {/* De qué entrada hablamos: proveedor · recepción · DEV acumulada.
                            ⭐ Si la apertura vino de la píldora de una partida, se dice cuál. */}
                        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span>
                                {entrada?.proveedor_nombre ?? 'Sin proveedor'} · recibida el{' '}
                                {entrada ? formatearFechaEntrada(entrada.fecha) : '—'} ·{' '}
                                {soloGenerarNota ? (
                                    <span className="text-success">sin devoluciones</span>
                                ) : (
                                    <span className="text-destructive">
                                        DEV −{devTotal || entrada?.devolucion_total || 0} pza
                                    </span>
                                )}
                            </span>
                            {acotado && partidaNumero != null && (
                                <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                                    Partida #{partidaNumero}
                                </span>
                            )}
                        </p>

                        {/* ⭐ 24 Sep 2026 (usuario) — «un loader cada que algo está cargando»: el
                            resultado viaja por Server Action y hasta que llega, las secciones se veían
                            vacías (parecía «sin devoluciones» sin serlo). */}
                        {!resultado && (
                            <Spinner etiqueta="Cargando el resultado de la revisión…" className="py-1" />
                        )}

                        {/* Sin devoluciones no hay nada que ajustar: se dice en una línea en vez de
                            mostrar una tabla vacía con su encabezado. */}
                        {soloGenerarNota && devolucionesTodas.length === 0 ? (
                            <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                                La revisión terminó <span className="text-foreground">sin devoluciones</span>:
                                falta generar la nota de compra por lo aprobado.
                            </p>
                        ) : (
                        <section>
                            <h4 className="mb-2 font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                {acotado && partidaNumero != null
                                    ? `Devoluciones de la partida #${partidaNumero} (se ajustan)`
                                    : 'Devoluciones (se ajustan)'}
                            </h4>
                            {devoluciones.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin devoluciones registradas.</p>
                            ) : (
                                // ⭐ §1.3 de la SPEC — la tabla es su PROPIA superficie (`bg-surface` +
                                // `shadow-premium-sm`), un escalón ABAJO del modal (`surface-overlay`).
                                // Antes era sólo un borde translúcido sobre el fondo del modal y no se
                                // distinguía de él: *«no se distingue la tabla del fondo»*.
                                <div className="overflow-hidden rounded-md border border-border bg-surface shadow-premium-sm">
                                    <table className="w-full text-xs">
                                        <thead className="border-b border-border bg-surface-2 text-muted-foreground">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium">Partida</th>
                                                <th className="px-3 py-2 text-left font-medium">Producto (huella declarada)</th>
                                                <th className="px-3 py-2 text-left font-medium">Motivo</th>
                                                <th className="px-3 py-2 text-center font-medium">Cant.</th>
                                                <th className="px-3 py-2 text-center font-medium">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {devoluciones.map((d) => (
                                                <tr key={d.id} className="border-t border-border">
                                                    <td className="px-3 py-2 text-left font-mono tabular-nums">
                                                        #{d.partida_numero ?? '—'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {huellaDeclarada(d.categoria_nombre, d.atributos)}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {d.motivo_nombre ?? '—'}
                                                        {d.porcentaje_salud != null && (
                                                            <span className="text-muted-foreground">
                                                                {' '}
                                                                · salud {d.porcentaje_salud}%
                                                            </span>
                                                        )}
                                                        {d.ns && (
                                                            <span className="block font-mono text-[10px] text-muted-foreground">
                                                                NS {d.ns}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-medium tabular-nums text-destructive">
                                                        −{d.cantidad}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <Pildora
                                                            texto={TEXTO_ESTADO_DEVOLUCION[d.estado]}
                                                            tono={TONO_ESTADO_DEVOLUCION[d.estado]}
                                                        />
                                                        {d.fecha_ajuste && (
                                                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                                                {formatearFechaEntrada(d.fecha_ajuste)}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                                El SKU se resuelve en Almacén y solo para lo aprobado: la devolución se
                                identifica por su partida y la huella declarada en recepción.
                            </p>
                            {/* El alcance completo sigue a un toque: la píldora acota, no encierra. */}
                            {hayMas && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-1.5"
                                    onClick={() => setVerTodas(true)}
                                >
                                    Ver las {devolucionesTodas.length} devoluciones del ingreso (DEV −
                                    {devTotalIngreso})
                                </Button>
                            )}
                        </section>
                        )}

                        <section>
                            <h4 className="mb-2 font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                {acotado && partidaNumero != null
                                    ? `Aprobadas de la partida #${partidaNumero} (se pagarán)`
                                    : 'Aprobadas (se pagarán)'}
                            </h4>
                            {aprobadas.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin piezas aprobadas.</p>
                            ) : (
                                // Misma regla que la tabla: lo que se agrupa vive en SU superficie.
                                <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface text-sm shadow-premium-sm">
                                    {aprobadas.map((a) => (
                                        <li key={a.id} className="flex justify-between gap-3 px-3 py-2">
                                            <span>
                                                {a.producto_sku ?? a.producto_nombre ?? '—'}
                                                {a.marca_nombre && (
                                                    <span className="text-muted-foreground"> · {a.marca_nombre}</span>
                                                )}
                                            </span>
                                            <span className="tabular-nums">{a.cantidad_aprobada}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* La nota: recién generada aquí, o la que la entrada ya tenía ligada. */}
                        {notaId && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-success/30 bg-success/10 p-3">
                                <p className="text-sm">
                                    ✅ Nota <span className="font-mono tabular-nums">{notaFolio}</span>{' '}
                                    {generada ? 'generada y ligada a la entrada.' : 'ligada a esta entrada.'}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setVerNota(true)}
                                    // ⭐ MEJORA 24 Sep 2026 — tono 3: tinta del primario (sigue al
                                    // tema de cada paleta, sin el relleno sólido de la acción del flujo).
                                    className="border-primary/45 bg-primary-bg text-primary hover:bg-primary/20 hover:text-primary"
                                >
                                    <FileText className="mr-1 h-4 w-4" aria-hidden="true" />
                                    Ver nota {notaFolio}
                                </Button>
                            </div>
                        )}

                        {!notaId && motivoApagado && (
                            <p className="text-[12.5px] text-muted-foreground">{motivoApagado}</p>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={cargando}
                            className="min-h-[52px] px-5 text-[15px]"
                        >
                            Cerrar
                        </Button>
                        {!notaId && (
                            <Button
                                type="button"
                                onClick={ajustar}
                                disabled={cargando || !puedeAjustar}
                                className="min-h-[56px] flex-1 px-6 text-[16px] font-semibold sm:flex-none"
                            >
                                <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                {cargando
                                    ? 'Generando…'
                                    : soloGenerarNota
                                      ? 'Generar nota'
                                      : 'Ajustar y generar nota'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* El modal de la nota (dueño 1.4) — se abre ENCIMA, sin salir de Recepción. */}
            <NotaCompraDetalleModal
                open={verNota}
                onOpenChange={setVerNota}
                notaId={notaId}
                onCambio={onGuardado}
            />
        </>
    )
}
