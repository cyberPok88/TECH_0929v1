'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS ENTRADA GRID — Renglones declarados de la entrada (Guía 1.6 · P2 · Dumb)
//
// ⭐ FIX 5 (05 Oct 2026 · dueño) — **LA FICHA DE 5 RENGLONES PASA A 2**.
// Medido en el mockup aprobado (`01-recepcion/01-modal-y-partida.html` y `03-nueva-entrada.html`):
// cada partida apilaba **5 bloques** (título + categoría + atributos + cantidad/costo + NS) y con
// más de 2 partidas la sección se volvía enorme —*«capacidad está muy ancho, formato igual está
// enorme»*—. Lo que cambia es la ORGANIZACIÓN, no los campos:
//
//   · **UN encabezado para todo el grid**: los rótulos se pintan **una vez** (antes, cada bloque
//     repetía su etiqueta).
//   · **LÍNEA 1 · el «qué»** — `#` + la categoría + los atributos, **inline y al ancho de su
//     contenido**: la capacidad y el formato dejan de ocupar un tercio de la pantalla cada uno.
//     La etiqueta viaja **pegada a su control** (Tipo · Capacidad · Formato), en 10px.
//   · **LÍNEA 2 · el «cuánto»** — cantidad · costo · subtotal · quitar, **alineados con el
//     encabezado** (comparten la plantilla de columnas).
//   · El **riel** de 3px (`--acc-entradas`) sigue marcando dónde empieza cada partida.
//
// ⚠️ Lo que NO se toca: el contrato de la partida (`id_categoria` · `atributos` ·
//    `cantidad_original` · `costo_acordado` · `lleva_ns`), los `data-accion` de QA, y las reglas
//    que ya estaban: los atributos `en_entrada` + los `derivado_de` (solo lectura, «auto») y los
//    `valor_default` (p. ej. HDD rpm 7200) que NO se preguntan.
// ═══════════════════════════════════════════════════════════════════════════════

import { Plus, Trash2 } from 'lucide-react'

import { Ayuda } from '@/components/ui/Ayuda'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CategoriaEntrada, PartidaEntradaForm } from '@/types/entradas'

function nuevaPartida(): PartidaEntradaForm {
    return {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id_categoria: '',
        atributos: {},
        cantidad_original: '1',
        costo_acordado: '',
        /**
         * ⭐ MEJORA 29 Sep 2026 — **NACE ENCENDIDA.** Antes nacía apagada y el concentrado de NS era
         * invisible: medido en la prueba del usuario, `ING-0023`, `ING-0024` e `ING-0025` entraron con
         * `lleva_ns = false` y el modal **nunca** se abrió — *«el problema persiste»*. La bandera no
         * puede depender de que alguien se acuerde de un interruptor: la mercancía de este ERP trae
         * serial casi siempre (discos, RAM, equipos), así que el default correcto es que SÍ.
         *
         * ⚠️ FIX 3 (05 Oct 2026) — el **control** ya no se muestra; el **dato** sigue viajando, y las
         * dos partes pueden corregirlo en su propio momento (la puerta lo apaga desde el wizard).
         */
        lleva_ns: true,
    }
}

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

/**
 * Las clases de un chip de opción.
 * ⚠️ FIX 2 (05 Oct 2026) — **densidad de ESCRITORIO** (36px), no la del puesto de dedo (44px):
 * Recepción se opera con ratón. Es una desviación declarada de `spec_componentes.md §1.1`.
 */
function claseChip(activo: boolean, disabled: boolean): string {
    return cn(
        'inline-flex h-9 items-center rounded-md border px-2.5 text-[13px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        activo
            ? 'border-primary bg-primary-bg font-semibold text-primary'
            : 'border-border bg-surface-raised text-foreground hover:bg-hover-background',
        disabled && 'cursor-not-allowed opacity-60'
    )
}

/**
 * ⭐ DECISIÓN DE DISEÑO 24 Sep 2026 (usuario) — **CHIPS SOLO SI SON POCAS**.
 * *«Las píldoras en los que son fáciles de decidir —categoría, tipo—; pero capacidad sí como la
 * opción B, ya que puede haber hasta 20 opciones: son muchas burbujas.»*
 */
