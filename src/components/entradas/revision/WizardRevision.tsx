'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// WIZARD REVISION — Revisión técnica por PARTIDA (Guía 1.6 · P3 · Smart)
// ⭐ Rediseño 20 Sep 2026 — espejo del `renderWizard` de la V5.
// Vocabulario correcto (usuario 20 Sep): ENTRADA/INGRESO → PARTIDA → PIEZA.
// NO se usa "lote": el técnico elige la PARTIDA, revisa PIEZAS y guarda su AVANCE.
// La revisión captura MARCA + atributos (huella) y aplica `valor_default` (RPM 7200);
// NO resuelve el SKU (lo resuelve ALMACÉN).
//
// ⭐ MEJORA 24 Sep 2026 (Fase 2 · ④) — PASADA TÁCTIL. Esto es el puesto de trabajo del técnico:
// *«el técnico no debe usar el mouse para operar toda esta vista»*. El ciclo se repite decenas de
// veces por turno, así que cada paso se opera con el pulgar y sin puntería:
//   · **PASÓ / NO PASÓ** son dos botones de 116px, no un `<select>` de 36px (era el gesto más
//     repetido del módulo y el peor servido);
//   · el **motivo** son bloques de 62px con su explicación, no una lista desplegable;
//   · el **% de salud** se captura con teclado grande (−/+), no con un `input` de 96px;
//   · **«← Atrás»** siempre visible en el encabezado (la salida natural del pulgar no es el `×`);
//   · **hacer y cerrar**: si al guardar ya no queda nada por revisar, el modal se cierra solo.
// Diseño aprobado: `DOCS/design/entradas/revision-puesto-tactil.html` §5.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Check, Minus, PackageCheck, Plus, ScanLine, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pildora } from '@/components/data-table'
import { cn } from '@/lib/utils'

import { listarMarcasPorCategoria } from '@/lib/actions/productos'
import { atributosDesdeDisco } from '@/lib/lector-discos'
import type { NsTanda } from '@/types/entradas'
import { CapturaNsTanda } from '@/components/entradas/revision/CapturaNsTanda'
import { PanelLectorDiscos } from '@/components/entradas/revision/PanelLectorDiscos'
import {
    guardarAvanceRevision,
    listarCategoriasCapturables,
    listarMotivosRechazo,
    listarPartidasConAvance,
    marcarPartidaLlevaNs,
} from '@/lib/actions/entradas'
import type {
    CategoriaCapturable,
    Entrada,
    MotivoRechazo,
    PartidaConAvance,
    PiezaRevision,
} from '@/types/entradas'

interface WizardRevisionProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
    /** Partida con la que abre (el acordeón pasa la elegida). */
    partidaInicialId?: string
    /**
     * ⭐ MEJORA 25 — abre la puerta de la liberación parcial para ESA partida. La monta el catálogo
     * (una sola instancia del modal, dos puertas: el pie del wizard y el desglose de partidas).
     */
    onLiberar?: (entrada: Entrada, idPartida: string, idGrupo?: string) => void
    onGuardado?: () => void
}

const aTexto = (at: Record<string, unknown> | null | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(at ?? {}).map(([k, v]) => [k, String(v ?? '')]))

