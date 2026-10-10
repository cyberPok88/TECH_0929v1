'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRADA MODAL — Alta/Edición de entrada (Guía 1.6 · P2 · Smart)
//
// ⭐ 05 Oct 2026 — REDISEÑO APROBADO (mockups `DOCS/design/entradas/01-recepcion/01·02·03`)
//    + los 4 FIXES del dueño del mismo día.
//
//   · **EL FLUJO ES EL PRIMER PASO** (fix 1): mientras no se elija, no se pasa. Elegido, la zona
//     se oculta y aparece el formulario; el flujo elegido queda como una **línea compacta** con
//     «Cambiar» (el patrón de «elegir partida» de Revisión). En **edición** el flujo está FIJADO
//     (cambiarlo cambiaría qué categorías existen y podría invalidar partidas).
//   · **El flujo decide el catálogo de la partida**: «NO nueva» ofrece **sus 4** —HDD · RAM · SSD ·
//     M.2— y por eso **la categoría son chips**; «nueva» ofrece **las 18** agrupadas por Familia.
//   · **DENSIDAD DE ESCRITORIO** (fix 2): Recepción **no es un puesto de dedo** ⇒ los controles
//     usan la escala del kit (36/40) en vez de los 44/52/56 del puesto táctil. ⚠️ Es una
//     **desviación declarada** de `spec_componentes.md §1.1` que se corrige al sincronizar.
//   · **EL CHIP DE NS NO SE MUESTRA** (fix 3): la mercancía de este ERP **trae serie por defecto**
//     (`lleva_ns` nace `true`, MEJORA 29 Sep) ⇒ el control sobra por ahora. El dato sigue viajando
//     (y en edición se conserva el que trajo la BD); lo que se retiró es el control y sus 3 textos.
//   · **Z4 · el pie es FIJO**: partidas · piezas · total y las acciones no se van con el scroll.
//   · Las frases que explican se consumen del registro (`config/ayudas/recepcion.ts`) ⇒ el usuario
//     las prende y apaga desde el Topbar.
//   · La validación llega **bajo el campo** que la causó (mismo schema que la Server Action).
//
// ⚠️ El contrato NO cambió: se captura `id_proveedor` · `es_sin_revision` (← el flujo) · `origen` ·
//    `notas` y, por partida, `id_categoria` · `atributos` · `cantidad_original` · `costo_acordado` ·
//    `lleva_ns`. El folio ING, la fecha y el estado los fija la BD.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Label } from '@/components/ui/label'
import { Ayuda } from '@/components/ui/Ayuda'

import { SelectorProveedor } from '@/components/form'
import { PartidasEntradaGrid } from '@/components/entradas/PartidasEntradaGrid'
import {
    crearEntrada,
    editarEntrada,
    listarCategoriasParaEntrada,
    listarPartidasEntrada,
} from '@/lib/actions/entradas'
import { entradaSchema } from '@/lib/validations/entradas'
import { cn } from '@/lib/utils'
import type { CategoriaEntrada, Entrada, EntradaFormData } from '@/types/entradas'

function formVacio(): EntradaFormData {
    return {
        id_proveedor: '',
        es_sin_revision: false,
        origen: 'flujo',
        notas: '',
        partidas: [
            {
                id: `p-${Date.now()}`,
                id_categoria: '',
                atributos: {},
                cantidad_original: '1',
                costo_acordado: '',
                // ⭐ MEJORA 29 Sep 2026 — nace ENCENDIDA: la mercancía de este ERP trae serial casi
                // siempre, y la bandera apagada hacía invisible el concentrado de NS (medido).
                // ⭐ 05 Oct 2026 (fix 3) — el CONTROL no se muestra, pero el dato sigue viajando.
                lleva_ns: true,
            },
        ],
    }
}

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

interface EntradaModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    modo: 'crear' | 'editar'
    entrada?: Entrada | null
    onGuardado?: () => void
}

