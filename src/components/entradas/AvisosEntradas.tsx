'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AVISOS ENTRADAS — Guía 1.6 · MEJORA 53 (09 Oct 2026)
//
// EL ESCUCHA. Vive montado UNA vez —en `app/dashboard/layout.tsx`, junto al
// Topbar— y no pinta nada: lo que hace es escuchar la base de datos por Realtime
// y avisar por toast al operario al que le acaba de caer trabajo.
//
// ── EL PEDIDO DEL DUEÑO (verbatim, 09 Oct 2026) ────────────────────────────────
// *«cuando se genera una entrada, y el usuario que tiene su vista de revisión
// técnica no se entera de que hay una revisión hasta que recarga la página …
// ¿se puede que al momento que se genere la entrada avisarle al usuario que ya
// tiene trabajo?»*
//
// ── POR QUÉ NO HAY TABLA DE NOTIFICACIONES ────────────────────────────────────
// La RLS ya hace el reparto y Realtime la respeta: `entradas_select` autoriza a
// quien tenga `ver` en cualquiera de las etapas del módulo, así que el evento
// solo llega a quien puede ver la fila. **Cero tablas, cero columnas, cero
// políticas nuevas** (el `§2.12` de `bd-entradas.md` lo documenta). La tabla
// persistente —la que sobrevive a la pestaña cerrada— sigue diferida a propósito
// (`FLUJO_01 §9.2/§11`: *«MVP muestra badges/vistas en el shell»*).
//
// ⚠️ REALTIME NO REEMPLAZA A LA CARGA INICIAL, la complementa: si el aviso se
//    pierde (pestaña cerrada, socket caído), la cola se re-consulta al abrir. Lo
//    único que se pierde es el aviso, nunca el trabajo.
//
// ⚠️ ACÁ NO SE DECIDE A QUIÉN LE TOCA: eso vive en `lib/avisos-entradas.ts`, que
//    es puro y tiene pruebas (`tests/avisos-entradas.test.ts`). Este componente
//    solo transporta: sesión, canal, permisos y toast.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/stores/auth-store'
import { useAvisosEntradasStore } from '@/lib/stores/avisos-entradas-store'
import {
    avisosDeEntrada,
    avisosDeLiberacion,
    ETIQUETA_ETAPA,
    RUTA_ETAPA,
    type AvisoEntrada,
    type FilaEntrada,
    type FilaLiberacion,
} from '@/lib/avisos-entradas'

/**
 * ⚠️ 10 s y no los 4 de fábrica: son avisos OPERATIVOS (hay trabajo esperando), no
 * confirmaciones de una acción que el usuario acaba de hacer. El toast trae la
 * acción «Ir a …», y con 4 segundos el técnico que está con las manos en una
 * pieza llega tarde a leerlo.
 */
const DURACION_AVISO_MS = 10_000

export function AvisosEntradas() {
    const router = useRouter()
    const idUsuario = useAuth((s) => s.usuario?.id ?? null)
    // ⚠️ `puedeVerPagina` es un MÉTODO del store (referencia estable): el mismo
    //    evento llega a los cinco roles del módulo porque la RLS deja leer la fila
    //    a todos, y es acá donde se acota a las etapas que ESTE usuario puede abrir.
    //    De paso resuelve el caso general de «no te aviso de tu propio trabajo»:
    //    Recepción no tiene `ver` en Revisión, así que no se avisa de lo que creó.
    const puedeVerPagina = useAuth((s) => s.puedeVerPagina)
    const publicar = useAvisosEntradasStore((s) => s.publicar)
    // ⭐ MEJORA 54 — el documento que NACE deja su id en el store: es lo que hace
    // que su fila lleve el PULSO («llegó mientras mirabas»), además de la marca por
    // recencia que se calcula sola desde `created_at`.
    const marcarNuevaEnVivo = useAvisosEntradasStore((s) => s.marcarNuevaEnVivo)

    useEffect(() => {
        if (!idUsuario) return

        const supabase = createClient()
        let cancelado = false
        let canal: ReturnType<typeof supabase.channel> | null = null

        /** Avisa SOLO lo que este usuario puede atender, y despierta su cola. */
        const anunciar = (avisos: AvisoEntrada[]) => {
            const mios = avisos.filter((a) => puedeVerPagina(RUTA_ETAPA[a.etapa]))
            if (mios.length === 0) return

            // Primero el canal (la cola se recarga aunque el toast no se lea).
            publicar(mios.map((a) => a.etapa))

            for (const aviso of mios) {
                toast.info(aviso.titulo, {
                    // El `id` sella el aviso: el mismo evento reentregado —Realtime
                    // puede repetirlo al reconectar— NO apila un toast duplicado.
                    id: aviso.clave,
                    description: aviso.detalle,
                    duration: DURACION_AVISO_MS,
                    action: {
                        label: `Ir a ${ETIQUETA_ETAPA[aviso.etapa]}`,
                        onClick: () => router.push(RUTA_ETAPA[aviso.etapa]),
                    },
                })
            }
        }

        void (async () => {
            // ⚠️ La sesión va ANTES de suscribir, y no es ceremonia: Realtime evalúa
            //    la RLS con el JWT del socket. Si el canal se une sin claims, no
            //    recibe NADA y falla en silencio (sin error, sin evento).
            const { data: { user } } = await supabase.auth.getUser()
            if (cancelado || !user) return

            canal = supabase
                .channel('avisos-entradas')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'entradas' },
                    (payload) => {
                        // ⭐ MEJORA 54 — un `INSERT` de `entradas` es el documento que NACE:
                        // esa fila es «la que acaba de llegar». Solo el INSERT: un UPDATE
                        // mueve una entrada que ya existía, y marcarla como recién llegada
                        // sería mentir sobre cuándo entró.
                        if (payload.eventType === 'INSERT') {
                            marcarNuevaEnVivo((payload.new as FilaEntrada).id)
                        }
                        anunciar(avisosDeEntrada(payload.new as FilaEntrada, payload.eventType))
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'liberaciones_entrada' },
                    (payload) =>
                        anunciar(
                            avisosDeLiberacion(payload.new as FilaLiberacion, payload.eventType)
                        )
                )
                .subscribe()
        })()

        return () => {
            cancelado = true
            // Sin esto, cada re-montaje (StrictMode en desarrollo, cambio de sesión)
            // dejaría un canal vivo: los avisos llegarían multiplicados.
            if (canal) void supabase.removeChannel(canal)
        }
    }, [idUsuario, puedeVerPagina, publicar, marcarNuevaEnVivo, router])

    // No pinta nada: es un escucha. Su efecto visible es el toast y la recarga de
    // las colas (vía el store).
    return null
}
