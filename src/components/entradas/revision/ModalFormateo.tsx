'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL DEL FORMATEO — el proceso en su PROPIA superficie (Guía 1.6 · MEJORA 46)
// ═══════════════════════════════════════════════════════════════════════════════
// Antes el formateo **ocurría dentro del modal de revisión**: la fase global, la barra por disco
// y los 4 pasos se pintaban abajo de las fichas, y el modal **se podía cerrar en medio del
// borrado**. Ahora el proceso sale a su propia superficie y **no se cierra hasta tener un
// resultado**.
//
// ⭐ ES PRESENTACIONAL A PROPÓSITO. El estado `formato` y el sondeo (`setInterval` contra
// `/api/formateo/progreso`) se QUEDAN en `PanelLectorDiscos`, por una razón MEDIDA: ese sondeo no
// solo pinta — también dispara los `toast`, avisa al wizard (`onFormateado`) y alimenta
// `formateados` / `todosFormateados` / `formateando`, que son los que habilitan los botones de
// cada tarjeta y los que viajan al guardián de salida del wizard (`onEstado`). Si el modal fuera
// el dueño del sondeo, esas cuatro se rompen o hay que duplicar el estado.
// Y que el **PADRE** controle `open` es, además, lo que hace posible la regla de abajo.
//
// 🔴 LA REGLA DURA: **mientras el formateo corre, este modal NO se cierra.** Ni con el velo, ni
// con `Esc`, ni con la ×, ni con un «← Atrás» (por eso no está). Cerrarlo en medio de un
// `diskpart clean` deja el disco **a medio formatear**. El candado tiene DOS lados —acá (la × se
// esconde) y en el padre (el `onOpenChange` NIEGA el cierre)— porque la pantalla se puede saltar.
//
// ⚠️ DESVIACIÓN DECLARADA DE LA SPEC §2.1: la SPEC manda que el retroceso «siempre esté» (L13).
// Acá **no está mientras corre**, y no puede estar: es exactamente lo que este modal evita. La
// salida existe, pero llega con el RESULTADO (`Cerrar` 52 + la acción 56).
//
// ⭐ Y LA ESCOTILLA, que es lo que impide que «no se cierra» sea una trampa: si el AGENTE muere,
// el padre detecta N sondeos fallidos seguidos y manda `sinContacto`. El modal lo dice con el
// último paso visto y **habilita la salida**. Sin esto, el proceso podría morir y el técnico
// quedaría encerrado sin más salida que recargar la página.
// ═══════════════════════════════════════════════════════════════════════════════

import { TriangleAlert } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import { Ayuda, useAyuda } from '@/components/ui/Ayuda'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
    PASOS_FORMATEO,
    avanceDeDisco,
    errorGlobalDe,
    faseGlobalDe,
    nsEnCurso,
    pasoDeDisco,
} from '@/lib/lectura-aval'
import type { DiscoLeido, ProgresoFormateo } from '@/lib/lector-discos'

/**
 * Las 4 formas, **en el orden de `PASOS_FORMATEO`**: el índice del paso elige la forma. Salen del
 * mockup aprobado (`DOCS/design/revision/08-modal-formateo.html`, decisión D1-A): la forma **es**
 * el dato — de reojo se sabe en qué paso va — y por eso **no** se anima en bucle.
 * ⚠️ Al trazo se le pasan **atributos SVG** (`strokeWidth` / `strokeLinejoin`), como en el resto
 * del proyecto (`Sidebar.tsx:214`, `Topbar.tsx:92`), y el color entra por `currentColor` desde un
 * token (`text-primary`); el punto usa `fill-success`. Cero colores inventados.
 */
const FORMAS = [
    // `per` = el **PERÍMETRO** del trazo, en unidades del viewBox. Es lo que el keyframe `trazo`
    // recorre con `var(--per)`, y es lo que decide el largo del dash. **Medido**, no estimado:
    // círculo 2π·31 = **194.8** · triángulo 69.8+69.8+68 = **207.6** · cuadrado 4·64 = **256** ·
    // rombo 4·45.25 = **181** (cada lado √(32²+32²)).
    { clave: 'circulo', per: 195, trazo: <circle cx="40" cy="40" r="31" />, punto: { cx: 40, cy: 9 } },
    { clave: 'triangulo', per: 208, trazo: <polygon points="40 9 74 70 6 70" />, punto: { cx: 40, cy: 10 } },
    {
        clave: 'cuadrado',
        per: 256,
        trazo: <rect x="8" y="8" width="64" height="64" rx="2" />,
        punto: { cx: 9, cy: 9 },
    },
    {
        clave: 'rombo',
        per: 181,
        trazo: <polygon points="40 8 72 40 40 72 8 40" />,
        punto: { cx: 40, cy: 9 },
    },
]