export function EntradaModal({ open, onOpenChange, modo, entrada = null, onGuardado }: EntradaModalProps) {
    const [form, setForm] = useState<EntradaFormData>(formVacio)
    /**
     * ⭐ FIX 1 — **el flujo es un PASO, no un control del formulario**: `'flujo'` = todavía no se
     * eligió (no se pasa); `'formulario'` = ya se eligió y la zona se ocultó.
     */
    const [paso, setPaso] = useState<'flujo' | 'formulario'>('flujo')
    /**
     * Las **18 categorías activas** (con Familia · esquema efectivo · los dos flags).
     * ⚠️ `null` = **todavía no llegó** ⇒ es el estado «cargando» (no un booleano que se enciende en
     * el efecto: eso lo marca el linter `react-hooks/set-state-in-effect`).
     */
    const [categorias, setCategorias] = useState<CategoriaEntrada[] | null>(null)
    const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null)
    const [reintento, setReintento] = useState(0)
    const [errores, setErrores] = useState<Record<string, string>>({})
    const [cargando, setCargando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    const enEdicion = modo === 'editar' && entrada !== null

    // Reset al abrir (instancia siempre montada — setState fuera del ciclo síncrono).
    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => {
            if (modo === 'editar' && entrada) {
                setForm({
                    id_proveedor: entrada.id_proveedor,
                    es_sin_revision: entrada.es_sin_revision,
                    origen: entrada.origen,
                    notas: entrada.notas ?? '',
                    partidas: [],
                })
                void listarPartidasEntrada(entrada.id).then((res) => {
                    if (!res.success) return
                    const partidas = (res.data ?? []).map((p) => ({
                        id: p.id,
                        id_categoria: p.id_categoria ?? '',
                        atributos: Object.fromEntries(
                            Object.entries(p.atributos ?? {}).map(([k, v]) => [k, String(v ?? '')])
                        ),
                        cantidad_original: String(p.cantidad_original),
                        costo_acordado: String(p.costo_acordado),
                        // ⭐ MEJORA 28 Sep 2026 — la bandera de D1 viaja de ida y de vuelta: si no se
                        // releyera aquí, editar una entrada recién creada la apagaría en silencio.
                        lleva_ns: p.lleva_ns ?? false,
                    }))
                    setForm((prev) => ({ ...prev, partidas: partidas.length ? partidas : prev.partidas }))
                })
            } else {
                setForm(formVacio())
            }
            // ⭐ FIX 1 — editar NO elige flujo (ya viene fijado): arranca en el formulario.
            setPaso(modo === 'editar' && entrada ? 'formulario' : 'flujo')
            setErrores({})
            setErrorServidor(null)
        }, 0)
        return () => clearTimeout(timer)
    }, [open, modo, entrada])

    // ⭐ UNA sola lectura del catálogo CERRADO (18 filas): conmutar el flujo no cuesta un viaje.
    useEffect(() => {
        if (!open) return
        let activo = true
        void listarCategoriasParaEntrada().then((res) => {
            if (!activo) return
            if (!res.success) {
                setErrorCatalogo(res.error ?? 'No se pudo leer el catálogo de categorías.')
                return
            }
            setCategorias(res.data ?? [])
            setErrorCatalogo(null)
        })
        return () => {
            activo = false
        }
    }, [open, reintento])

    const esNueva = form.es_sin_revision

    /**
     * ⭐ **EL FILTRO DE FLUJO**: la partida solo ofrece lo que su flujo admite.
     * · NO nueva → las 4 con `requiere_revision_pieza` (el flag, **nunca el nombre**);
     * · nueva → las 18 activas.
     */
    const categoriasDelFlujo = useMemo<CategoriaEntrada[]>(() => {
        if (!categorias) return []
        return esNueva ? categorias : categorias.filter((c) => c.requiere_revision_pieza)
    }, [categorias, esNueva])

    /**
     * 🔴 **Estado H — la vuelta que rompe:** volver a «NO nueva» con una partida capturada en el
     * flujo nueva (p. ej. Impresoras) **deja esa partida fuera**. **Jamás se borra en silencio**:
     * se dice cuál y por qué, y **Registrar queda bloqueado** con el motivo a la vista.
     * ⚠️ El sentido contrario (NO nueva → nueva) **nunca invalida nada**: las 18 incluyen a las 4.
     */
    const partidasFueraDeFlujo = useMemo(() => {
        if (esNueva || !categorias) return []
        const validas = new Set(categoriasDelFlujo.map((c) => c.id))
        return form.partidas
            .map((p, i) => ({ p, n: i + 1 }))
            .filter(({ p }) => p.id_categoria !== '' && !validas.has(p.id_categoria))
    }, [esNueva, categorias, categoriasDelFlujo, form.partidas])

    const nombreCategoria = (id: string) => categorias?.find((c) => c.id === id)?.nombre ?? '—'

    const totalPiezas = form.partidas.reduce((s, p) => s + (Number(p.cantidad_original) || 0), 0)
    const totalCosto = form.partidas.reduce(
        (s, p) => s + (Number(p.cantidad_original) || 0) * (Number(p.costo_acordado) || 0),
        0
    )

    const actualizar = <K extends keyof EntradaFormData>(campo: K, valor: EntradaFormData[K]) =>
        setForm((prev) => ({ ...prev, [campo]: valor }))

    /** Elegir flujo: **es lo que abre el formulario** (fix 1). */
    const elegirFlujo = (nueva: boolean) => {
        /**
         * ⭐ MEJORA 52 (07 Oct 2026, decisión del dueño) — **el `lleva_ns` SIGUE AL FLUJO**:
         * el flujo NO nuevo revisa pieza por pieza y ahí se toma el NS ⇒ **encendido**; el flujo
         * nuevo (Camino B) **no tiene revisión** ⇒ **apagado**, porque nadie capturaría el serial.
         * Se aplica también a las partidas YA capturadas: volver atrás no deja banderas viejas.
         */
        setForm((prev) => ({
            ...prev,
            es_sin_revision: nueva,
            partidas: prev.partidas.map((p) => ({ ...p, lleva_ns: !nueva })),
        }))
        setErrores({})
        setPaso('formulario')
    }

    const manejarEnvio = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setErrorServidor(null)

        // ⭐ La validación se muestra BAJO el campo que la causó (mismo schema que la SA).
        const parsed = entradaSchema.safeParse(form)
        if (!parsed.success) {
            const campos: Record<string, string> = {}
            for (const issue of parsed.error.issues) {
                const [raiz, indice, hoja] = issue.path as [string, number | undefined, string?]
                if (raiz === 'id_proveedor') campos.id_proveedor ??= issue.message
                else if (raiz === 'partidas' && typeof indice === 'number') {
                    campos[`${indice}.${hoja ?? 'partidas'}`] ??= issue.message
                } else if (raiz === 'partidas') campos.partidas ??= issue.message
                else if (raiz === 'notas') campos.notas ??= issue.message
            }
            setErrores(campos)
            return
        }
        setErrores({})

        if (partidasFueraDeFlujo.length > 0) return

        setCargando(true)
        if (modo === 'editar' && entrada) {
            const res = await editarEntrada(entrada.id, form)
            setCargando(false)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo guardar la entrada.')
                return
            }
            toast.success(`Entrada ${entrada.folio} actualizada`)
        } else {
            const res = await crearEntrada(form)
            setCargando(false)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo registrar la entrada.')
                return
            }
            toast.success(`Entrada ${res.data?.folio ?? ''} registrada`)
        }

        onGuardado?.()
        onOpenChange(false)
    }

    /** Las 2 opciones del paso 1 (el flujo). Densidad de escritorio: no son botones de dedo. */
    const tarjetaFlujo = (nueva: boolean, titulo: string, ayuda: string) => (
        <button
            type="button"
            onClick={() => elegirFlujo(nueva)}
            aria-pressed={esNueva === nueva}
            data-accion={nueva ? 'flujo-nueva' : 'flujo-no-nueva'}
            className={cn(
                'flex w-full flex-col items-start gap-1 rounded-md border px-3.5 py-3 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                esNueva === nueva
                    ? 'border-primary bg-primary-bg'
                    : 'border-border bg-surface-raised hover:bg-hover-background'
            )}
        >
            <span className={cn('text-[15px]', esNueva === nueva && 'font-semibold text-primary')}>
                {titulo}
            </span>
            <Ayuda k={ayuda} className="text-[12.5px] text-muted-foreground" />
        </button>
    )

    const etiquetaFlujo = esNueva ? 'Mercancía nueva · salta la revisión' : 'Mercancía NO nueva · con revisión técnica'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* ⭐ 5xl + columna con el CUERPO scrolleable y el pie FUERA del scroll (Z4 fijo). */}
            <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-5xl">
                <DialogHeader className="space-y-2">
                    <div className="flex flex-row items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => (paso === 'flujo' || enEdicion ? onOpenChange(false) : setPaso('flujo'))}
                            disabled={cargando}
                            className="gap-1.5 px-3 text-[14px]"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Atrás
                        </Button>
                        <DialogTitle>
                            {modo === 'editar' ? `Editar ${entrada?.folio ?? 'entrada'}` : 'Nueva entrada'}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <form onSubmit={manejarEnvio} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                        {/* ── PASO 1 · EL FLUJO (mientras no se elija, no se pasa) ──────────── */}
                        {paso === 'flujo' ? (
                            <div className="space-y-3 py-1">
                                <div className="space-y-1">
                                    <h3 className="text-[16px] font-semibold">¿Qué mercancía entra?</h3>
                                    <p className="text-[13px] text-muted-foreground">
                                        El flujo decide qué categorías vas a poder capturar y qué pasa
                                        después con la mercancía.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {tarjetaFlujo(
                                        false,
                                        'Mercancía NO nueva · con revisión técnica',
                                        'recepcion.flujo-no-nueva'
                                    )}
                                    {tarjetaFlujo(
                                        true,
                                        'Mercancía nueva · salta la revisión',
                                        'recepcion.flujo-nueva'
                                    )}
                                </div>
                                <Ayuda
                                    k="recepcion.sin-revision"
                                    className="text-[12.5px] text-muted-foreground"
                                />
                            </div>
                        ) : (
                            <>
                                {/* ── EL FLUJO YA ELEGIDO: una línea, con «Cambiar» ─────────── */}
                                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
                                    <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                        Flujo
                                    </span>
                                    <span className="text-[13.5px] font-medium">{etiquetaFlujo}</span>
                                    {enEdicion ? (
                                        <span className="text-[12.5px] text-muted-foreground">
                                            · no se cambia al editar: cambiarlo cambiaría qué categorías
                                            existen y podría invalidar las partidas capturadas.
                                        </span>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setPaso('flujo')}
                                            className="ml-auto text-[13px]"
                                        >
                                            Cambiar
                                        </Button>
                                    )}
                                </div>

                                {/* ── Z2 · LA CABECERA ─────────────────────────────────────── */}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.5fr_1fr]">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="proveedor">Proveedor *</Label>
                                        <SelectorProveedor
                                            value={form.id_proveedor}
                                            onChange={(id) => actualizar('id_proveedor', id ?? '')}
                                        />
                                        {errores.id_proveedor && (
                                            <p className="text-[12.5px] text-destructive">
                                                {errores.id_proveedor}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="notas"
                                            className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground"
                                        >
                                            Notas
                                        </Label>
                                        <Input
                                            id="notas"
                                            placeholder="Opcional"
                                            value={form.notas}
                                            onChange={(e) => actualizar('notas', e.target.value)}
                                            disabled={cargando}
                                        />
                                    </div>
                                </div>

                                {/* ── Z3 · LAS PARTIDAS ────────────────────────────────────── */}
                                <div className="space-y-2">
                                    <Label className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                        Partidas
                                    </Label>
                                    <Ayuda
                                        k="recepcion.partidas-que-captura"
                                        className="text-[12.5px] text-muted-foreground"
                                    />

                                    {/* El catálogo es una lectura: mientras no llega, un Spinner CON
                                        etiqueta (nunca un vacío ambiguo: «cargando» ≠ «no hay»). */}
                                    {categorias === null && !errorCatalogo && (
                                        <Spinner
                                            etiqueta="Leyendo el catálogo de categorías…"
                                            className="py-4"
                                        />
                                    )}

                                    {errorCatalogo && (
                                        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/45 bg-destructive/10 px-3 py-2.5">
                                            <AlertCircle
                                                className="h-4 w-4 text-destructive"
                                                aria-hidden="true"
                                            />
                                            <span className="text-sm text-destructive">{errorCatalogo}</span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setReintento((n) => n + 1)}
                                                className="gap-1.5 text-[13px]"
                                            >
                                                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                                Reintentar
                                            </Button>
                                        </div>
                                    )}

                                    {/* 🔴 Estado H — la partida que el flujo elegido NO admite. ⚠️ Este
                                        texto NO es una ayuda: es la BANDERA del bloqueo (ocultarlo
                                        dejaría el botón mudo). */}
                                    {partidasFueraDeFlujo.length > 0 && (
                                        <div
                                            role="alert"
                                            className="flex flex-col gap-1.5 rounded-md border border-destructive/45 bg-destructive/10 px-3 py-2.5"
                                        >
                                            <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-destructive">
                                                {partidasFueraDeFlujo.length === 1
                                                    ? '1 partida no entra en este flujo'
                                                    : `${partidasFueraDeFlujo.length} partidas no entran en este flujo`}
                                            </span>
                                            <ul className="flex flex-col gap-1 text-[12.5px] text-destructive">
                                                {partidasFueraDeFlujo.map(({ p, n }) => (
                                                    <li key={p.id}>
                                                        Partida #{n} ·{' '}
                                                        <b>{nombreCategoria(p.id_categoria)}</b> — no entra en
                                                        «NO nueva»: solo HDD · RAM · SSD · M.2. Cambiá el flujo o
                                                        quitá la partida.
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {errores.partidas && (
                                        <p className="text-[12.5px] text-destructive">{errores.partidas}</p>
                                    )}

                                    {categorias !== null && (
                                        <PartidasEntradaGrid
                                            partidas={form.partidas}
                                            categorias={categoriasDelFlujo}
                                            onChange={(partidas) => actualizar('partidas', partidas)}
                                            disabled={cargando}
                                            errores={errores}
                                            llevaNsPorDefecto={!esNueva}
                                        />
                                    )}
                                </div>

                                {errorServidor && <p className="text-sm text-destructive">{errorServidor}</p>}
                            </>
                        )}
                    </div>

                    {/* ── Z4 · EL PIE FIJO (no se va con el scroll) ───────────────────────── */}
                    <DialogFooter className="mt-4 gap-2 border-t border-border pt-4 sm:items-center">
                        {paso === 'formulario' && (
                            <div className="mr-auto flex items-center gap-4 text-[13px] tabular-nums text-muted-foreground">
                                <span>
                                    Partidas: <b className="text-foreground">{form.partidas.length}</b>
                                </span>
                                <span>
                                    Piezas: <b className="text-foreground">{totalPiezas}</b>
                                </span>
                                <span>
                                    Total: <b className="text-foreground">{formatearMXN(totalCosto)}</b>
                                </span>
                            </div>
                        )}
                        <Ayuda
                            k="recepcion.total-fijo"
                            className={cn(
                                'hidden text-[12.5px] text-muted-foreground lg:block',
                                paso === 'flujo' && 'lg:hidden'
                            )}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={cargando}
                            className="px-4 text-[14px]"
                        >
                            Cancelar
                        </Button>
                        {/* La acción dominante: la que cierra (ley L12). */}
                        <Button
                            type="submit"
                            size="lg"
                            disabled={cargando || paso === 'flujo' || partidasFueraDeFlujo.length > 0}
                            title={
                                paso === 'flujo'
                                    ? 'Elige primero el flujo de la entrada.'
                                    : partidasFueraDeFlujo.length > 0
                                      ? `Hay ${partidasFueraDeFlujo.length} partida(s) que este flujo no admite.`
                                      : undefined
                            }
                            className="flex-1 px-6 text-[15px] font-semibold sm:flex-none"
                        >
                            {cargando && <Spinner className="mr-2 text-primary-foreground" />}
                            {cargando ? 'Registrando…' : 'Registrar entrada'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
