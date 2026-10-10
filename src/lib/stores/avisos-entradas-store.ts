// ═══════════════════════════════════════════════════════════════════════════════
// AVISOS ENTRADAS STORE — Guía 1.6 · MEJORA 53 (09 Oct 2026)
//
// El telégrafo entre el AVISO en tiempo real y las COLAS del módulo.
//
// ── EL PROBLEMA QUE RESUELVE ───────────────────────────────────────────────────
// `AvisosEntradas` —quien escucha Realtime— se monta UNA vez en el layout del
// dashboard, y las colas son hermanas suyas en el árbol de React: **no hay props
// que bajen**. Es exactamente el problema que `page-context-store` resolvió para
// el Shell, y la respuesta es la misma: un canal.
//
// El escucha PUBLICA un contador por etapa; cada cola lo mete en las
// dependencias del efecto con el que ya carga su lista ⇒ al subir, re-consulta.
//
// ⚠️ Es un CONTADOR y no una lista de filas: la cola no necesita saber QUÉ
//    cambió (su propia Server Action trae la verdad fresca cuando vuelve a
//    consultar); necesita saber que su consulta quedó vieja. Un contador además
//    es idempotente ante eventos repetidos —Realtime puede reentregar un evento
//    al reconectar— y no guarda filas de etapas ajenas.
//
// ⚠️ SIN persist, con el mismo criterio que `page-context-store`: un contador
//    persistido dispararía una recarga al arrancar por un cambio que la primera
//    consulta ya refleja. Y sin persist NO hace falta `useSyncExternalStore` —ese
//    rodeo existe por el hydration mismatch de `auth-store`, que sí persiste—:
//    el estado inicial (todos en 0) es idéntico en el servidor y en la primera
//    pintada del cliente, así que no hay nada que desincronizar.
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'

import type { EtapaEntradas } from '@/lib/avisos-entradas'

type Contadores = Record<EtapaEntradas, number>

const CERO: Contadores = {
    recepcion: 0,
    revision: 0,
    acondicionamiento: 0,
    almacen: 0,
    divergencias: 0,
}

/**
 * ⭐ MEJORA 54 (09 Oct 2026) — **TOPE de la lista de «llegaron en vivo».**
 * La lista es de la SESIÓN y solo sirve para decidir si una fila lleva el
 * **pulso**; sin tope, un turno largo (o una siembra masiva) la haría crecer sin
 * techo y cada `includes` de cada celda recorrería una lista cada vez más larga.
 */
const TOPE_EN_VIVO = 200

interface AvisosEntradasState {
    /** Sube en 1 por cada evento que dejó trabajo nuevo en esa etapa. */
    contadores: Contadores
    /**
     * ⭐ MEJORA 54 — ids de `entradas` que llegaron por Realtime **en esta sesión**
     * (el «llegó mientras mirabas» del mockup: la opción **A** del pulso).
     */
    nuevasEnVivo: string[]
    /** Lo llama el escucha (`AvisosEntradas`); las colas solo lo LEEN. */
    publicar: (etapas: EtapaEntradas[]) => void
    /** Lo llama el escucha cuando NACE una entrada (`INSERT` de `entradas`). */
    marcarNuevaEnVivo: (idEntrada: string) => void
    /** Lo llama la cola cuando el operario ABRE la entrada: el pulso se apaga. */
    apagarNuevaEnVivo: (idEntrada: string) => void
}

export const useAvisosEntradasStore = create<AvisosEntradasState>()((set, get) => ({
    contadores: CERO,
    nuevasEnVivo: [],

    publicar: (etapas) => {
        // Guarda barata: no se escribe el store por un evento que no dejó trabajo.
        if (etapas.length === 0) return
        set((s) => {
            const siguiente = { ...s.contadores }
            for (const etapa of etapas) siguiente[etapa] += 1
            return { contadores: siguiente }
        })
    },

    marcarNuevaEnVivo: (idEntrada) => {
        if (!idEntrada) return
        // ⚠️ Se pregunta ANTES de `set`: un `set` que devuelve el mismo estado
        // despierta igual a los suscriptores, y esto corre por CADA evento.
        if (get().nuevasEnVivo.includes(idEntrada)) return
        set((s) => {
            const siguiente = [...s.nuevasEnVivo, idEntrada]
            return {
                nuevasEnVivo:
                    siguiente.length > TOPE_EN_VIVO ? siguiente.slice(-TOPE_EN_VIVO) : siguiente,
            }
        })
    },

    apagarNuevaEnVivo: (idEntrada) => {
        if (!idEntrada) return
        if (!get().nuevasEnVivo.includes(idEntrada)) return
        set((s) => ({ nuevasEnVivo: s.nuevasEnVivo.filter((id) => id !== idEntrada) }))
    },
}))

/**
 * El contador de UNA etapa. Es la única línea que una cola necesita para estar
 * viva: se mete en las dependencias de su efecto de carga y con eso alcanza.
 *
 * @example
 * const refresco = useContadorEtapa('revision')
 * useEffect(() => { … }, [filtros, pagina, tamano, refresco])
 */
export function useContadorEtapa(etapa: EtapaEntradas): number {
    return useAvisosEntradasStore((s) => s.contadores[etapa])
}

/**
 * ⭐ MEJORA 54 — ¿esta fila llegó **en vivo** en esta sesión? (la opción **A**).
 * Devuelve un **booleano**, no la lista: así la celda solo se vuelve a pintar
 * cuando SU fila cambia, y no cada vez que entra una entrada cualquiera.
 */
export function useEsNuevaEnVivo(idEntrada: string): boolean {
    return useAvisosEntradasStore((s) => s.nuevasEnVivo.includes(idEntrada))
}