/**
 * ⭐ EL TÚNEL DE ANILLOS — el fondo del bloque de `preparando` (la espera de **1-2 minutos**).
 *
 * Es la **única pieza decorativa** del modal, y por eso va con tres candados: `aria-hidden` (no
 * existe para un lector de pantalla), **opacidad baja** (para que el texto siga mandando) y va
 * **DETRÁS** del `Spinner` + la etiqueta + el cronómetro, que son los que **informan** (SPEC §2.8).
 * Una espera larga sin nada que mirar se lee como **pantalla colgada**; esto la ambienta.
 *
 * ⚠️ Los anillos están **ANIDADOS a propósito**, y ahí está todo el truco: cada uno mide el **90 %**
 * de su padre y gira 360°, así que **las rotaciones se COMPONEN** — el anillo 2 gira al **doble**
 * de velocidad aparente que el 1, el 3 al triple… y **eso** es lo que produce el túnel. Puestos
 * **planos** (uno al lado del otro) girarían todos igual y no se vería nada.
 * ⚠️ La media luna sale de un `radial-gradient` en el `::before` de cada anillo (transparente hasta
 * el 65 %): **un anillo liso girando NO se vería** (es simétrico) — lo que se mueve es la parte
 * pintada, y por eso se nota.
 * ⚠️ **CERO keyframes nuevos:** se usa `animate-spin`, que ya existe (lo usa el propio `Spinner`),
 * solo que a **6 s** en vez de 1 s. Y el color es el **token** (`--primary`), nunca el `#000`
 * hardcodeado del snippet original (que sobre la paleta oscura sería invisible).
 */
function TunelAnillos({ className }: { className?: string }) {
    let anillo: ReactNode = null
    for (let i = 0; i < 9; i += 1) {
        anillo = (
            <span className="absolute left-[5%] top-[5%] size-[90%] animate-spin overflow-hidden rounded-full [animation-duration:6s] motion-reduce:animate-none before:absolute before:inset-x-0 before:top-0 before:block before:h-1/2 before:bg-[radial-gradient(circle,transparent_65%,oklch(var(--primary))_65%)]">
                {anillo}
            </span>
        )
    }
    return (
        <span
            aria-hidden="true"
            className={cn('pointer-events-none absolute overflow-hidden rounded-full', className)}
        >
            {anillo}
        </span>
    )
}

/**
 * ⭐ LA FORMA DE LA ETAPA — **completa y legible, con un cometa recorriéndola**.
 *
 * 🔴 2ª corrección (04 Oct 2026, el dueño): *«no me gustó cómo se ve… arreglalo bien»*. La 1ª
 * versión dejaba la figura **a medio dibujar** (el dash era medio perímetro y el hueco viajaba
 * por el contorno): el cuadrado se veía **con un pedazo faltante**, y eso se lee como **defecto**,
 * no como trabajo. Encima cada etapa traía su gimmick —el cuadrado giraba, el rombo titilaba, el
 * triángulo se balanceaba— y el conjunto quedaba ruidoso.
 *
 * Ahora son **dos capas de la MISMA figura**:
 * ① la **base**, completa y en tono apagado (`text-primary/25`): **la etapa se lee siempre, entera**;
 * ② el **cometa**, un segmento corto y brillante (22 % del contorno) que la recorre sin parar, con
 *    punta redonda y el brillo del propio token (`drop-shadow`): eso es lo que dice «trabajando».
 * ⚠️ El dash (22 %) y el hueco (78 %) suman **exactamente** el perímetro ⇒ el keyframe que va de
 *    `0` a `-per` cierra el ciclo justo y **el bucle no parpadea**.
 * ⚠️ Se fueron las variaciones por etapa: **la etapa la dice la FORMA** (círculo → triángulo →
 *    cuadrado → rombo) y el movimiento es **uno solo y limpio** para las cuatro.
 * ⚠️ `per` es el perímetro **medido** de cada figura (2π·r · suma de lados), no un número inventado.
 * ⚠️ `motion-reduce:animate-none` respeta a quien pidió menos movimiento en su sistema.
 */