const MAX_CHIPS = 4
const usaChips = (opciones: string[]) => opciones.length <= MAX_CHIPS

/** El control de lista, con ancho **de contenido** (fix 5: la capacidad ya no ocupa un tercio). */
const CLASE_SELECT = 'h-9 rounded-md border border-border bg-surface-raised px-2 text-[13.5px]'

/**
 * ⭐ FIX 5 — **las columnas de los NÚMEROS las comparten el encabezado y la línea 2** (así los
 * valores quedan justo debajo de su rótulo). La línea 1 NO las comparte a propósito: usa el ancho
 * completo, que es lo que permite que la partida más ancha del catálogo (RAM, con 3 grupos de
 * chips) entre en **un solo renglón**.
 */
const COLS_NUM =
    'grid grid-cols-[24px_minmax(0,1fr)_150px_150px_96px_30px] items-center gap-x-2 border-l-[3px] border-l-transparent px-3'

const CLASE_TH =
    'font-mono text-[9.5px] font-semibold uppercase tracking-[0.11em] text-foreground/70'

/** La etiqueta de un atributo, **pegada a su control** y en chico (antes ocupaba su propio renglón). */
function EtiquetaInline({ children, requerido }: { children: React.ReactNode; requerido?: boolean }) {
    return (
        <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
            {children}
            {requerido ? <span className="text-destructive"> *</span> : ''}
        </span>
    )
}

interface PartidasEntradaGridProps {
    partidas: PartidaEntradaForm[]
    /**
     * ⭐ FIX 5 — el catálogo que llega ya viene **filtrado por el flujo** (4 o 18) y trae la
     * **Familia** (`id_categoria_padre`) para agrupar el `<select>`: por eso es `CategoriaEntrada`
     * y no `CategoriaCapturable`.
     */
    categorias: CategoriaEntrada[]
    onChange: (partidas: PartidaEntradaForm[]) => void
    disabled?: boolean
    /**
     * ⭐ 05 Oct 2026 — los errores de validación del modal, por `indice.campo` (p. ej. `0.id_categoria`).
     * El mensaje va **bajo el campo que lo causó** (SPEC §2.2/§2.9) — nunca en un toast ni en una línea
     * suelta al pie. Las claves las arma `EntradaModal` validando con el MISMO schema que la Server Action.
     */
    errores?: Record<string, string>
}

