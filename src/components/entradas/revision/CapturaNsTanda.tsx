'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CAPTURA DE NS DE LA TANDA — Guía 1.6 · MEJORA 35 (27 Sep 2026)
//
// El número de serie **no es un dato de la pieza**: es el CONCENTRADO de la entrada. Después de
// revisar (y ANTES de escribir nada) el técnico escanea los NS: primero los de las piezas que
// PASARON y después los de las que NO pasaron. Una sola escritura: la tanda + los NS (D2).
//
// El NS **no sabe marca ni motivo** (corrección del usuario): el concentrado se junta plano y solo
// distingue bueno/malo. La marca la determina la revisión por huella (una partida rinde varias
// filas de producto) y el motivo vive en la DEV/tanda.
//
// Puesto de dedo: el campo de escaneo mide 64 (el gesto más repetido recibe el control más grande).
// El escáner «escribe y da Enter»: no hay botón de agregar. El avance está apagado diciendo por qué.
//
// ⭐ MEJORA 28 Sep 2026 (usuario, 2 fixes sobre el mismo modal) — **EL CAMBIO DE PASO SE AVISA**:
//   · ① la pantalla **PIDE** lo que falta con todas sus letras —«Escanea los N NS de las piezas
//     APROBADAS»— en vez de esperar que el técnico lo deduzca del contador;
//   · ② **EL TOPE**: el campo acepta exactamente los N que se esperan. Antes se podía escanear de
//     más: el contador pasaba de largo, la acción quedaba imposible de completar y el guardado se
//     colgaba (el mismo techo, del lado del servidor, vive en `guardarAvanceRevision`);
//   · ③ al cerrar los aprobados el campo queda **BLOQUEADO 2 s** y solo entonces la pantalla cambia
//     a los devueltos **en ROJO**. El bloqueo no es adorno: dos escaneos seguidos, sin pausa,
//     caerían en la lista equivocada — y un NS del lado que no es no se nota hasta la garantía.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ScanLine, Trash2, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { NsTanda } from '@/types/entradas'

export interface CapturaNsTandaProps {
    /** Cuántos NS se esperan de cada lado (las piezas que el técnico acaba de marcar). */
    pasa: number
    noPasa: number
    /** Para el encabezado: de qué entrada y partida se está hablando. */
    folio: string
    partida: number | null
    /** Se completa con las DOS listas (largo exacto) o se cancela: sin NS no hay guardado (D2). */
    onListo: (ns: NsTanda) => void
    onCancelar: () => void
}

/** Los 2 s del aviso de cambio de paso. Una constante, no un número suelto: se cita en el texto. */
const MS_BLOQUEO = 2000