function FormaFase({ paso, className }: { paso: number; className?: string }) {
    const idx = paso >= 0 && paso < FORMAS.length ? paso : 0
    const f = FORMAS[idx]
    const cometa = f.per * 0.22
    return (
        <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
            {/* ① La figura entera, apagada: la etapa se lee aunque el cometa esté en la otra punta. */}
            <g
                className="text-primary/25"
                fill="none"
                stroke="currentColor"
                strokeWidth={8}
                strokeLinejoin="round"
                strokeLinecap="round"
            >
                {f.trazo}
            </g>
            {/* ② El cometa: recorre el contorno entero y vuelve a empezar, sin costura. */}
            <g
                className="animate-trazo text-primary motion-reduce:animate-none"
                fill="none"
                stroke="currentColor"
                strokeWidth={8}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={`${cometa} ${f.per - cometa}`}
                style={{ '--per': `${f.per}px`, filter: 'drop-shadow(0 0 3px currentColor)' } as CSSProperties}
            >
                {f.trazo}
            </g>
            {/* El punto verde: dónde ARRANCA el contorno (el mismo lugar que marca el mockup). */}
            <circle className="fill-success" cx={f.punto.cx} cy={f.punto.cy} r="3" />
        </svg>
    )
}

/**
 * ⭐ LA BARRA — **4 segmentos, uno por paso**, y cada uno se pinta con el evento que llegó.
 *
 * ⚠️ Acá NO se usa la barra en bucle del snippet: una barra que va de 0 a 100 y vuelve **no mide
 * nada** y no distingue «avanzando» de «trabado». Los segmentos salen del **paso real** —el mismo
 * índice que elige la forma— así que la barra y la forma no pueden contradecirse.
 *
 * 🔴 Y el segmento que corre **no se queda quieto** (medido, 04 Oct 2026: *«las barras solo cambian
 * de color»*): lleva un **brillo que lo recorre de punta a punta**. Eso dice «acá se está
 * trabajando» **sin inventar un porcentaje** — el segmento no puede saber cuánto falta dentro del
 * paso, y una barra que finge saberlo es la mentira que este sistema prohíbe.
 */
function BarraPasos({ paso, fin }: { paso: number; fin: boolean }) {
    return (
        <span className="flex gap-[3px]" role="presentation">
            {PASOS_FORMATEO.map((p, i) => {
                const hecho = fin || i < paso
                const activo = !fin && i === paso
                return (
                    <span
                        key={p.clave}
                        className="relative h-[10px] flex-1 overflow-hidden rounded-[3px] bg-border"
                    >
                        {hecho ? <span className="block h-full w-full bg-success" /> : null}
                        {activo ? (
                            <span className="absolute inset-0 block bg-primary">
                                <span className="block h-full w-1/3 animate-brillo bg-primary-foreground/45 motion-reduce:animate-none" />
                            </span>
                        ) : null}
                    </span>
                )
            })}
        </span>
    )
}

export interface ModalFormateoProps {
    /** ¿Abierto? Lo controla el panel (SPEC §2.1: el padre manda). */
    abierto: boolean
    /** Los discos leídos, para poner en grande el que corre. */
    discos: DiscoLeido[]
    /** El progreso REAL del agente. El panel es el dueño del sondeo (ver la cabecera). */
    formato: ProgresoFormateo
    /** Segundos transcurridos: la prueba de vida mientras no hay pasos nuevos. */
    transcurrido: number
    /** ⭐ El padre perdió el contacto con el agente: se habilita la salida. */
    sinContacto: boolean
    /** Salir. El panel decide qué más hacer (refrescar la ronda, etc.). */
    onCerrar: () => void
    /** Volver a intentar con los NS que no terminaron. */
    onReintentar: () => void
}

