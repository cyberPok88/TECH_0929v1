'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS ENTRADA GRID — Renglones declarados de la entrada (Guía 1.6 · P2 · Dumb)
// ⭐ Evolución V5 (20 Sep): la RECEPCIÓN es SOFT. Cada línea captura SOLO los
// atributos `en_entrada` del esquema (categoría · capacidad · PC/LAP · DDR) +
// cantidad + costo + vista previa. La MARCA y los atributos de identidad se
// capturan en REVISIÓN; el SKU lo resuelve ALMACÉN. RPM no se pregunta (auto 7200).
// ⭐ 20 Sep (MEJORA formato): los atributos `derivado_de` se resuelven SOLOS desde
// otro campo (HDD: tipo PC → 3.5" · LAP → 2.5") y se muestran read-only.
//
// ⭐ MEJORA 24 Sep 2026 (usuario · opción A del mockup §7) — EL FORMULARIO DEL PUESTO.
// El usuario reportó que el alta de entrada «está horrenda»: cada campo era un control de
// **36px** con etiqueta de **11–12.5px**, y se capturaba con la mercancía en las manos.
// Cambios de FORMA (la lógica es la misma):
//   · la **categoría** y los atributos de opción fija (`tipo: 'select'`) se eligen **tocando
//     chips de 44px** en vez de abrir un `<select>` de 36px;
//   · la **cantidad** —el gesto que más se repite por turno— pasa a **−/+ de 64px** con la cifra
//     a 28px (ley L10: el gesto más repetido recibe el control más grande);
//   · las etiquetas suben a 11px EN MAYÚSCULAS y los campos a 44px;
//   · el **derivado** sigue resolviéndose solo y en solo lectura (no se toca).
// Diseño aprobado: `DOCS/design/entradas/recepcion-puesto-tactil.html` §7 (opción A).
// ═══════════════════════════════════════════════════════════════════════════════

import { Plus, ScanLine, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CategoriaCapturable, PartidaEntradaForm } from '@/types/entradas'

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
         * Y el default es seguro porque las dos partes pueden corregirlo en su propio momento: la
         * puerta lo apaga aquí, y el técnico lo apaga desde el wizard con la pieza en la mano. Un
         * default que nadie puede deshacer sería una trampa; este se deshace donde se descubre.
         */
        lleva_ns: true,
    }
}

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