export function CapturaNsTanda({ pasa, noPasa, folio, partida, onListo, onCancelar }: CapturaNsTandaProps) {
    const [paso, setPaso] = useState<1 | 2>(pasa > 0 ? 1 : 2)
    const [nsPasa, setNsPasa] = useState<string[]>([])
    const [nsNoPasa, setNsNoPasa] = useState<string[]>([])
    const [valor, setValor] = useState('')
    const [error, setError] = useState<string | null>(null)
    /**
     * ⭐ MEJORA 28 Sep 2026 — **el campo bloqueado durante el cambio de paso.** Se enciende al
     * completar los aprobados (si hay devueltos por escanear) y lo apaga el temporizador de abajo,
     * que es quien cambia de pantalla. El setState NO vive en el cuerpo del efecto — solo dentro
     * del `setTimeout` —, que es lo que el proyecto prohíbe (`react-hooks/set-state-in-effect`).
     */
    const [bloqueado, setBloqueado] = useState(false)
    /**
     * ⭐ MEJORA 28 Sep 2026 (adyacente cerrado) — **volver al paso 1 sin cancelar.** El salto
     * automático se consume UNA vez: al volver desde los devueltos, el paso 1 ya no teletransporta
     * (`bloqueado` es para el aviso), ofrece «Continuar a los devueltos». Antes, equivocarse en un NS
     * aprobado obligaba a cancelar la captura entera.
     */
    const [paso1Cerrado, setPaso1Cerrado] = useState(false)
    const campo = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!bloqueado) return
        const t = window.setTimeout(() => {
            setBloqueado(false)
            setPaso1Cerrado(true)
            setPaso(2)
        }, MS_BLOQUEO)
        return () => window.clearTimeout(t)
    }, [bloqueado])

    /** El foco VIVE en el campo: el técnico pasa el lector y sigue. */
    useEffect(() => {
        if (!bloqueado) campo.current?.focus()
    }, [paso, bloqueado])

    const esPaso1 = paso === 1
    const esperados = esPaso1 ? pasa : noPasa
    const capturados = esPaso1 ? nsPasa : nsNoPasa
    const completoPaso = capturados.length === esperados
    const todoListo = nsPasa.length === pasa && nsNoPasa.length === noPasa
    const faltanPaso = Math.max(0, esperados - capturados.length)
    const total = nsPasa.length + nsNoPasa.length
    const totalEsperado = pasa + noPasa

    const agregar = useCallback(
        (crudo: string) => {
            const ns = crudo.trim()
            if (!ns || bloqueado) return
            /**
             * ⚠️ MEJORA 28 Sep 2026 — **EL TOPE.** Un NS de más ya no entra: el contador no puede
             * pasar de largo y el guardado no puede quedar imposible de completar. Si el técnico se
             * equivocó, el camino es el botón de borrar el último de la lista — no seguir escaneando.
             */
            if (capturados.length >= esperados) {
                setError(`Ya están los ${esperados} NS de este paso. Borra el último si te equivocaste.`)
                setValor('')
                return
            }
            const todos = [...nsPasa, ...nsNoPasa]
            if (todos.includes(ns)) {
                // El UNIQUE de la base es la regla de verdad; aquí solo se evita el tecleo repetido.
                setError(`Ese NS ya está en esta captura: ${ns}`)
                setValor('')
                return
            }
            setError(null)
            setValor('')
            const nuevos = [...capturados, ns]
            if (esPaso1) setNsPasa(nuevos)
            else setNsNoPasa(nuevos)
            // ③ Al cerrar los aprobados, con devueltos por escanear: aviso de 2 s y salto al paso 2.
            if (esPaso1 && noPasa > 0 && nuevos.length === esperados) setBloqueado(true)
        },
        [bloqueado, capturados, esperados, esPaso1, noPasa, nsPasa, nsNoPasa]
    )

    /**
     * ⭐ MEJORA 28 Sep 2026 — **se borra CUALQUIER NS, no solo el último.** Antes solo la última fila
     * tenía el botón: arreglar un NS mal escaneado en medio de 50 obligaba a borrar la cola entera.
     */
    const quitar = (ns: string) => {
        if (bloqueado) return
        setError(null)
        if (esPaso1) setNsPasa((prev) => prev.filter((x) => x !== ns))
        else setNsNoPasa((prev) => prev.filter((x) => x !== ns))
        campo.current?.focus()
    }

    const continuar = () => {
        if (!todoListo) return
        onListo({ pasa: nsPasa, noPasa: nsNoPasa })
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Captura de números de serie"
                className={cn(
                    // ③ El paso 2 se pinta ROJO: el color dice de qué lado de la revisión se está
                    // escaneando, antes de leer una sola palabra.
                    'flex w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border-2 bg-surface shadow-premium-lg sm:rounded-xl',
                    esPaso1 ? 'border-acc-entradas' : 'border-destructive'
                )}
            >
                {/* ── cabecera: de qué se habla y en qué paso va ── */}
                <div
                    className={cn(
                        'flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3',
                        esPaso1
                            ? 'border-border bg-surface-2'
                            : 'border-destructive/40 bg-destructive/10'
                    )}
                >
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" className="min-h-12" onClick={onCancelar}>
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            Atrás
                        </Button>
                        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                            {folio}
                            {partida !== null ? ` · PARTIDA ${partida}` : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span
                            className={cn(
                                'grid size-6 place-items-center rounded-full text-[11px] font-bold',
                                esPaso1 ? 'bg-primary text-primary-fg' : 'border border-border'
                            )}
                        >
                            1
                        </span>
                        los que pasaron
                        <span aria-hidden="true">·</span>
                        <span
                            className={cn(
                                'grid size-6 place-items-center rounded-full text-[11px] font-bold',
                                !esPaso1 ? 'bg-destructive text-destructive-foreground' : 'border border-border'
                            )}
                        >
                            2
                        </span>
                        los que no
                    </div>
                </div>

                <div className="flex flex-col gap-4 p-4">
                    {/* ── ① EL PEDIDO: qué se escanea, cuántos y de qué lado ── */}
                    <div
                        className={cn(
                            'flex items-start gap-3 rounded-md border-2 p-3',
                            esPaso1 ? 'border-success/40 bg-success/5' : 'border-destructive/50 bg-destructive/10'
                        )}
                    >
                        <ScanLine
                            className={cn(
                                'mt-0.5 size-5 shrink-0',
                                esPaso1 ? 'text-success' : 'text-destructive'
                            )}
                            aria-hidden="true"
                        />
                        <div className="min-w-0">
                            <p className="text-[15px] font-semibold leading-snug">
                                {esPaso1
                                    ? `Escanea los ${pasa} NS de las piezas APROBADAS`
                                    : `Escanea los ${noPasa} NS de las piezas DEVUELTAS`}
                            </p>
                            <p className="text-[12.5px] text-muted-foreground">
                                {bloqueado
                                    ? `Listo. El campo se bloquea ${MS_BLOQUEO / 1000} s y sigue con los devueltos…`
                                    : 'Uno por pieza, con el lector. Avanza solo: no hay que pulsar nada.'}
                            </p>
                        </div>
                        <span className="ml-auto shrink-0 text-right">
                            <span className="block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                                Escaneados
                            </span>
                            <span className="text-2xl font-extrabold tabular-nums">
                                {capturados.length}{' '}
                                <span className="text-base font-semibold text-muted-foreground">
                                    / {esperados}
                                </span>
                            </span>
                        </span>
                    </div>

                    {/* ── el campo: 64px y el foco adentro. Se apaga al llegar al tope ── */}
                    <label
                        className={cn(
                            'flex min-h-16 items-center gap-3 rounded-md border-2 px-4',
                            esPaso1
                                ? 'border-acc-entradas bg-surface-2'
                                : 'border-destructive bg-destructive/5',
                            (bloqueado || completoPaso) && 'opacity-70'
                        )}
                    >
                        {bloqueado ? (
                            <Spinner className="shrink-0" />
                        ) : (
                            <ScanLine
                                className={cn(
                                    'size-5 shrink-0',
                                    esPaso1 ? 'text-acc-entradas' : 'text-destructive'
                                )}
                                aria-hidden="true"
                            />
                        )}
                        <span className="sr-only">
                            {esPaso1 ? 'Escanear los NS que pasaron' : 'Escanear los NS que no pasaron'}
                        </span>
                        <input
                            ref={campo}
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    agregar(valor)
                                }
                            }}
                            disabled={bloqueado || completoPaso}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder={
                                bloqueado
                                    ? 'Campo bloqueado…'
                                    : completoPaso
                                      ? `Listo: ${esperados} de ${esperados}`
                                      : esPaso1
                                        ? 'Escanea un NS aprobado…'
                                        : 'Escanea un NS devuelto…'
                            }
                            className="w-full bg-transparent font-mono text-lg font-semibold tracking-[0.04em] outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground"
                        />
                    </label>

                    {bloqueado ? (
                        <p className="text-[12px] text-muted-foreground">
                            Ya están los {pasa} aprobados. En {MS_BLOQUEO / 1000} s esta pantalla se pone
                            en <b className="text-destructive">rojo</b> para escanear los {noPasa}{' '}
                            devueltos.
                        </p>
                    ) : null}

                    {error ? (
                        <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                            {error}
                        </p>
                    ) : null}

                    {/* ── lo escaneado, con la última borrable ── */}
                    {capturados.length > 0 ? (
                        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                            {capturados.map((ns) => (
                                <li
                                    key={ns}
                                    className={cn(
                                        'flex min-h-11 items-center gap-3 rounded-md border px-3 text-[13.5px]',
                                        esPaso1
                                            ? 'border-border bg-surface-raised'
                                            : 'border-destructive/40 bg-destructive/5'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]',
                                            esPaso1
                                                ? 'bg-success/15 text-success'
                                                : 'bg-destructive/15 text-destructive'
                                        )}
                                    >
                                        {esPaso1 ? 'pasó' : 'no pasó'}
                                    </span>
                                    <span className="font-mono">{ns}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="ml-auto min-h-11"
                                        onClick={() => quitar(ns)}
                                        disabled={bloqueado}
                                    >
                                        <Trash2 className="size-4" aria-hidden="true" />
                                        <span className="sr-only">{`Quitar el NS ${ns}`}</span>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    {/* ── volver a los aprobados: el atrás que faltaba ── */}
                    {!esPaso1 && pasa > 0 ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-12"
                            disabled={bloqueado}
                            onClick={() => setPaso(1)}
                            title="Regresa a la lista de los aprobados para corregir un NS."
                        >
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            {`Volver a los aprobados (${nsPasa.length}/${pasa})`}
                        </Button>
                    ) : null}

                    {/* ── la acción, apagada DICIENDO POR QUÉ ──
                        ⭐ 28 Sep 2026 — en el paso 1 con devueltos por escanear NO se pinta (el paso
                        cambia solo, con su bloqueo de 2 s: un botón «continuar» ahí sería un control de
                        más en el gesto más repetido del turno)… **salvo que el técnico haya VUELTO**
                        desde los devueltos: entonces el salto automático ya se consumió y sin botón
                        quedaría atrapado en el paso 1. */}
                    {esPaso1 && noPasa > 0 ? (
                        paso1Cerrado ? (
                            <Button
                                type="button"
                                disabled={!completoPaso || bloqueado}
                                onClick={() => setPaso(2)}
                                title={
                                    completoPaso
                                        ? undefined
                                        : `Faltan ${faltanPaso} NS por escanear en los aprobados.`
                                }
                                className="min-h-14 text-base"
                            >
                                <Check className="size-5" aria-hidden="true" />
                                Continuar a los devueltos
                            </Button>
                        ) : null
                    ) : (
                        <Button
                            type="button"
                            disabled={!todoListo || bloqueado}
                            onClick={continuar}
                            title={
                                todoListo
                                    ? undefined
                                    : `Faltan ${faltanPaso} NS por escanear en ${
                                          esPaso1 ? 'los aprobados' : 'los devueltos'
                                      } para poder guardar.`
                            }
                            className="min-h-14 text-base"
                        >
                            {todoListo ? (
                                <>
                                    <Check className="size-5" aria-hidden="true" />
                                    {`Guardar revisión y ${totalEsperado} NS`}
                                </>
                            ) : (
                                `Faltan ${faltanPaso} · ${
                                    esPaso1 ? 'los que pasaron' : 'los que no pasaron'
                                }`
                            )}
                        </Button>
                    )}

                    <p className="text-[12px] text-muted-foreground">
                        Sin los {totalEsperado} NS la tanda <b>no se guarda</b>: el concentrado es la
                        constancia de qué piezas entraron. Llevas {total} de {totalEsperado}.
                    </p>
                </div>
            </div>
        </div>
    )
}
