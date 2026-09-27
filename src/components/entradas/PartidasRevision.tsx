'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS DE REVISIÓN — desglose de la cola del técnico (Guía 1.6 · Fase 2)
//
// ⭐ MEJORA 24 Sep 2026 — el desglose dejó de ser el espejo del acordeón de la V5
// (`listarEntradasRevConPartidas`: Partida · Producto · Recibidas · Revisadas · Restantes ·
// Estado) y pasó a contar **la evolución de la información**: lo que Recepción DECLARÓ y lo que
// la Revisión CONSTRUYÓ. Es el pedido del usuario: *«el objetivo de esa fase es revisar pieza por
// pieza … lo importante es cómo evoluciona la información que se hizo en entradas»*.
//
//   ② la DEV dice **cuántas** —«2 malas», no «Con malas»— y su píldora **es botón**: abre la
//      devolución. Mismo patrón que `crearColumnaDevolucion` de Recepción (MEJORA 12: la píldora
//      no cambia de forma, se envuelve).
//   ③ el avance se lee con **barra de 3 tramos** (aprobadas · DEV · pendientes), como el desglose
//      de Recepción, no con un número suelto: con 200 piezas una barra por pieza no escala.
//   · la huella resuelta (marca + atributos nuevos) va **debajo** de la declarada.
//
// Diseño aprobado: `DOCS/design/entradas/revision-puesto-tactil.html` §3.
// ⚠️ La huella de una partida puede ser VARIAS (una partida de 100 discos puede rendir 2TB y 4TB):
// se pintan todas — elegir una sería mentir sobre lo aprobado.
//
// ⭐ EXTRACCIÓN 24 Sep 2026 — la tabla + el timeline viven en `PartidasAvance` (presentacional),
// para que la MISMA superficie se pueda abrir en **solo lectura** desde Recepción
// (`AvanceRevisionModal`: la píldora «En revisión técnica» es la puerta). Aquí queda lo que es de
// esta cola: la carga de datos, el **riel de acento + sangría de 56px** que la anida a la fila del
// padre, y las tres puertas por partida (Iniciar · Liberar · Ver resultado) + la DEV.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'

import { listarPartidasConAvance } from '@/lib/actions/entradas'
import { PartidasAvance } from '@/components/entradas/PartidasAvance'
import type { Entrada, PartidaConAvance } from '@/types/entradas'

interface PartidasRevisionProps {
    entrada: Entrada
    /** Abre el wizard de revisión en esa partida. */
    onIniciar: (idPartida: string) => void
    /** ⭐ ② Abre la DEVOLUCIÓN de esa partida (la píldora «n malas» es botón). */
    onVerDev: (entrada: Entrada, idPartida: string) => void
    /** Abre el resultado de la revisión (partida ya cerrada). */
    onVerResultado: (entrada: Entrada) => void
    /**
     * ⭐ MEJORA 25/30 — libera a acondicionamiento lo aprobado, en tres profundidades y **el mismo
     * modal**: la LÍNEA (su grupo), la PARTIDA (`idPartida`) y la ENTRADA entera (`null` → sin
     * filtro). Es lo que evita abrir el modal una vez por partida en una entrada de 20 partidas.
     */
    onLiberar: (entrada: Entrada, idPartida: string | null, idGrupo?: string) => void
    /**
     * ⭐ FIX 25 Sep 2026 (30-bis) — **puesto de dedo**: lo enciende la cola que se opera con el dedo
     * (Revisión) para que las puertas del desglose midan **44** y no el `sm` del kit (32). Quien pinta
     * los controles es `PartidasAvance`.
     */
    tactil?: boolean
}

export function PartidasRevision({
    entrada,
    onIniciar,
    onVerDev,
    onVerResultado,
    onLiberar,
    tactil = false,
}: PartidasRevisionProps) {
    const [partidas, setPartidas] = useState<PartidaConAvance[]>([])
    const [cargando, setCargando] = useState(true)

    useEffect(() => {
        let activo = true
        void listarPartidasConAvance(entrada.id).then((r) => {
            if (!activo) return
            if (r.success) setPartidas(r.data ?? [])
            setCargando(false)
        })
        return () => {
            activo = false
        }
    }, [entrada.id])

    return (
        // ⭐ 24 Sep 2026 (usuario) — el desglose se ANIDA al padre y se ve que es suyo: **riel** de
        // acento a la izquierda + **sangría de 56px**, que es justo el ancho de la columna del
        // chevron (`w-12 md:w-10` + `px-3` de la fila expandida del kit) → la tabla hija arranca
        // alineada con la columna Folio del padre, como un hijo en un árbol. Más el ancho tope:
        // antes medía lo mismo que la tabla padre y no se leía como «esto pertenece a la fila de
        // arriba» (*«que realmente se vea quién es el padre y cuáles sus detalles»*).
        <div className="flex max-w-[1080px] flex-col gap-3 border-l-2 border-acc-entradas/50 pl-14 pr-2">
            <PartidasAvance
                entrada={entrada}
                partidas={partidas}
                cargando={cargando}
                tactil={tactil}
                onIniciar={onIniciar}
                onVerDev={onVerDev}
                onVerResultado={onVerResultado}
                onLiberar={onLiberar}
            />
        </div>
    )
}
