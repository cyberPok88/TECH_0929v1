'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// WIZARD REVISION — Revisión técnica por PARTIDA (Guía 1.6 · P3 · Smart)
// ⭐ Rediseño 20 Sep 2026 — espejo del `renderWizard` de la V5.
// Vocabulario correcto (usuario 20 Sep): ENTRADA/INGRESO → PARTIDA → PIEZA.
// NO se usa "lote": el técnico elige la PARTIDA, revisa PIEZAS y guarda su AVANCE.
// La revisión captura MARCA + atributos (huella) y aplica `valor_default` (RPM 7200);
// NO resuelve el SKU (lo resuelve ALMACÉN).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pildora } from '@/components/data-table'

import { listarMarcasPorCategoria } from '@/lib/actions/productos'
import {
    guardarAvanceRevision,
    listarCategoriasCapturables,
    listarMotivosRechazo,
    listarPartidasConAvance,
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
    onGuardado?: () => void
}

const aTexto = (at: Record<string, unknown> | null | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(at ?? {}).map(([k, v]) => [k, String(v ?? '')]))

export function WizardRevision({
    open,
    onOpenChange,
    entrada,
    partidaInicialId,
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
    const [ns, setNs] = useState('')
    const [items, setItems] = useState<PiezaRevision[]>([])
    const [objetivo, setObjetivo] = useState('')
    const [cargando, setCargando] = useState(false)

    const limpiarEditor = useCallback((conservarMarca = true) => {
        setResultado('PASA')
        setIdMotivo('')
        setPorcentajeSalud('')
        setNs('')
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
        for (const d of defaults) huella[d.clave] = d.valor_default as string
        return huella
    }

    const okMias = items.filter((p) => p.resultado === 'PASA').length
    const malMias = items.filter((p) => p.resultado === 'NO_PASA').length
    const restantes = partidaActual?.restantes ?? 0
    const ya = partidaActual?.revisadas ?? 0
    const total = partidaActual?.cantidad_original ?? 0
    const turno = Math.max(0, Math.min(restantes, objetivo ? Math.floor(Number(objetivo)) : restantes))
    const motivoSel = motivos.find((m) => m.id === idMotivo) ?? null

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
                ns: resultado === 'PASA' && ns ? ns : undefined,
            },
        ])
        limpiarEditor(true) // conserva la marca (el técnico suele repetirla)
    }

    const quitarPieza = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))

    const guardar = async () => {
        if (!entrada || items.length === 0) {
            toast.error('Agrega al menos una pieza a tu avance.')
            return
        }
        if (items.some((p) => p.resultado === 'NO_PASA' && !p.id_motivo)) {
            toast.error('Toda pieza NO PASA necesita motivo.')
            return
        }
        setCargando(true)
        const res = await guardarAvanceRevision({ id_entrada: entrada.id, piezas: items })
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo guardar el avance.')
            return
        }
        toast.success('Avance de revisión guardado')
        setItems([])
        const ps = await cargarPartidas(entrada.id)
        const p = ps.find((x) => x.id === partidaSel)
        if (p) setAtributos(aTexto(p.atributos))
        onGuardado?.()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        Revisión — {entrada?.folio ?? ''}
                        {partidaActual ? ` · Partida ${partidaActual.partida}` : ''}
                    </DialogTitle>
                </DialogHeader>

                {partidas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Esta entrada no tiene partidas.</p>
                ) : (
                    <div className="space-y-4">
                        {/* Selección de partida */}
                        <div className="space-y-1.5">
                            <Label>Partida</Label>
                            <select
                                className="h-9 w-full rounded-md border bg-surface px-2 text-sm"
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
                                        className="h-9 w-full rounded-md border bg-surface px-2 text-sm"
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
                                                className="h-9 w-full rounded-md border bg-surface px-2 text-sm"
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

                            <div className="flex flex-wrap items-end gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Resultado</Label>
                                    <select
                                        className="h-9 rounded-md border bg-surface px-2 text-sm"
                                        value={resultado}
                                        onChange={(e) => setResultado(e.target.value as 'PASA' | 'NO_PASA')}
                                        disabled={cargando}
                                    >
                                        <option value="PASA">PASA</option>
                                        <option value="NO_PASA">NO PASA</option>
                                    </select>
                                </div>
                                {resultado === 'NO_PASA' ? (
                                    <>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Motivo</Label>
                                            <select
                                                className="h-9 rounded-md border bg-surface px-2 text-sm"
                                                value={idMotivo}
                                                onChange={(e) => setIdMotivo(e.target.value)}
                                                disabled={cargando}
                                            >
                                                <option value="">— elige motivo —</option>
                                                {motivos.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {motivoSel?.requiere_porcentaje ? (
                                            <div className="space-y-1">
                                                <Label className="text-xs">% salud</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    className="w-24"
                                                    value={porcentajeSalud}
                                                    onChange={(e) => setPorcentajeSalud(e.target.value)}
                                                    disabled={cargando}
                                                />
                                            </div>
                                        ) : null}
                                    </>
                                ) : (
                                    <div className="space-y-1">
                                        <Label className="text-xs">N/S (opcional)</Label>
                                        <Input
                                            className="w-48"
                                            placeholder="escanea el serial"
                                            value={ns}
                                            onChange={(e) => setNs(e.target.value)}
                                            disabled={cargando}
                                        />
                                    </div>
                                )}
                                <div className="ml-auto">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={agregarPieza}
                                        disabled={cargando || !marcaSel || restantes <= items.length}
                                    >
                                        <Plus className="mr-1 h-4 w-4" /> Agregar pieza
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                        Cerrar
                    </Button>
                    <Button
                        type="button"
                        onClick={guardar}
                        disabled={cargando || items.length === 0 || partidas.length === 0}
                    >
                        <Check className="mr-1 h-4 w-4" />
                        {cargando ? 'Guardando…' : `Guardar avance (${items.length} pieza${items.length === 1 ? '' : 's'})`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
