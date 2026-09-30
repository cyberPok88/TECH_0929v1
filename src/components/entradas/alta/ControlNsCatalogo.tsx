'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL DE NS — consulta del concentrado desde el puesto de Almacén (Guía 1.6 · 29 Sep 2026)
//
// ⭐ LA 4ª FICHA DEL HUB. El almacenista tiene la pieza en la mano y un serial que no reconoce:
// garantía de un cliente, una devolución, o el proveedor intentando colar la pieza que ya se le
// devolvió. Escribe (o escanea) el NS y el sistema contesta **de dónde vino y qué pasó con él**.
//
// ⭐ EL CASO QUE JUSTIFICA LA PANTALLA es el NO_PASA: un disco rechazado **no puede volver a
// entrar** (el `UNIQUE` de `ns` lo impide), pero el error de la base dice «duplicado» —que no
// explica nada—. Aquí dice «entró en ING-0026 el 29/09 y se DEVOLVIÓ al proveedor», que es la
// frase con la que alguien puede tomar una decisión.
//
// ⚠️ LO QUE NO SABE, declarado en la pantalla y no disimulado: **la marca de ESTE serial** (una
// partida rinde varias filas de producto y el concentrado no las distingue — corrección del usuario
// en la M35). Por eso el producto se informa **por PARTIDA**, y cuando la partida rindió más de un
// SKU se dice tal cual: el serial no alcanza para elegir uno.
//
// Puesto de piso: el campo mide 64 (el gesto es escanear), el botón 56 y el resultado se lee de un
// vistazo — los dos datos que se vienen a buscar (folio y resultado) van en grande.
// ═══════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react'
import { AlertTriangle, PackageCheck, ScanLine, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Pildora } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { consultarNumeroSerie } from '@/lib/actions/entradas'
import type { ResultadoConsultaNs } from '@/types/entradas'
import { TEXTO_ESTADO_ENTRADA } from '@/types/entradas'

const RUTA = '/dashboard/entradas/alta/ns'

/** La fecha del concentrado, en corto: es una constancia, no un campo de captura. */
function formatearFecha(fecha: string | undefined): string {
    if (!fecha) return '—'
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha
    return d.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/** Un dato del resultado, con su etiqueta arriba (el idioma del puesto). */
function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <span className="block font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                {etiqueta}
            </span>
            <span className="mt-0.5 block truncate text-[15px] font-medium text-foreground">{children}</span>
        </div>
    )
}