export function ModalFormateo({
    abierto,
    discos,
    formato,
    transcurrido,
    sinContacto,
    onCerrar,
    onReintentar,
}: ModalFormateoProps) {
    const eventos = formato.eventos
    const fase = faseGlobalDe(eventos)
    const enCursoNs = nsEnCurso(eventos)
    const conNs = discos.filter((d) => !!d.serial)
    const discoEnCurso = enCursoNs ? (conNs.find((d) => d.serial === enCursoNs) ?? null) : null
    const paso = enCursoNs ? pasoDeDisco(eventos, enCursoNs) : -1

    const nsDe = (e: { ns?: string | string[] }): string =>
        Array.isArray(e.ns) ? (e.ns[0] ?? '') : (e.ns ?? '')
    const hechos = eventos
        .filter((e) => e.evento === 'listo')
        .map((e) => {
            const ns = nsDe(e)
            const ini = eventos.find((x) => x.evento === 'inicio' && nsDe(x) === ns)
            return { ns, etiqueta: ini?.etiqueta ?? null, segundos: e.segundos ?? null }
        })
    const fallados = eventos
        .filter((e) => e.evento === 'fallo' || e.evento === 'rechazo')
        .map((e) => ({ ns: nsDe(e), motivo: e.motivo ?? null }))

    const errorGlobal = errorGlobalDe(eventos)
    const corriendo = formato.estado === 'corriendo'
    /** 🔴 La regla: sin resultado y con el proceso vivo, no hay salida. */
    const puedeCerrar = !corriendo || sinContacto

    /** En qué momento está: decide el cuerpo Y el pie. */
    const momento: 'preparando' | 'corriendo' | 'terminado' | 'cortado' = sinContacto
        ? 'cortado'
        : corriendo
          ? enCursoNs
              ? 'corriendo'
              : 'preparando'
          : formato.estado === 'error' || errorGlobal || fallados.length > 0
            ? 'cortado'
            : 'terminado'

    const posicion = discoEnCurso ? conNs.findIndex((d) => d.serial === discoEnCurso.serial) + 1 : 0
    const av = discoEnCurso ? avanceDeDisco(eventos, discoEnCurso.serial ?? '') : null

    /**
     * ⭐ MEJORA 47 — la línea que explica **cada momento** es una AYUDA: se puede ocultar
     * desde el interruptor del Topbar. ⚠️ La clave depende del momento, pero `useAyuda`
     * se llama **siempre una vez** (un hook adentro de un ternario rompería el orden de
     * los hooks, que React exige idéntico en cada render).
     */
    const claveAyuda =
        momento === 'preparando'
            ? 'revision.formateo-por-que-relee'
            : momento === 'corriendo'
              ? 'revision.formateo-que-hace'
              : momento === 'terminado'
                ? 'revision.formateo-como-quedo'
                : 'revision.formateo-revisa-antes'
    const descripcion = useAyuda(claveAyuda)

    const titulo =
        momento === 'preparando'
            ? // ⭐ MEJORA 49 — la fase global manda: mientras corre la pasada única NO se
              //   puede decir «Preparando el formateo» (ya está formateando).
              fase?.clave === 'formateando'
                ? `Formateando ${formato.discos.length || conNs.length} disco${(formato.discos.length || conNs.length) === 1 ? '' : 's'}`
                : 'Preparando el formateo'
            : momento === 'corriendo'
              ? `Formateando ${formato.discos.length || conNs.length} disco${(formato.discos.length || conNs.length) === 1 ? '' : 's'}`
              : momento === 'terminado'
                ? `Listo: ${hechos.length} disco${hechos.length === 1 ? '' : 's'} formateado${hechos.length === 1 ? '' : 's'}`
                : 'El formateo se cortó'

    return (
        <Dialog
            open={abierto}
            onOpenChange={(o) => {
                // ⭐ ACÁ ESTÁ LA REGLA, en una línea: Radix avisa `false` cuando alguien intenta
                // cerrar (Esc, la ×, el velo). Mientras no haya salida, **se ignora** — el modal
                // sigue abierto. Y no alcanza con esconder la ×: `Esc` no se puede esconder.
                if (o === false && !puedeCerrar) return
                if (o === false) onCerrar()
            }}
        >
            <DialogContent
                // ⚠️ El velo NO cierra: el clic afuera se ignora (mismo patrón que el modal de revisión).
                onInteractOutside={(e) => e.preventDefault()}
                // ⭐ La × se esconde mientras no haya salida: `[&>button]` es el `<DialogPrimitive.Close>`
                // del primitivo (es su único hijo `button` directo). Es un patrón que el repo ya usa
                // (`[&>tr]` en `ui/table.tsx`, `[&>span]` en `ui/select.tsx`) y evita tocar el kit 0.8.
                className={cn(
                    'max-h-[92vh] overflow-y-auto sm:max-w-2xl',
                    !puedeCerrar && '[&>button]:hidden'
                )}
            >
                <DialogHeader className="space-y-2">
                    <div className="flex flex-row flex-wrap items-center gap-3">
                        <DialogTitle>{titulo}</DialogTitle>
                        {momento === 'corriendo' && posicion > 0 ? (
                            <span className="rounded-full bg-info/15 px-2.5 py-1 text-[12px] font-medium text-info">
                                Disco {posicion} de {conNs.length}
                            </span>
                        ) : null}
                        {momento === 'preparando' ? (
                            <span className="flex items-center gap-1.5 rounded-full bg-info/15 px-2.5 py-1 text-[12px] font-medium text-info">
                                <Spinner />
                                {/* ⭐ MEJORA 49 — la píldora dice la fase REAL: con la pasada
                                    única ya no se está «leyendo el dock», se está formateando. */}
                                {fase?.clave === 'formateando' ? 'Formateando' : 'Leyendo el dock'}
                            </span>
                        ) : null}
                    </div>
                    {/* `DialogDescription`: el modal del kit la pide para accesibilidad. Acá lleva la
                        explicación del momento — que es una AYUDA (MEJORA 47): si el usuario la apagó,
                        queda vacía y no se ve, que es el mismo criterio que la confirmación del
                        formateo (un `<p>` sin texto no se ve).
                        ⚠️ Se renderiza SIEMPRE (aunque quede vacía): Radix la usa para `aria-describedby`
                        y sacarla del árbol deja el modal sin descripción para un lector de pantalla. */}
                    <DialogDescription>{descripcion}</DialogDescription>
                </DialogHeader>

                {/* ── El disco en curso (o la fase global, que no es de ningún disco) ──── */}
                {momento === 'preparando' ? (
                    // ⭐ La espera más larga del proceso: se **ambienta** con el túnel, que va **detrás**,
                    // apagado y con `aria-hidden`. Lo que informa sigue siendo el `Spinner` + la fase +
                    // el cronómetro (SPEC §2.8): el adorno no reemplaza al dato.
                    //
                    // ⭐⭐ MEJORA 51 (06 Oct 2026) — **QUÉ SE MUESTRA MIENTRAS CORRE LA PASADA ÚNICA.**
                    // 🔴 El problema que esto arregla, medido: desde que el formateo va en **UNA sola
                    // invocación de `diskpart`** (MEJORA 49), el `.ps1` NO puede emitir `inicio`/`paso`
                    // por disco —no hay forma de saber en qué paso va mientras el proceso está
                    // bloqueado dentro de `diskpart`—, así que `momento` se queda en `'preparando'`
                    // durante los **~73-93 s** de la pasada y el modal mostraba una frase genérica:
                    // *«Formateando los discos en una sola pasada…»*. El técnico veía 73 s de nada.
                    //
                    // Lo que se muestra ahora es lo que SÍ se sabe, sin inventar ningún paso: **los
                    // discos que entraron en la pasada**, con lo que la lectura trajo de cada uno
                    // (NS, marca, modelo, capacidad, salud) y el cronómetro. ⚠️ NO se pintan los 4
                    // pasos ni una barra de avance: no hay dato que los respalde, y fingir progreso
                    // es exactamente la mentira que este modal prohíbe (SPEC §2.8). El paso por paso
                    // REAL vuelve cuando el `.ps1` sepa medirlo (sondeando el estado del disco).
                    fase?.clave === 'formateando' ? (
                        <div className="relative space-y-3 overflow-hidden rounded-md border border-acc-entradas/40 bg-acc-entradas/5 px-3 py-3">
                            <TunelAnillos className="-right-8 top-1/2 size-[200px] -translate-y-1/2 opacity-[0.18]" />
                            <div className="relative flex items-start gap-3">
                                <Spinner className="relative mt-0.5 shrink-0" />
                                <div className="relative min-w-0 flex-1">
                                    <p className="text-[14px] font-semibold">
                                        {fase.texto}{' '}
                                        <span className="font-mono text-[12px] font-normal tabular-nums text-muted-foreground">
                                            {transcurrido}s
                                        </span>
                                    </p>
                                    <p className="text-[12.5px] text-muted-foreground">{fase.detalle}</p>
                                </div>
                            </div>
                            {/* Los discos de la pasada: lo que se está preparando AHORA. */}
                            {conNs.length > 0 ? (
                                <ul className="relative space-y-1.5">
                                    {conNs.map((d) => (
                                        <li
                                            key={d.serial ?? ''}
                                            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-border/70 bg-surface-2/60 px-2.5 py-1.5"
                                            data-disco-en-pasada={d.serial ?? ''}
                                        >
                                            <span className="font-mono text-[13.5px] font-bold">{d.serial}</span>
                                            <span className="text-[12.5px] text-muted-foreground">
                                                <b className="text-foreground">{d.marca ?? '—'}</b>{' '}
                                                {d.modelo ?? ''} · {d.capacidad_texto ?? '—'} · salud{' '}
                                                <b className="text-foreground">{d.salud.puntaje ?? '—'} %</b>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            <p className="relative text-[11.5px] text-muted-foreground">
                                La etiqueta de cada disco (<span className="font-mono">DISCO_1_tit</span>,{' '}
                                <span className="font-mono">DISCO_2_tit</span>…) se asigna al terminar la
                                pasada y aparece acá abajo, con su letra.
                            </p>
                        </div>
                    ) : (
                        <div className="relative flex items-center gap-3 overflow-hidden rounded-md border border-acc-entradas/40 bg-acc-entradas/5 px-3 py-3">
                            <TunelAnillos className="-right-8 top-1/2 size-[200px] -translate-y-1/2 opacity-[0.18]" />
                            <Spinner className="relative shrink-0" />
                            <div className="relative min-w-0 flex-1">
                                <p className="text-[14px] font-semibold">
                                    {fase?.texto ?? 'Leyendo el estado del dock…'}{' '}
                                    <span className="font-mono text-[12px] font-normal tabular-nums text-muted-foreground">
                                        {transcurrido}s
                                    </span>
                                </p>
                                <p className="text-[12.5px] text-muted-foreground">{fase?.detalle}</p>
                            </div>
                        </div>
                    )
                ) : null}

                {momento === 'corriendo' && discoEnCurso ? (
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="grid size-[88px] shrink-0 place-items-center rounded-lg border border-border bg-surface-2">
                            <FormaFase paso={paso} className="size-[62px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="font-mono text-[17px] font-bold leading-tight">
                                {discoEnCurso.serial ?? '—'}
                            </p>
                            <p className="text-[12.5px] text-muted-foreground">
                                <b className="text-foreground">{discoEnCurso.marca ?? '—'}</b>{' '}
                                {discoEnCurso.modelo ?? ''} · {discoEnCurso.capacidad_texto ?? '—'} · salud{' '}
                                <b className="text-foreground">{discoEnCurso.salud.puntaje ?? '—'} %</b>
                            </p>
                        </div>
                        <div className="text-right font-mono">
                            <p className="text-[26px] font-bold leading-none tabular-nums">
                                {transcurrido}
                                <span className="text-[14px]">s</span>
                            </p>
                            <p className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                                transcurrido
                            </p>
                        </div>
                    </div>
                ) : null}

                {momento === 'corriendo' && discoEnCurso ? (
                    <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[14px] font-semibold">
                                {PASOS_FORMATEO[paso >= 0 ? paso : 0].texto}
                            </span>
                            <span className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                                paso {(paso >= 0 ? paso : 0) + 1} de {PASOS_FORMATEO.length}
                            </span>
                        </div>
                        <BarraPasos paso={paso} fin={av?.fin ?? false} />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                            {PASOS_FORMATEO.map((p, i) => {
                                const hecho = av?.fin || i < paso
                                const activo = !av?.fin && i === paso
                                return (
                                    <span
                                        key={p.clave}
                                        className={cn(
                                            'flex items-center gap-1 text-muted-foreground',
                                            hecho && 'text-success',
                                            activo && 'font-semibold text-acc-entradas'
                                        )}
                                    >
                                        <span aria-hidden="true">{hecho ? '✓' : activo ? '●' : '○'}</span>
                                        {p.texto.replace(/…$/, '')}
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                ) : null}

                {/* ── Lo que ya terminó: la fila de cada disco con su etiqueta real ───── */}
                {hechos.length > 0 && momento !== 'preparando' ? (
                    <ul className="space-y-2">
                        {hechos.map((h) => (
                            <li
                                key={h.ns}
                                className="flex flex-wrap items-center gap-2 rounded-md border border-success/35 bg-success/10 px-3 py-2 text-[12.5px]"
                            >
                                <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                                    OK
                                </span>
                                <span className="font-mono font-bold">{h.ns}</span>
                                {h.etiqueta ? (
                                    <span className="text-muted-foreground">
                                        etiqueta <b className="font-mono text-foreground">{h.etiqueta}</b>
                                    </span>
                                ) : null}
                                {h.segundos !== null ? (
                                    <span className="text-muted-foreground">· {h.segundos} s</span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}

                {/* ── El corte: el error global, el aviso del agente o la pérdida de contacto ── */}
                {momento === 'cortado' || errorGlobal || formato.aviso ? (
                    <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                            {sinContacto ? (
                                <>
                                    <b>Se perdió el contacto con el lector</b>
                                    {discoEnCurso ? (
                                        <>
                                            {' '}
                                            en el disco <span className="font-mono">{discoEnCurso.serial}</span>
                                        </>
                                    ) : null}
                                    {paso >= 0 ? (
                                        <>
                                            {' '}
                                            (paso <b>{PASOS_FORMATEO[paso].texto.replace(/…$/, '')}</b>)
                                        </>
                                    ) : null}
                                    . El proceso puede seguir corriendo en la PC, pero la pantalla dejó de
                                    recibir avisos.
                                </>
                            ) : (
                                (errorGlobal ?? formato.aviso ?? 'El formateo no se pudo completar.')
                            )}
                        </span>
                    </p>
                ) : null}

                {fallados.length > 0 && momento !== 'corriendo' ? (
                    <ul className="space-y-1.5 text-[12.5px] text-muted-foreground">
                        {fallados.map((f) => (
                            <li key={`f-${f.ns}`} className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold text-foreground">{f.ns}</span>
                                <span>no se completó{f.motivo ? `: ${f.motivo}` : ''}</span>
                            </li>
                        ))}
                    </ul>
                ) : null}

                {/* ── El resumen del cierre ─────────────────────────────────────────── */}
                {momento === 'terminado' && formato.resumen ? (
                    <p className="text-[12.5px] text-muted-foreground">
                        Terminó:{' '}
                        <b className="text-success">{formato.resumen.ok ?? 0} listo(s)</b>
                        {(formato.resumen.fallaron ?? 0) > 0 ? (
                            <>
                                {' · '}
                                <b className="text-destructive">{formato.resumen.fallaron} con falla</b>
                            </>
                        ) : null}
                        {(formato.resumen.rechazados ?? 0) > 0 ? (
                            <>
                                {' · '}
                                <b className="text-warning">{formato.resumen.rechazados} sin tocar</b>
                            </>
                        ) : null}
                    </p>
                ) : null}

                {/* ⚠️ El aviso de que NO hay salida, mientras no la haya: sin esto el botón apagado
                    se lee como un defecto de la pantalla en vez de una regla. */}
                {!puedeCerrar ? (
                    <p className="rounded-md border border-warning/45 bg-warning/10 px-3 py-2 text-[12.5px]">
                        🔒 <b>No se puede cerrar todavía.</b>{' '}
                        <Ayuda k="revision.formateo-no-se-cierra" inline />
                    </p>
                ) : null}

                <DialogFooter className="gap-2">
                    {puedeCerrar ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-[52px] px-5 text-[15px]"
                            onClick={onCerrar}
                            data-accion="cerrar-formateo"
                        >
                            Cerrar
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-[52px] px-5 text-[15px]"
                            disabled
                            title="El formateo está corriendo: cerrar ahora dejaría el disco a medio formatear."
                        >
                            Cancelar
                        </Button>
                    )}

                    {momento === 'terminado' ? (
                        <Button
                            type="button"
                            className="min-h-[56px] px-6 text-[16px] font-semibold"
                            onClick={onCerrar}
                            data-accion="volver-revision"
                        >
                            Volver a la revisión
                        </Button>
                    ) : momento === 'cortado' ? (
                        <Button
                            type="button"
                            className="min-h-[56px] px-6 text-[16px] font-semibold"
                            onClick={onReintentar}
                            data-accion="reintentar-formateo"
                        >
                            Reintentar
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            className="min-h-[56px] px-6 text-[16px] font-semibold"
                            disabled
                            data-accion="formateando"
                        >
                            <Spinner className="mr-2 text-primary-foreground" />
                            {/* ⭐ MEJORA 51 — el botón dice la fase REAL, no el `momento`: con la
                                pasada única el `momento` sigue siendo `'preparando'` mientras
                                diskpart formatea, y el botón decía «Preparando…» durante 73 s. */}
                            {fase?.clave === 'formateando' ? 'Formateando…' : 'Preparando…'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