export function WizardRevision({
    open,
    onOpenChange,
    entrada,
    partidaInicialId,
    onLiberar,
    onGuardado,
}: WizardRevisionProps) {
    const [partidas, setPartidas] = useState<PartidaConAvance[]>([])
    const [motivos, setMotivos] = useState<MotivoRechazo[]>([])
    const [capturables, setCapturables] = useState<CategoriaCapturable[]>([])

    const [partidaSel, setPartidaSel] = useState('')
    const [marcas, setMarcas] = useState<{ id: string; nombre: string }[]>([])
    const [marcaSel, setMarcaSel] = useState('')
    const [atributos, setAtributos] = useState<Record<string, string>>({})
    const [resultado, setResultado] = useState<'PASA' | 'NO_PASA'>('PASA')
    const [idMotivo, setIdMotivo] = useState('')
    const [porcentajeSalud, setPorcentajeSalud] = useState('')
    /**
     * ⚠️ MEJORA 35 — el serial **ya no se pide aquí**: se captura en el concentrado de la tanda
     * (`CapturaNsTanda`), después de revisar y antes de escribir. El estado `ns` se retiró con el campo.
     */
    /**
     * ⭐ MEJORA 35 (27 Sep 2026) — **el concentrado de la tanda**. Al pulsar Guardar, si la entrada
     * lleva número de serie, se abren las dos pantallas de escaneo (los que pasaron / los que no) y
     * **hasta que no se completan no se escribe nada** (D2). `resolverNs` es la promesa que resuelven:
     * `null` = el técnico canceló → la tanda NO se guarda.
     */
    const [capturaNs, setCapturaNs] = useState<{ pasa: number; noPasa: number } | null>(null)
    const [resolverNs, setResolverNs] = useState<((v: NsTanda | null) => void) | null>(null)
    const [items, setItems] = useState<PiezaRevision[]>([])
    const [objetivo, setObjetivo] = useState('')
    const [cargando, setCargando] = useState(false)
    /** ⭐ MEJORA 28 Sep 2026 — la escritura de la bandera de NS va aparte de `cargando`: apagar el
     *  wizard entero (Atrás, Guardar) por un interruptor de un dato sería desproporcionado. */
    const [cambiandoNs, setCambiandoNs] = useState(false)

    const limpiarEditor = useCallback((conservarMarca = true) => {
        setResultado('PASA')
        setIdMotivo('')
        setPorcentajeSalud('')
        // (MEJORA 35) aquí se limpiaba el serial por pieza: ya no existe ese campo.
        if (!conservarMarca) setMarcaSel('')
    }, [])

    const cargarPartidas = useCallback(
        async (idEntrada: string) => {
            const r = await listarPartidasConAvance(idEntrada)
            const ps = r.success ? r.data ?? [] : []
            setPartidas(ps)
            return ps
        },
        []
    )

    // Carga inicial (partidas con avance · motivos · catálogo capturable).
    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void (async () => {
            const [ps, rm, rc] = await Promise.all([
                cargarPartidas(entrada.id),
                listarMotivosRechazo(),
                listarCategoriasCapturables(),
            ])
            if (!activo) return
            if (rm.success) setMotivos(rm.data ?? [])
            if (rc.success) setCapturables(rc.data ?? [])
            const inicial =
                partidaInicialId && ps.some((p) => p.id === partidaInicialId)
                    ? partidaInicialId
                    : (ps.find((p) => p.restantes > 0)?.id ?? ps[0]?.id ?? '')
            setPartidaSel(inicial)
            setAtributos(aTexto(ps.find((p) => p.id === inicial)?.atributos))
            setItems([])
            setMarcaSel('')
            setObjetivo('')
            limpiarEditor(false)
        })()
        return () => {
            activo = false
        }
    }, [open, entrada, partidaInicialId, cargarPartidas, limpiarEditor])

    const partidaActual = partidas.find((p) => p.id === partidaSel) ?? null
    const categoriaActual = partidaActual?.id_categoria
        ? capturables.find((c) => c.id === partidaActual.id_categoria) ?? null
        : null
    const esquema = useMemo(() => categoriaActual?.esquema ?? [], [categoriaActual])
    // ⭐ REVISIÓN = los `en_huella` que NO se capturaron en recepción y NO son automáticos.
    const enRevision = useMemo(
        () => esquema.filter((a) => a.en_huella && !a.en_entrada && !a.valor_default),
        [esquema]
    )
    // ⭐ Automáticos (ej. rpm=7200): NO se preguntan.
    const defaults = useMemo(() => esquema.filter((a) => !!a.valor_default), [esquema])

    // Marcas por categoría de la partida.
    useEffect(() => {
        if (!open || !partidaActual?.id_categoria) return
        let activo = true
        void listarMarcasPorCategoria(partidaActual.id_categoria).then((r) => {
            if (activo && r.success) {
                setMarcas((r.data ?? []).filter((m) => m.es_activo).map((m) => ({ id: m.id, nombre: m.nombre })))
            }
        })
        return () => {
            activo = false
        }
    }, [open, partidaActual?.id_categoria])

    const cambiarPartida = (id: string) => {
        setPartidaSel(id)
        setMarcaSel('')
        setItems([])
        setObjetivo('')
        setAtributos(aTexto(partidas.find((p) => p.id === id)?.atributos))
        limpiarEditor(false)
    }

    /** Huella = atributos de recepción (snapshot) + revisión + automáticos. */
    const construirHuella = (): Record<string, string> => {
        const huella: Record<string, string> = { ...atributos }
        for (const d of defaults) {
            // ⭐ MEJORA 44 — la LECTURA manda: si el disco ya dijo el dato (un disco de
            // 5425 rpm no es de 7200), el `valor_default` NO lo pisa. El default queda
            // como respaldo para cuando nadie leyó el disco.
            if (huella[d.clave]) continue
            huella[d.clave] = d.valor_default as string
        }
        return huella
    }

    const okMias = items.filter((p) => p.resultado === 'PASA').length
    const malMias = items.filter((p) => p.resultado === 'NO_PASA').length
    const restantes = partidaActual?.restantes ?? 0
    const ya = partidaActual?.revisadas ?? 0
    const total = partidaActual?.cantidad_original ?? 0
    const turno = Math.max(0, Math.min(restantes, objetivo ? Math.floor(Number(objetivo)) : restantes))
    const motivoSel = motivos.find((m) => m.id === idMotivo) ?? null
    /** ⭐ MEJORA 25 — aprobadas de esta partida que todavía NO tienen tanda. */
    const liberables = useMemo(
        () =>
            (partidaActual?.huellas ?? []).reduce(
                (s, h) => s + Math.max(0, h.cantidad_aprobada - h.cantidad_liberada),
                0
            ),
        [partidaActual]
    )

    const agregarPieza = () => {
        if (!marcaSel) {
            toast.error('Elige la marca antes de agregar.')
            return
        }
        if (resultado === 'NO_PASA' && !idMotivo) {
            toast.error('Elige el motivo del rechazo.')
            return
        }
        if (items.length >= restantes) {
            toast.error(`Solo quedan ${restantes} pieza(s) por revisar en esta partida.`)
            return
        }
        setItems((prev) => [
            ...prev,
            {
                id_partida_entrada: partidaSel,
                id_marca: marcaSel,
                atributos: construirHuella(),
                resultado,
                id_motivo: resultado === 'NO_PASA' ? idMotivo : undefined,
                porcentaje_salud:
                    resultado === 'NO_PASA' && porcentajeSalud !== '' ? Number(porcentajeSalud) : undefined,
                // ⚠️ MEJORA 35 — el serial NO viaja en la pieza: va en el concentrado de la tanda.
            },
        ])
        limpiarEditor(true) // conserva la marca (el técnico suele repetirla)
    }

    const quitarPieza = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))

    /**
     * ⭐ MEJORA 28 Sep 2026 — **encender/apagar la bandera de NS de la partida del turno.** Es una
     * escritura real (`marcarPartidaLlevaNs`), no estado local: el guardado la vuelve a leer y el
     * servidor la exige para aceptar el concentrado (D2). Existe porque la bandera nació sin escritor
     * y `editarEntrada` está cerrado a `recien_creada`: lo ya entrado al flujo no tenía por dónde
     * corregirse. Decisión del usuario: la puerta es el técnico, que tiene la pieza en la mano.
     */
    const alternarNs = async () => {
        if (!partidaActual || cambiandoNs) return
        const nuevo = !partidaActual.lleva_ns
        setCambiandoNs(true)
        const res = await marcarPartidaLlevaNs(partidaActual.id, nuevo)
        setCambiandoNs(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo cambiar la bandera de número de serie.')
            return
        }
        setPartidas((prev) => prev.map((p) => (p.id === partidaActual.id ? { ...p, lleva_ns: nuevo } : p)))
        toast.success(
            nuevo
                ? 'Esta partida pedirá escanear los NS al guardar el avance.'
                : 'Esta partida ya no pedirá NS.'
        )
    }

    /**
     * ⭐ MEJORA 25 — persiste el turno y devuelve las partidas RECARGADAS (o `null` si no se pudo).
     * Se separa de `guardar` porque ahora hay DOS consumidores: el guardado normal (que cierra si
     * ya no queda nada) y el «guardar y liberar» (que NO cierra: sigue a la liberación).
     */
    const persistirTurno = async (): Promise<PartidaConAvance[] | null> => {
        if (!entrada || items.length === 0) {
            toast.error('Agrega al menos una pieza a tu avance.')
            return null
        }
        if (items.some((p) => p.resultado === 'NO_PASA' && !p.id_motivo)) {
            toast.error('Toda pieza NO PASA necesita motivo.')
            return null
        }
        setCargando(true)
        // ⭐ MEJORA 35 — el CONCENTRADO: si la partida de este turno lleva NS, se piden ANTES de
        // escribir (D2: sin NS no se guarda una tanda). Primero los que pasaron, después los que no.
        /**
         * ⚠️ MEJORA 28 Sep 2026 — **la bandera se pregunta por la PARTIDA DEL TURNO, no por la entrada.**
         * Antes era `partidas.some(p => p.lleva_ns)`: bastaba que UNA partida del ingreso llevara NS
         * para que el concentrado se pidiera también al revisar otra que no los lleva. El turno
         * (`items`) es siempre de una sola partida — `cambiarPartida` lo vacía al cambiar.
         */
        const pideNs = partidaActual?.lleva_ns === true
        const nPasa = items.filter((p) => p.resultado === 'PASA').length
        const nNoPasa = items.filter((p) => p.resultado === 'NO_PASA').length
        let nsTanda: NsTanda | undefined
        if (pideNs && nPasa + nNoPasa > 0) {
            const capturados = await new Promise<NsTanda | null>((resolve) => {
                setResolverNs(() => resolve)
                setCapturaNs({ pasa: nPasa, noPasa: nNoPasa })
            })
            setCapturaNs(null)
            setResolverNs(null)
            if (!capturados) {
                // ⚠️ Cancelar la captura NO puede dejar el wizard en «Guardando…»: sin liberar el
                // estado, los tres botones del pie quedaban apagados y el modal parecía colgado.
                setCargando(false)
                return null // canceló: la tanda no se guarda
            }
            nsTanda = capturados
        }

        const res = await guardarAvanceRevision({ id_entrada: entrada.id, piezas: items, ns: nsTanda })
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo guardar el avance.')
            return null
        }
        setItems([])
        const ps = await cargarPartidas(entrada.id)
        const p = ps.find((x) => x.id === partidaSel)
        if (p) setAtributos(aTexto(p.atributos))
        onGuardado?.()
        return ps
    }

    const guardar = async () => {
        const ps = await persistirTurno()
        if (!ps) return
        toast.success('Avance de revisión guardado')
        // ⭐ ④ HACER Y CERRAR — si ya no queda NADA por revisar en la entrada, la acción resolvió y
        // no hay siguiente paso: el modal se cierra solo en vez de dejar al técnico buscando el `×`.
        // ⚠️ Si queda trabajo NO se cierra: este wizard guarda **turnos** (el técnico puede tomar
        // otro bloque de piezas), y cerrar a la fuerza obligaría a reabrirlo en cada turno — que es
        // exactamente el «estar cerrando» que el pedido quiere evitar.
        if (!ps.some((x) => x.restantes > 0)) onOpenChange(false)
    }

    /**
     * ⭐ MEJORA 25 (decisión 22.a) — **guardar NO es liberar**. El técnico guarda varias veces por
     * turno; liberar entrega mercancía a otro puesto y es una decisión aparte. Este botón hace las
     * dos cosas en el orden correcto: primero persiste el turno (si lo hay) para que las piezas
     * recién capturadas entren en el conteo, y después abre la puerta de la liberación.
     */
    const guardarYLiberar = async () => {
        if (!entrada) return
        if (items.length > 0) {
            const ps = await persistirTurno()
            if (!ps) return
            toast.success('Avance guardado · libera ahora lo que ya está listo')
        }
        onLiberar?.(entrada, partidaSel)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    {/* ⭐ ④ El retroceso va en el ENCABEZADO, junto al pulgar: la salida natural de
                        una superficie táctil no es el `×` de la esquina. */}
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 shrink-0 px-4"
                            onClick={() => onOpenChange(false)}
                            disabled={cargando}
                            title="Volver a la cola (no se guarda lo que no agregaste)"
                        >
                            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                            Atrás
                        </Button>
                        <DialogTitle>
                            Revisión — {entrada?.folio ?? ''}
                            {partidaActual ? ` · Partida ${partidaActual.partida}` : ''}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                {partidas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Esta entrada no tiene partidas.</p>
                ) : (
                    <div className="space-y-4">
                        {/* Selección de partida */}
                        <div className="space-y-1.5">
                            <Label>Partida</Label>
                            <select
                                className="h-11 w-full rounded-md border bg-surface px-2 text-sm"
                                value={partidaSel}
                                onChange={(e) => cambiarPartida(e.target.value)}
                            >
                                {partidas.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        Partida {p.partida} — {p.categoria_nombre ?? 'sin categoría'} ·{' '}
                                        {p.revisadas}/{p.cantidad_original} revisadas
                                        {p.restantes <= 0 ? ' (completa)' : ` · ${p.restantes} pend.`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ⭐ MEJORA 28 Sep 2026 — **la bandera de NS, corregible desde el puesto.**
                            Dice su consecuencia en las dos direcciones: encendida cambia el trabajo
                            del técnico (al guardar escaneará un NS por pieza) y apagada lo quita. Es la
                            puerta que faltaba para lo que ya había entrado al flujo sin bandera. */}
                        {partidaActual ? (
                            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5">
                                <Button
                                    type="button"
                                    variant={partidaActual.lleva_ns ? 'default' : 'outline'}
                                    className="min-h-11 gap-2 px-3.5 text-[13.5px]"
                                    onClick={() => void alternarNs()}
                                    disabled={cargando || cambiandoNs}
                                    aria-pressed={partidaActual.lleva_ns}
                                    data-accion="lleva-ns"
                                >
                                    <ScanLine className="h-4 w-4" aria-hidden="true" />
                                    {partidaActual.lleva_ns ? 'Esta partida lleva NS' : 'Esta partida no lleva NS'}
                                </Button>
                                <span className="text-[11.5px] text-muted-foreground">
                                    {partidaActual.lleva_ns
                                        ? 'Al guardar el avance se escaneará un NS por cada pieza: uno por aprobada y uno por devuelta.'
                                        : 'Al guardar no se pedirán escaneos. Enciéndelo si esta mercancía trae número de serie.'}
                                </span>
                            </div>
                        ) : null}

                        {/* ⭐ MEJORA 44 — LEER LOS DISCOS DEL DOCK. El navegador no puede leer un
                            disco: se lo pide al AGENTE de esta misma PC. Trae el NS del firmware, la
                            marca, las horas y ⭐ LA SALUD (el `Health` de HDSentinel, que es lo que
                            decide: 100 pasa; menos es devolución). Lo que se aplica es una
                            SUGERENCIA editable — el técnico confirma o corrige. */}
                        <PanelLectorDiscos
                            aplica={/hdd|ssd|m\.2|disco/i.test(partidaActual?.categoria_nombre ?? '')}
                            onElegir={(d) => {
                                const m = marcas.find(
                                    (x) => x.nombre.toLowerCase() === (d.marca ?? '').toLowerCase()
                                )
                                if (m) setMarcaSel(m.id)
                                else if (d.marca) {
                                    toast.error(`La marca «${d.marca}» no está en el catálogo: elegila a mano.`)
                                }
                                const leidos = atributosDesdeDisco(d, esquema)
                                if (Object.keys(leidos).length > 0) {
                                    setAtributos((prev) => ({ ...prev, ...leidos }))
                                }
                            }}
                        />

                        {/* Hero: avance de la partida */}
                        <div className="space-y-2 rounded-lg border bg-surface-2 p-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold">
                                    Avance de la partida: {ya + items.length} / {total}
                                </span>
                                <span className="text-muted-foreground">
                                    <b className="text-foreground">{okMias} OK</b> /{' '}
                                    <b className="text-foreground">{malMias} MAL</b> (tuyas)
                                </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                                <div
                                    className="h-full rounded-full bg-acc-entradas transition-all"
                                    style={{ width: total ? `${Math.round(((ya + items.length) / total) * 100)}%` : '0%' }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Revisadas por todos: <b className="text-foreground">{ya + items.length}</b> · quedan{' '}
                                <b className="text-foreground">{Math.max(0, total - ya - items.length)}</b>. Cada quien
                                revisa su avance y firma al guardar.
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Label className="text-xs">¿Cuántas piezas tomas en este turno? (opcional)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={restantes}
                                    className="w-24"
                                    placeholder={String(restantes)}
                                    value={objetivo}
                                    onChange={(e) => setObjetivo(e.target.value)}
                                />
                                <span className="text-xs text-muted-foreground">
                                    disponibles: <b className="text-foreground">{restantes}</b> · tu turno:{' '}
                                    <b className="text-foreground">{turno}</b>
                                </span>
                            </div>
                        </div>

                        {/* Piezas de este turno */}
                        <div className="space-y-2">
                            <Label>
                                Piezas de este turno ({items.length}/{turno})
                            </Label>
                            {items.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Aún no has agregado piezas en este turno.
                                </p>
                            ) : (
                                <div className="space-y-1.5">
                                    {items.map((pieza, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                                        >
                                            <span className="font-mono text-xs text-muted-foreground">
                                                {i + 1}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate">
                                                {marcas.find((m) => m.id === pieza.id_marca)?.nombre ?? '—'} ·{' '}
                                                {partidaActual?.categoria_nombre ?? '—'}
                                            </span>
                                            <Pildora
                                                texto={pieza.resultado === 'PASA' ? 'PASA' : 'NO PASA'}
                                                tono={pieza.resultado === 'PASA' ? 'exito' : 'peligro'}
                                            />
                                            {pieza.ns ? (
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    N/S {pieza.ns}
                                                </span>
                                            ) : null}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => quitarPieza(i)}
                                                aria-label="Quitar pieza"
                                            >
                                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Editor de pieza */}
                        <div className="space-y-3 rounded-lg border p-4">
                            <p className="text-sm">
                                <b>Pieza {items.length + 1}</b> — categoriza y agrega; firma tu avance al final.
                            </p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Categoría (de la partida)</Label>
                                    <p className="text-sm font-medium">{categoriaActual?.nombre ?? '—'}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">
                                        Marca <span className="text-destructive">*</span>
                                    </Label>
                                    <select
                                        className="h-11 w-full rounded-md border bg-surface px-2 text-sm"
                                        value={marcaSel}
                                        onChange={(e) => setMarcaSel(e.target.value)}
                                        disabled={cargando}
                                    >
                                        <option value="">— elige marca —</option>
                                        {marcas.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {enRevision.map((at) => (
                                    <div key={at.clave} className="space-y-1">
                                        <Label className="text-xs">
                                            {at.etiqueta}
                                            {at.requerido ? <span className="text-destructive"> *</span> : ''}
                                        </Label>
                                        {at.tipo === 'select' && at.opciones ? (
                                            <select
                                                className="h-11 w-full rounded-md border bg-surface px-2 text-sm"
                                                value={atributos[at.clave] ?? ''}
                                                onChange={(e) =>
                                                    setAtributos((prev) => ({ ...prev, [at.clave]: e.target.value }))
                                                }
                                                disabled={cargando}
                                            >
                                                <option value="">—</option>
                                                {at.opciones.map((op) => (
                                                    <option key={op} value={op}>
                                                        {op}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input
                                                type={at.tipo === 'number' ? 'number' : 'text'}
                                                className="h-11"
                                                value={atributos[at.clave] ?? ''}
                                                onChange={(e) =>
                                                    setAtributos((prev) => ({ ...prev, [at.clave]: e.target.value }))
                                                }
                                                disabled={cargando}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {defaults.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Automático: {defaults.map((d) => `${d.etiqueta} = ${d.valor_default}`).join(' · ')}
                                </p>
                            )}

                            {/* ── ④ LA DECISIÓN: dos botones de dedo, no un `select` ─────────
                                Es el gesto MÁS repetido del módulo (una vez por pieza) y el peor
                                servido: un desplegable de 36px. En el piso se acierta sin mirar. */}
                            <div className="space-y-2">
                                <Label className="text-sm">¿Esta pieza pasó?</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setResultado('PASA')}
                                        disabled={cargando}
                                        aria-pressed={resultado === 'PASA'}
                                        className={cn(
                                            'flex min-h-[116px] flex-col items-center justify-center gap-1 rounded-lg border-2 text-xl font-bold transition-colors',
                                            resultado === 'PASA'
                                                ? 'border-success/60 bg-success/15 text-success'
                                                : 'border-border bg-surface-raised text-muted-foreground hover:bg-hover-background'
                                        )}
                                    >
                                        ✓ PASÓ
                                        <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                                            suma al avance
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setResultado('NO_PASA')}
                                        disabled={cargando}
                                        aria-pressed={resultado === 'NO_PASA'}
                                        className={cn(
                                            'flex min-h-[116px] flex-col items-center justify-center gap-1 rounded-lg border-2 text-xl font-bold transition-colors',
                                            resultado === 'NO_PASA'
                                                ? 'border-destructive/60 bg-destructive/15 text-destructive'
                                                : 'border-border bg-surface-raised text-muted-foreground hover:bg-hover-background'
                                        )}
                                    >
                                        ✕ NO PASÓ
                                        <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                                            pide motivo
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {resultado === 'NO_PASA' ? (
                                <div className="space-y-3 rounded-lg border border-destructive/30 p-3">
                                    <div className="space-y-2">
                                        <Label className="text-sm">¿Por qué no pasó?</Label>
                                        <div className="grid gap-2">
                                            {motivos.map((m, i) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setIdMotivo(m.id)}
                                                    disabled={cargando}
                                                    aria-pressed={idMotivo === m.id}
                                                    className={cn(
                                                        'flex min-h-[62px] items-center gap-3 rounded-md border px-4 text-left text-sm font-semibold transition-colors',
                                                        idMotivo === m.id
                                                            ? 'border-warning bg-warning/10'
                                                            : 'border-border bg-surface-raised hover:bg-hover-background'
                                                    )}
                                                >
                                                    <span className="font-mono text-xs text-muted-foreground">
                                                        {i + 1}
                                                    </span>
                                                    {m.nombre}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {motivoSel?.requiere_porcentaje && (
                                        <div className="space-y-2 rounded-md border border-warning/50 bg-warning/10 p-3">
                                            <Label className="text-xs uppercase tracking-wide text-warning">
                                                {motivoSel.nombre} · indica el porcentaje
                                            </Label>
                                            {/* ④ Teclado grande: el % es un dato de dos dígitos y el
                                                dedo no tiene puntería para un `input` de 96px. */}
                                            <div className="grid grid-cols-[64px_1fr_64px] items-center gap-3">
                                                <button
                                                    type="button"
                                                    aria-label="Bajar 5 por ciento"
                                                    disabled={cargando}
                                                    onClick={() =>
                                                        setPorcentajeSalud((v) =>
                                                            String(Math.max(0, Number(v || 0) - 5))
                                                        )
                                                    }
                                                    className="flex min-h-[64px] items-center justify-center rounded-md border border-border bg-surface-raised hover:bg-hover-background"
                                                >
                                                    <Minus className="h-6 w-6" aria-hidden="true" />
                                                </button>
                                                <div className="text-center text-4xl font-bold tabular-nums">
                                                    {porcentajeSalud || '—'}
                                                    <span className="text-lg">%</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    aria-label="Subir 5 por ciento"
                                                    disabled={cargando}
                                                    onClick={() =>
                                                        setPorcentajeSalud((v) =>
                                                            String(Math.min(100, Number(v || 0) + 5))
                                                        )
                                                    }
                                                    className="flex min-h-[64px] items-center justify-center rounded-md border border-border bg-surface-raised hover:bg-hover-background"
                                                >
                                                    <Plus className="h-6 w-6" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            {/* ④ «Registrar y seguir»: la acción resuelve y deja lista la siguiente
                                pieza — no hay que cerrar nada para continuar el turno. */}
                            <Button
                                type="button"
                                className="min-h-[64px] w-full text-base"
                                onClick={agregarPieza}
                                disabled={cargando || !marcaSel || restantes <= items.length}
                            >
                                <Plus className="mr-1.5 h-5 w-5" aria-hidden="true" />
                                {resultado === 'PASA' ? 'Registrar PASÓ y seguir' : 'Registrar NO PASÓ y seguir'}
                                <span className="ml-1.5 opacity-80">
                                    ({items.length + 1} de {turno || restantes})
                                </span>
                            </Button>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => onOpenChange(false)}
                        disabled={cargando}
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Atrás
                    </Button>
                    {/* ⭐ MEJORA 25 (decisión 22.a) — DOS acciones, no una: guardar es la bitácora del
                        turno; liberar es la ENTREGA a otro puesto. Si se fusionaran, cada guardado
                        parcial sacaría mercancía del expediente sin que nadie lo haya pedido. */}
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-[52px] px-5 text-[15px]"
                        onClick={guardarYLiberar}
                        disabled={cargando || partidas.length === 0 || liberables === 0}
                        title={
                            liberables === 0
                                ? 'No hay piezas aprobadas sin liberar en esta partida.'
                                : `${liberables} pieza(s) aprobadas pueden pasar ya a limpieza, sin esperar al resto.`
                        }
                    >
                        <PackageCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Liberar {liberables} a acondicionamiento
                    </Button>
                    <Button
                        type="button"
                        className="min-h-[52px] flex-1 sm:flex-none"
                        onClick={guardar}
                        disabled={cargando || items.length === 0 || partidas.length === 0}
                    >
                        <Check className="mr-1.5 h-5 w-5" aria-hidden="true" />
                        {cargando
                            ? 'Guardando…'
                            : `Guardar avance (${items.length} pieza${items.length === 1 ? '' : 's'})`}
                    </Button>
                </DialogFooter>

                {/* ⭐ MEJORA 35 (27 Sep 2026) — **las dos pantallas del concentrado**: se abren al pulsar
                    Guardar y, sin completarlas, no se escribe nada (D2). Van en z mayor que el diálogo
                    para que el técnico no pierda el turno que está firmando. */}
                {capturaNs && resolverNs ? (
                    <CapturaNsTanda
                        pasa={capturaNs.pasa}
                        noPasa={capturaNs.noPasa}
                        folio={entrada?.folio ?? ''}
                        partida={partidaActual?.partida ?? null}
                        onListo={(lista) => resolverNs(lista)}
                        onCancelar={() => resolverNs(null)}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
