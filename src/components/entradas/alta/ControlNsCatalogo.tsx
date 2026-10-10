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
import { capacidadTextoDesdeGb } from '@/lib/lector-discos'
import type { LecturaNs, ResultadoConsultaNs } from '@/types/entradas'
import { TEXTO_ESTADO_ENTRADA } from '@/types/entradas'

const RUTA = '/dashboard/entradas/alta/ns'

/** Un número de la lectura, con su sufijo; `—` cuando el agente no lo trajo. */
function num(v: number | null | undefined, sufijo = ''): string {
    if (v === null || v === undefined) return '—'
    return `${v}${sufijo}`
}

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

/**
 * ⭐ MEJORA 52 (07 Oct 2026) — **LA LECTURA DEL DISCO, en la pantalla del NS.**
 *
 * Lo pidió el dueño con estas palabras: *«si queremos saber datos de un dato específico se escanea
 * el NS y nos muestra **los 40 datos de la lectura**»*. Hasta ahora la pantalla solo contaba **de qué
 * entrada vino**; esto cuenta **cómo está la pieza**.
 *
 * Ordenado como se decide: ① **la salud** (es lo que decide PASA/NO PASA) · ② **la capacidad MEDIDA**
 * (la verdad de la pieza: si no coincide con lo declarado, es el caso de reclasificación) ·
 * ③ el desgaste (valúa) · ④ el daño · ⑤ la identidad del disco · ⑥ **el payload crudo**, plegado,
 * porque es evidencia auditable y no una pantalla.
 */
function BloqueLectura({ lectura }: { lectura: LecturaNs }) {
    const sinAval = lectura.apto_para_decidir === false
    const crudo = lectura.cruda as Record<string, unknown> | null
    return (
        <div className="space-y-3 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                    La lectura del disco
                </span>
                <Pildora
                    texto={`${lectura.salud_veredicto ?? 'sin veredicto'}${
                        lectura.salud_puntaje !== null ? ` · ${lectura.salud_puntaje} %` : ''
                    }`}
                    tono={lectura.apto ? 'exito' : 'peligro'}
                />
                {sinAval ? <Pildora texto="SIN AVAL · lo decide el técnico" tono="advertencia" /> : null}
                {lectura.requiere_revision ? (
                    <Pildora texto="Requiere revisión" tono="advertencia" />
                ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato etiqueta="Capacidad MEDIDA">
                    <span className="font-semibold">
                        {lectura.capacidad_gb !== null ? capacidadTextoDesdeGb(lectura.capacidad_gb) : '—'}
                    </span>
                </Dato>
                <Dato etiqueta="Horas de uso">{num(lectura.horas_uso)}</Dato>
                <Dato etiqueta="Encendidos">{num(lectura.encendidos)}</Dato>
                <Dato etiqueta="Temperatura">{num(lectura.temperatura_c, ' °C')}</Dato>
                <Dato etiqueta="Modelo">{lectura.modelo ?? '—'}</Dato>
                <Dato etiqueta="Firmware">{lectura.firmware ?? '—'}</Dato>
                <Dato etiqueta="Interfaz">
                    {lectura.interfaz ?? '—'}
                    {lectura.es_nvme ? ' · NVMe' : ''}
                </Dato>
                <Dato etiqueta="RPM">{num(lectura.rpm)}</Dato>
                <Dato etiqueta="Reasignados">{num(lectura.sectores_reasignados)}</Dato>
                <Dato etiqueta="Pendientes">{num(lectura.sectores_pendientes)}</Dato>
                <Dato etiqueta="No corregibles">{num(lectura.sectores_no_corregibles)}</Dato>
                <Dato etiqueta="Errores CRC">{num(lectura.errores_crc)}</Dato>
                <Dato etiqueta="Marca que detectó el agente">
                    {lectura.marca_detectada ?? '—'}
                    {lectura.marca_confianza ? ` · ${lectura.marca_confianza}` : ''}
                </Dato>
                <Dato etiqueta="Leído">{formatearFecha(lectura.leido_el)}</Dato>
                <Dato etiqueta="Motor">{lectura.motor ?? '—'}</Dato>
                <Dato etiqueta="NS de Windows">{lectura.ns_windows ?? '—'}</Dato>
            </div>

            {lectura.salud_motivos && lectura.salud_motivos.length > 0 ? (
                <details className="rounded-md border border-border bg-surface-2 px-3 py-2">
                    <summary className="cursor-pointer text-[12.5px] font-medium">
                        Por qué esa salud ({lectura.salud_motivos.length})
                    </summary>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12.5px] text-muted-foreground">
                        {lectura.salud_motivos.map((m, i) => (
                            <li key={i}>{m}</li>
                        ))}
                    </ul>
                </details>
            ) : null}

            {crudo ? (
                <details className="rounded-md border border-border bg-surface-2 px-3 py-2">
                    <summary className="cursor-pointer text-[12.5px] font-medium">
                        La lectura completa (evidencia)
                    </summary>
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                        El agente manda más de lo que esta pantalla necesita: acá está <b>tal cual</b>,
                        incluida la <b>fuente de la salud</b> (HDSentinel, el propio disco o la fórmula de
                        la casa) y <b>si la lectura quedó incompleta</b>.
                    </p>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-surface p-2 font-mono text-[11px] leading-relaxed">
                        {JSON.stringify(crudo, null, 2)}
                    </pre>
                </details>
            ) : null}
        </div>
    )
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

                    {/* ── ⭐ MEJORA 52 · LA LECTURA DE LA PIEZA ─────────────────────────────
                        El NS es la LLAVE y esto es **el archivo de la pieza**: lo que el agente
                        le tomó al disco cuando se revisó. Es lo que se viene a ver cuando se
                        escanea un serial: qué disco es, cómo está y cuánto se usó.
                        Es `lecturas_disco` (append-only): si el disco se leyó dos veces, acá
                        se ve la ÚLTIMA y las anteriores quedan como historia. */}
                    {resultado.lectura ? (
                        <BloqueLectura lectura={resultado.lectura} />
                    ) : (
                        <p className="border-t border-border pt-3 text-[12.5px] text-muted-foreground">
                            <b className="text-foreground">Sin lectura.</b> Esta pieza se revisó sin el
                            lector (o es de una categoría que no tiene SMART, como la RAM): su
                            identidad se capturó a mano y no hay ficha del disco.
                        </p>
                    )}

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