/** Las clases de un chip de opción (44px — objetivo de dedo). */
function claseChip(activo: boolean, disabled: boolean): string {
    return cn(
        // ⭐ MEJORA 27 Sep 2026 — `rounded-md`: un chip de opciones es un CONTROL, no una píldora de
        // estado (la ley del módulo: control = `rounded-md` · estado = `rounded-full`).
        'inline-flex min-h-11 items-center rounded-md border px-3.5 text-[14px] transition-colors',
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
 * Regla: hasta 4 opciones se **tocan** (chip de 44px); de 5 en adelante, **lista** — una pared de
 * burbujas se lee peor que una lista y ocupa tres renglones de alto.
 */
const MAX_CHIPS = 4
const usaChips = (opciones: string[]) => opciones.length <= MAX_CHIPS

/** El control de lista, con el MISMO alto de dedo que los chips (44px). */
const CLASE_SELECT = 'h-11 w-full rounded-md border border-border bg-surface-raised px-3 text-[15px]'

/** Una etiqueta de campo, en el idioma del puesto. */
function Etiqueta({ children, requerido }: { children: React.ReactNode; requerido?: boolean }) {    return (
        <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
            {children}
            {requerido ? <span className="text-destructive"> *</span> : ''}
        </span>
    )
}

interface PartidasEntradaGridProps {
    partidas: PartidaEntradaForm[]
    categorias: CategoriaCapturable[]
    onChange: (partidas: PartidaEntradaForm[]) => void
    disabled?: boolean
    /**
     * ⭐ MEJORA 28 Sep 2026 — la entrada es **mercancía nueva** (camino 2: salta la revisión). La
     * bandera de NS se apaga **diciendo por qué** en vez de ofrecer un control que no va a servir:
     * sin revisión no hay concentrado, y un control muerto enseña a ignorar esa zona.
     */
    esSinRevision?: boolean
}

export function PartidasEntradaGrid({
    partidas,
    categorias,
    onChange,
    disabled = false,
    esSinRevision = false,
}: PartidasEntradaGridProps) {
    const categoriaDe = (id: string) => categorias.find((c) => c.id === id) ?? null
    // ⭐ Campos que la RECEPCIÓN muestra: los `en_entrada` + los `derivado_de`
    // (read-only). Se excluye lo automático (`valor_default`, ej. rpm=7200).
    const enEntradaDe = (id: string) =>
        categoriaDe(id)?.esquema.filter((a) => (a.en_entrada || a.derivado_de) && !a.valor_default) ?? []

    // ⭐ Resuelve los atributos `derivado_de` a partir de otro campo (HDD: tipo → formato).
    const aplicarDerivados = (id: string, atributos: Record<string, string>): Record<string, string> => {
        const next = { ...atributos }
        for (const at of categoriaDe(id)?.esquema ?? []) {
            if (at.derivado_de) {
                const base = next[at.derivado_de.clave] ?? ''
                next[at.clave] = at.derivado_de.mapa[base] ?? ''
            }
        }
        return next
    }

    const actualizar = (i: number, patch: Partial<PartidaEntradaForm>) =>
        onChange(partidas.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
    const quitar = (i: number) => onChange(partidas.filter((_, idx) => idx !== i))
    const agregar = () => onChange([...partidas, nuevaPartida()])

    /** ⭐ El paso de cantidad: el gesto más repetido, con objetivos de 64px. */
    const paso = (i: number, delta: number) => {
        const actual = Number(partidas[i]?.cantidad_original) || 1
        actualizar(i, { cantidad_original: String(Math.max(1, actual + delta)) })
    }

    const cambiarCategoria = (i: number, id: string) =>
        actualizar(i, { id_categoria: id, atributos: aplicarDerivados(id, {}) })

    const cambiarAtributo = (i: number, clave: string, valor: string) =>
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

    const previewDe = (p: PartidaEntradaForm): string => {
        const cat = categoriaDe(p.id_categoria)
        if (!cat) return ''
        const valores = enEntradaDe(p.id_categoria)
            .map((a) => p.atributos[a.clave])
            .filter(Boolean)
        return [cat.nombre, ...valores].join(' · ')
    }

    const totalPiezas = partidas.reduce((s, p) => s + (Number(p.cantidad_original) || 0), 0)
    const totalCosto = partidas.reduce(
        (s, p) => s + (Number(p.cantidad_original) || 0) * (Number(p.costo_acordado) || 0),
        0
    )

    return (
        <div className="space-y-4">
            {partidas.map((p, i) => {
                const esquema = enEntradaDe(p.id_categoria)
                const cat = categoriaDe(p.id_categoria)
                const preview = previewDe(p)
                const cantidad = Number(p.cantidad_original) || 1
                return (
                    <div
                        key={p.id}
                        className="flex flex-col gap-3 rounded-md border border-l-[3px] border-border border-l-acc-entradas bg-surface-raised p-3.5"
                    >
                        <header className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex flex-wrap items-baseline gap-2">
                                <b className="text-[15px]">Partida #{i + 1}</b>
                                {preview && (
                                    <span className="text-[12.5px] text-muted-foreground">{preview}</span>
                                )}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => quitar(i)}
                                disabled={disabled || partidas.length === 1}
                                aria-label="Quitar partida"
                                data-accion="quitar-partida"
                                className="min-h-11 gap-1.5 px-3 text-[13px]"
                            >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                Quitar
                            </Button>
                        </header>

                        {/* Categoría: del catálogo, nunca texto libre. Chips si son pocas. */}
                        <div className="flex flex-col gap-1.5">
                            <Etiqueta requerido>Categoría</Etiqueta>
                            {usaChips(categorias.map((c) => c.nombre)) ? (
                                <div className="flex flex-wrap gap-2">
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
                                </div>
                            ) : (
                                <select
                                    className={CLASE_SELECT}
                                    value={p.id_categoria}
                                    onChange={(e) => cambiarCategoria(i, e.target.value)}
                                    disabled={disabled}
                                >
                                    <option value="">— elige categoría —</option>
                                    {categorias.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Atributos de la categoría: los de opción fija son chips; el derivado,
                            solo lectura (se resuelve del tipo). */}
                        {esquema.length > 0 && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {esquema.map((at) => (
                                    <div key={at.clave} className="flex flex-col gap-1.5">
                                        <Etiqueta requerido={at.requerido}>{at.etiqueta}</Etiqueta>
                                        {at.derivado_de ? (
                                            <div className="flex min-h-11 items-center justify-between rounded-md border border-border bg-surface-2 px-3 text-[15px] text-muted-foreground">
                                                <span>{p.atributos[at.clave] || '—'}</span>
                                                <span className="font-mono text-[10px] uppercase tracking-wide">
                                                    auto
                                                </span>
                                            </div>
                                        ) : at.tipo === 'select' && at.opciones ? (
                                            usaChips(at.opciones) ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {at.opciones.map((op) => (
                                                        <button
                                                            key={op}
                                                            type="button"
                                                            onClick={() => cambiarAtributo(i, at.clave, op)}
                                                            disabled={disabled}
                                                            className={claseChip(p.atributos[at.clave] === op, disabled)}
                                                        >
                                                            {op}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                // Muchas opciones (p. ej. capacidad): lista, no burbujas.
                                                <select
                                                    className={CLASE_SELECT}
                                                    value={p.atributos[at.clave] ?? ''}
                                                    onChange={(e) => cambiarAtributo(i, at.clave, e.target.value)}
                                                    disabled={disabled}
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
                                                className="h-11 text-[15px]"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {/* La cantidad: el gesto repetido con −/+, **y también se escribe**.
                                ⭐ 24 Sep 2026 (usuario): *«el usuario empieza usando las flechas + + ++
                                pero se da cuenta que son 220 pz… mejor que lo ponga manual también»* →
                                al enfocar la cifra se selecciona entera, lista para reemplazar. */}
                            <div className="flex flex-col gap-1.5">
                                <Etiqueta requerido>Cantidad</Etiqueta>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => paso(i, -1)}
                                        disabled={disabled || cantidad <= 1}
                                        aria-label="Quitar una pieza"
                                        className="grid size-11 place-items-center rounded-md border border-border bg-surface-raised text-[22px] font-bold leading-none text-foreground transition-colors hover:bg-hover-background disabled:opacity-50"
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        min={1}
                                        inputMode="numeric"
                                        value={p.cantidad_original}
                                        onChange={(e) => actualizar(i, { cantidad_original: e.target.value })}
                                        onFocus={(e) => e.currentTarget.select()}
                                        disabled={disabled}
                                        aria-label={`Cantidad de la partida ${i + 1}`}
                                        className="h-11 w-[88px] rounded-md border border-border bg-surface-raised text-center text-[20px] font-semibold tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => paso(i, 1)}
                                        disabled={disabled}
                                        aria-label="Agregar una pieza"
                                        className="grid size-11 place-items-center rounded-md border border-border bg-surface-raised text-[22px] font-bold leading-none text-foreground transition-colors hover:bg-hover-background disabled:opacity-50"
                                    >
                                        +
                                    </button>
                                    <span className="text-[13px] text-muted-foreground">pza</span>
                                </div>
                                <span className="text-[11.5px] text-muted-foreground">
                                    Toca la cifra para escribirla directo (p. ej. 220).
                                </span>
                            </div>

                            {/* El costo, con más vista: es lo que la nota va a pagar. */}
                            <div className="flex flex-col gap-1.5">
                                <Etiqueta requerido>Costo acordado por pieza</Etiqueta>
                                <div className="flex items-center gap-2">
                                    <span className="text-[18px] font-semibold text-muted-foreground">$</span>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="0.0001"
                                        placeholder="0.00"
                                        className="h-12 text-[18px] font-semibold tabular-nums"
                                        value={p.costo_acordado}
                                        onChange={(e) => actualizar(i, { costo_acordado: e.target.value })}
                                        disabled={disabled}
                                    />
                                </div>
                                {cat && (
                                    <span className="text-[13px] text-muted-foreground">
                                        Subtotal{' '}
                                        <b className="text-foreground">
                                            {formatearMXN(cantidad * (Number(p.costo_acordado) || 0))}
                                        </b>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ⭐ MEJORA 28 Sep 2026 — **D1: ¿esta mercancía se identifica por NÚMERO DE
                            SERIE?** La bandera la decide la PUERTA (quien recibe sabe si el disco trae
                            serial), NO el técnico. Enciende el concentrado de NS del guardado de la
                            revisión: un NS por pieza aprobada y otro por cada devuelta.
                            El control DICE su consecuencia — encenderlo cambia el trabajo del técnico,
                            y quien recibe tiene que poder verlo antes de firmar la entrada. */}
                        <div className="flex flex-col gap-1.5">
                            <Etiqueta>Número de serie</Etiqueta>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => actualizar(i, { lleva_ns: !p.lleva_ns })}
                                    disabled={disabled || esSinRevision}
                                    aria-pressed={p.lleva_ns}
                                    data-accion="lleva-ns"
                                    className={claseChip(p.lleva_ns, disabled || esSinRevision)}
                                >
                                    <ScanLine className="mr-2 h-4 w-4" aria-hidden="true" />
                                    {p.lleva_ns ? 'Sí lleva NS' : 'No lleva NS'}
                                </button>
                                <span className="text-[11.5px] text-muted-foreground">
                                    {esSinRevision
                                        ? 'La mercancía nueva no pasa por revisión: aquí no se piden NS.'
                                        : p.lleva_ns
                                          ? `En revisión se escaneará un NS por cada una de las ${cantidad} piezas.`
                                          : 'La revisión no pedirá escaneos.'}
                                </span>
                            </div>
                        </div>
                    </div>
                )
            })}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={agregar}
                    disabled={disabled}
                    data-accion="agregar-partida"
                    className="min-h-[52px] gap-2 px-4 text-[15px]"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Agregar partida
                </Button>
                <div className="flex items-center gap-4 text-[14px] tabular-nums text-muted-foreground">
                    <span>
                        Partidas: <b className="text-foreground">{partidas.length}</b>
                    </span>
                    <span>
                        Piezas: <b className="text-foreground">{totalPiezas}</b>
                    </span>
                    <span>
                        Total: <b className="text-foreground">{formatearMXN(totalCosto)}</b>
                    </span>
                </div>
            </div>
        </div>
    )
}