export function ControlNsCatalogo() {
    const [ns, setNs] = useState('')
    const [resultado, setResultado] = useState<ResultadoConsultaNs | null>(null)
    const [buscando, setBuscando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const campo = useRef<HTMLInputElement>(null)

    usePageConfig({
        info: { title: 'Control de NS', subtitle: 'Consulta un número de serie del concentrado' },
        path: RUTA,
    })

    const buscar = async () => {
        const texto = ns.trim()
        if (!texto || buscando) return
        setBuscando(true)
        setError(null)
        setResultado(null)
        const res = await consultarNumeroSerie(texto)
        setBuscando(false)
        if (!res.success) {
            setError(res.error ?? 'No se pudo consultar el número de serie.')
            return
        }
        setResultado(res.data ?? null)
        // El foco VUELVE al campo: el almacenista escanea uno detrás de otro sin tocar el ratón.
        campo.current?.focus()
        campo.current?.select()
    }

    const limpiar = () => {
        setNs('')
        setResultado(null)
        setError(null)
        campo.current?.focus()
    }

    const esDevuelto = resultado?.encontrado === true && resultado.resultado === 'NO_PASA'
    const productos = resultado?.productos ?? []

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {/* ── el campo: 64px, con foco y Enter (el escáner «escribe y da Enter») ── */}
            <form
                className="flex flex-col gap-3 sm:flex-row sm:items-center"
                onSubmit={(e) => {
                    e.preventDefault()
                    void buscar()
                }}
            >
                <label className="flex min-h-16 flex-1 items-center gap-3 rounded-md border-2 border-acc-entradas bg-surface-2 px-4">
                    <ScanLine className="size-5 shrink-0 text-acc-entradas" aria-hidden="true" />
                    <span className="sr-only">Número de serie a consultar</span>
                    <input
                        ref={campo}
                        value={ns}
                        onChange={(e) => setNs(e.target.value)}
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Escanea o escribe el NS…"
                        className="w-full bg-transparent font-mono text-lg font-semibold tracking-[0.04em] outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground"
                    />
                </label>
                <div className="flex gap-2">
                    <Button
                        type="submit"
                        disabled={buscando || ns.trim() === ''}
                        className="min-h-14 flex-1 px-6 text-base sm:flex-none"
                    >
                        <Search className="mr-1.5 size-5" aria-hidden="true" />
                        {buscando ? 'Buscando…' : 'Buscar'}
                    </Button>
                    {resultado || error ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-14 px-5 text-base"
                            onClick={limpiar}
                        >
                            Limpiar
                        </Button>
                    ) : null}
                </div>
            </form>

            {error ? (
                <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                    {error}
                </p>
            ) : null}

            {/* ── sin resultado todavía: se dice QUÉ se puede averiguar ── */}
            {!resultado && !error ? (
                <p className="rounded-md border border-border bg-surface-2 px-4 py-3 text-[13px] text-muted-foreground">
                    Consulta un número de serie del concentrado de Revisiones: dice{' '}
                    <b className="text-foreground">de qué entrada vino</b>,{' '}
                    <b className="text-foreground">de qué proveedor</b>, cuándo se escaneó y si la pieza{' '}
                    <b className="text-foreground">pasó o se devolvió</b>. La marca del serial no se puede
                    afirmar: el concentrado no la guarda (una partida puede rendir varios productos).
                </p>
            ) : null}

            {/* ── NO está en el concentrado ── */}
            {resultado && !resultado.encontrado ? (
                <div className="rounded-lg border-2 border-warning/50 bg-warning/5 p-4">
                    <p className="flex items-center gap-2 text-[15px] font-semibold">
                        <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden="true" />
                        <span className="font-mono">{resultado.ns}</span> no está en el concentrado
                    </p>
                    <p className="mt-1.5 text-[13px] text-muted-foreground">
                        Ninguna entrada registró este serial. Si la pieza está físicamente aquí, su NS debió
                        escanearse al guardar la revisión de su partida: revisa que esa partida tenga la
                        bandera <b className="text-foreground">«lleva NS»</b> encendida.
                    </p>
                </div>
            ) : null}

            {/* ── SÍ está: de dónde vino y qué pasó ── */}
            {resultado?.encontrado ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-xl font-extrabold tracking-[0.04em]">
                            {resultado.ns}
                        </span>
                        <Pildora
                            texto={resultado.resultado === 'PASA' ? 'PASÓ la revisión' : 'NO PASÓ · devuelto'}
                            tono={resultado.resultado === 'PASA' ? 'exito' : 'peligro'}
                        />
                        {resultado.estado_entrada ? (
                            <Pildora
                                texto={TEXTO_ESTADO_ENTRADA[resultado.estado_entrada] ?? resultado.estado_entrada}
                                tono="neutro"
                            />
                        ) : null}
                    </div>

                    {/* El caso que la pantalla existe para decir: el disco ya se devolvió. */}
                    {esDevuelto ? (
                        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                            <b>Esta pieza se devolvió al proveedor.</b> Su serial ya quedó registrado, así que
                            un intento de reingresarla se rechaza solo (el NS es único). No debe volver al
                            inventario.
                        </p>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3">
                        <Dato etiqueta="Entrada">{resultado.folio ?? '—'}</Dato>
                        <Dato etiqueta="Proveedor">{resultado.proveedor ?? '—'}</Dato>
                        <Dato etiqueta="Partida">
                            {resultado.partida !== null && resultado.partida !== undefined
                                ? `#${resultado.partida}`
                                : '—'}
                        </Dato>
                        <Dato etiqueta="Fecha de la entrada">{formatearFecha(resultado.fecha_entrada)}</Dato>
                        <Dato etiqueta="Categoría">{resultado.categoria ?? '—'}</Dato>
                        <Dato etiqueta="Escaneado">{formatearFecha(resultado.capturado_at)}</Dato>
                        <Dato etiqueta="Lo firmó">{resultado.capturado_por ?? '—'}</Dato>
                    </div>

                    {/* ── el producto: por PARTIDA, que es el nivel que sí lo sabe ── */}
                    <div className="border-t border-border pt-3">
                        <span className="block font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                            Producto de esa partida
                        </span>
                        {productos.length === 0 ? (
                            <p className="mt-1 text-[13px] text-muted-foreground">
                                Todavía sin SKU: Almacén lo resuelve por huella al cotejar y dar de alta.
                            </p>
                        ) : (
                            <>
                                <ul className="mt-1.5 flex flex-col gap-1.5">
                                    {productos.map((p) => (
                                        <li
                                            key={p.sku}
                                            className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-border bg-surface-raised px-3"
                                        >
                                            <PackageCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                                            <span className="font-mono text-[13.5px] font-semibold">{p.sku}</span>
                                            <span className="min-w-0 truncate text-[13.5px]">{p.nombre}</span>
                                            <span className="ml-auto text-[12.5px] tabular-nums text-muted-foreground">
                                                {p.cantidad_aprobada} pza
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                {productos.length > 1 ? (
                                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                                        Esta partida rindió <b className="text-foreground">{productos.length} productos</b>:
                                        el concentrado no puede decir a cuál de ellos pertenece este serial — el NS no
                                        guarda la marca.
                                    </p>
                                ) : null}
                            </>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    )
}