export function PartidasEntradaGrid({
    partidas,
    categorias,
    onChange,
    disabled = false,
    errores = {},
}: PartidasEntradaGridProps) {
    const categoriaDe = (id: string) => categorias.find((c) => c.id === id) ?? null
    // ⭐ Campos que la RECEPCIÓN muestra: los `en_entrada` + los `derivado_de`
    // (read-only). Se excluye lo automático (`valor_default`, ej. rpm=7200).
    const enEntradaDe = (id: string) =>
        categoriaDe(id)?.esquema.filter((a) => (a.en_entrada || a.derivado_de) && !a.valor_default) ?? []

    // ⭐ Resuelve los atributos `derivado_de` a partir de otro campo (HDD: tipo → formato).
    // ⭐ 06 Oct 2026 — acepta CONJUNTOS: un `multi` vale un `string[]` (sin ordenar).
    const aplicarDerivados = (
        id: string,
        atributos: Record<string, string | string[]>
    ): Record<string, string | string[]> => {
        const next = { ...atributos }
        for (const at of categoriaDe(id)?.esquema ?? []) {
            if (at.derivado_de) {
                const bruto = next[at.derivado_de.clave] ?? ''
                // La base de una derivación es SIEMPRE un `select` de un solo valor (el editor
                // solo ofrece esos como fuente): un conjunto no tiene mapa que aplicar.
                const base = typeof bruto === 'string' ? bruto : ''
                next[at.clave] = at.derivado_de.mapa[base] ?? ''
            }
        }
        return next
    }

    const actualizar = (i: number, patch: Partial<PartidaEntradaForm>) =>
        onChange(partidas.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
    const quitar = (i: number) => onChange(partidas.filter((_, idx) => idx !== i))
    const agregar = () => onChange([...partidas, nuevaPartida()])

    /** ⭐ El paso de cantidad: el gesto más repetido. */
    const paso = (i: number, delta: number) => {
        const actual = Number(partidas[i]?.cantidad_original) || 1
        actualizar(i, { cantidad_original: String(Math.max(1, actual + delta)) })
    }

    const cambiarCategoria = (i: number, id: string) =>
        actualizar(i, { id_categoria: id, atributos: aplicarDerivados(id, {}) })

    // ⭐ 06 Oct 2026 — `valor` acepta un ARRAY: un atributo `multi` vale un CONJUNTO.
    const cambiarAtributo = (i: number, clave: string, valor: string | string[]) =>
        onChange(
            partidas.map((p, idx) =>
                idx === i
                    ? {
                          ...p,
                          atributos: aplicarDerivados(p.id_categoria, { ...p.atributos, [clave]: valor }),
                      }
                    : p
            )
        )

    /** El catálogo del flujo nueva viene **agrupado por Familia** (optgroup). */
    const familias = categorias
        .filter((c) => c.id_categoria_padre === null)
        .map((f) => ({ familia: f, hijos: categorias.filter((c) => c.id_categoria_padre === f.id) }))
    const sueltas = categorias.filter(
        (c) => c.id_categoria_padre === null && !categorias.some((h) => h.id_categoria_padre === c.id)
    )

    return (
        <div className="space-y-3">
            <div className="overflow-x-auto rounded-md border border-border bg-surface">
                <div className="min-w-[720px]">
                    {/* ── EL ENCABEZADO ÚNICO: los rótulos se pintan UNA vez ─────────────── */}
                    <div className={cn(COLS_NUM, 'border-b-2 border-border bg-th py-2')}>
                        <span className={CLASE_TH}>#</span>
                        <span className={CLASE_TH}>Categoría y atributos</span>
                        <span className={CLASE_TH}>Cantidad</span>
                        <span className={CLASE_TH}>Costo acordado por pieza</span>
                        <span className={CLASE_TH}>Subtotal</span>
                        <span />
                    </div>

                    {partidas.map((p, i) => {
                        const esquema = enEntradaDe(p.id_categoria)
                        const cat = categoriaDe(p.id_categoria)
                        const cantidad = Number(p.cantidad_original) || 1
                        const errCat = errores[`${i}.id_categoria`]
                        const errCant = errores[`${i}.cantidad_original`]
                        const errCosto = errores[`${i}.costo_acordado`]
                        const hayError = Boolean(errCat || errCant || errCosto)

                        return (
                            <div key={p.id} className="border-b border-border bg-surface last:border-b-0">
                                {/* ── LÍNEA 1 · el «qué» (ancho completo: no comparte columnas) ── */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-l-[3px] border-l-acc-entradas px-3 pt-2.5">
                                    <span className="w-6 shrink-0 font-mono text-[12px] font-semibold tabular-nums text-muted-foreground">
                                        {i + 1}
                                    </span>

                                    {/* La categoría: del catálogo, nunca texto libre. */}
                                    {categorias.length === 0 ? (
                                        <span className="h-9 w-[200px] animate-pulse rounded-md bg-surface-2" />
                                    ) : usaChips(categorias.map((c) => c.nombre)) ? (
                                        <span className="inline-flex flex-wrap items-center gap-1.5">
                                            {categorias.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => cambiarCategoria(i, c.id)}
                                                    disabled={disabled}
                                                    className={claseChip(p.id_categoria === c.id, disabled)}
                                                    data-accion={`categoria-${c.nombre.toLowerCase()}`}
                                                >
                                                    {c.nombre}
                                                </button>
                                            ))}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5">
                                            <EtiquetaInline requerido>Categoría</EtiquetaInline>
                                            <select
                                                className={cn(CLASE_SELECT, 'max-w-[230px]')}
                                                value={p.id_categoria}
                                                onChange={(e) => cambiarCategoria(i, e.target.value)}
                                                disabled={disabled}
                                                aria-label={`Categoría de la partida ${i + 1}`}
                                            >
                                                <option value="">— elige categoría —</option>
                                                {familias.map(({ familia, hijos }) =>
                                                    hijos.length > 0 ? (
                                                        <optgroup key={familia.id} label={familia.nombre}>
                                                            {/* la Familia también es opción: «sin detallar» */}
                                                            <option value={familia.id}>
                                                                {familia.nombre} — sin detallar
                                                            </option>
                                                            {hijos.map((h) => (
                                                                <option key={h.id} value={h.id}>
                                                                    {h.nombre}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    ) : null
                                                )}
                                                {sueltas.length > 0 && (
                                                    <optgroup label="Sin familia">
                                                        {sueltas.map((c) => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.nombre}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </span>
                                    )}

                                    {/* Los atributos `en_entrada` + el derivado (solo lectura), INLINE y al
                                        ancho de su contenido. */}
                                    {esquema.map((at) => (
                                        <span key={at.clave} className="inline-flex items-center gap-1.5">
                                            <EtiquetaInline requerido={at.requerido}>
                                                {at.etiqueta}
                                            </EtiquetaInline>
                                            {at.derivado_de ? (
                                                <span className="inline-flex h-9 min-w-[92px] items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-2 text-[13.5px] text-muted-foreground">
                                                    <span>{p.atributos[at.clave] || '—'}</span>
                                                    <span className="font-mono text-[9.5px] uppercase tracking-wide">
                                                        auto
                                                    </span>
                                                </span>
                                            ) : at.tipo === 'multi' && at.opciones ? (
                                                /* ⭐ 06 Oct 2026 — el CONJUNTO: los MISMOS chips, pero
                                                   se encienden y se apagan (en `select` solo uno).
                                                   El array viaja **sin ordenar**: lo canoniza la BD. */
                                                <span className="inline-flex flex-wrap items-center gap-1.5">
                                                    {at.opciones.map((op) => {
                                                        const lista = Array.isArray(p.atributos[at.clave])
                                                            ? (p.atributos[at.clave] as string[])
                                                            : []
                                                        const sel = lista.includes(op)
                                                        return (
                                                            <button
                                                                key={op}
                                                                type="button"
                                                                disabled={disabled}
                                                                aria-pressed={sel}
                                                                onClick={() =>
                                                                    cambiarAtributo(
                                                                        i,
                                                                        at.clave,
                                                                        sel
                                                                            ? lista.filter((x) => x !== op)
                                                                            : [...lista, op]
                                                                    )
                                                                }
                                                                className={claseChip(sel, disabled)}
                                                            >
                                                                {op}
                                                            </button>
                                                        )
                                                    })}
                                                </span>
                                            ) : at.tipo === 'select' && at.opciones ? (
                                                usaChips(at.opciones) ? (
                                                    <span className="inline-flex flex-wrap items-center gap-1.5">
                                                        {at.opciones.map((op) => (
                                                            <button
                                                                key={op}
                                                                type="button"
                                                                onClick={() => cambiarAtributo(i, at.clave, op)}
                                                                disabled={disabled}
                                                                className={claseChip(
                                                                    p.atributos[at.clave] === op,
                                                                    disabled
                                                                )}
                                                            >
                                                                {op}
                                                            </button>
                                                        ))}
                                                    </span>
                                                ) : (
                                                    /* Muchas opciones (p. ej. capacidad): lista y **ancho de
                                                       contenido** — el fix 5 nace de acá. */
                                                    <select
                                                        className={cn(CLASE_SELECT, 'min-w-[86px]')}
                                                        value={p.atributos[at.clave] ?? ''}
                                                        onChange={(e) =>
                                                            cambiarAtributo(i, at.clave, e.target.value)
                                                        }
                                                        disabled={disabled}
                                                        aria-label={`${at.etiqueta} de la partida ${i + 1}`}
                                                    >
                                                        <option value="">—</option>
                                                        {at.opciones.map((op) => (
                                                            <option key={op} value={op}>
                                                                {op}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )
                                            ) : (
                                                <Input
                                                    type={at.tipo === 'number' ? 'number' : 'text'}
                                                    value={p.atributos[at.clave] ?? ''}
                                                    onChange={(e) => cambiarAtributo(i, at.clave, e.target.value)}
                                                    disabled={disabled}
                                                    className="h-9 w-[110px] text-[13.5px]"
                                                    aria-label={`${at.etiqueta} de la partida ${i + 1}`}
                                                />
                                            )}
                                        </span>
                                    ))}

                                    {/* Una categoría **sin atributos de entrada** (una Familia, o un Tipo
                                        que no los declara) NO dibuja un bloque vacío. */}
                                    {p.id_categoria !== '' && esquema.length === 0 && (
                                        <Ayuda
                                            k="recepcion.sin-atributos"
                                            className="text-[11.5px] text-muted-foreground"
                                        />
                                    )}
                                </div>

                                {/* ── LÍNEA 2 · el «cuánto» (alineado con el encabezado) ────────── */}
                                <div className={cn(COLS_NUM, 'pb-2.5')}>
                                    <span />
                                    {/* El hueco de la izquierda lo usa el error de la categoría. */}
                                    <span className="text-[11.5px] text-destructive">{errCat}</span>
                                    <span className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => paso(i, -1)}
                                            disabled={disabled || cantidad <= 1}
                                            aria-label="Quitar una pieza"
                                            className="grid size-9 place-items-center rounded-md border border-border bg-surface-raised text-[18px] font-bold leading-none text-foreground transition-colors hover:bg-hover-background disabled:opacity-50"
                                        >
                                            −
                                        </button>
                                        <input
                                            type="number"
                                            min={1}
                                            inputMode="numeric"
                                            value={p.cantidad_original}
                                            onChange={(e) =>
                                                actualizar(i, { cantidad_original: e.target.value })
                                            }
                                            onFocus={(e) => e.currentTarget.select()}
                                            disabled={disabled}
                                            aria-label={`Cantidad de la partida ${i + 1}`}
                                            className="h-9 w-[64px] rounded-md border border-border bg-surface-raised text-center text-[15px] font-semibold tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => paso(i, 1)}
                                            disabled={disabled}
                                            aria-label="Agregar una pieza"
                                            className="grid size-9 place-items-center rounded-md border border-border bg-surface-raised text-[18px] font-bold leading-none text-foreground transition-colors hover:bg-hover-background disabled:opacity-50"
                                        >
                                            +
                                        </button>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="text-[15px] font-semibold text-muted-foreground">
                                            $
                                        </span>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.0001"
                                            placeholder="0.00"
                                            value={p.costo_acordado}
                                            onChange={(e) =>
                                                actualizar(i, { costo_acordado: e.target.value })
                                            }
                                            disabled={disabled}
                                            aria-label={`Costo acordado de la partida ${i + 1}`}
                                            className="h-9 w-[116px] text-[15px] font-semibold tabular-nums"
                                        />
                                    </span>
                                    <span className="text-[14px] font-semibold tabular-nums">
                                        {cat ? formatearMXN(cantidad * (Number(p.costo_acordado) || 0)) : '—'}
                                    </span>
                                    <span className="flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => quitar(i)}
                                            disabled={disabled || partidas.length === 1}
                                            aria-label="Quitar partida"
                                            data-accion="quitar-partida"
                                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </span>
                                </div>

                                {/* Los errores de cantidad/costo, bajo su campo (solo si los hay). */}
                                {hayError && (
                                    <div className={cn(COLS_NUM, 'pb-2.5')}>
                                        <span />
                                        <span />
                                        <span className="text-[11.5px] text-destructive">{errCant}</span>
                                        <span className="text-[11.5px] text-destructive">{errCosto}</span>
                                        <span />
                                        <span />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={agregar}
                    disabled={disabled}
                    data-accion="agregar-partida"
                    className="gap-1.5 px-3.5 text-[14px]"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Agregar partida
                </Button>
                {/* ⭐ La ayuda de la cantidad va UNA vez (antes se repetía en cada partida). */}
                <Ayuda k="recepcion.cantidad-editable" className="text-[11.5px] text-muted-foreground" />
            </div>
        </div>
    )
}
