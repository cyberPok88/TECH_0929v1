'use server'

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — EMPRESA (Guía 2.1 · P7 · 27 Sep 2026)
//
// ⭐ EL PRIMER LECTOR de `public.empresa_emisora` del proyecto. Medido el 27 Sep 2026:
// la tabla existe desde la Guía 0.4 con su fila única, la pantalla
// `/dashboard/sistema/empresa` no la lee, y las 2 plantillas vivas de la 1.6 llevan el
// membrete HARDCODEADO. El dato bueno estaba en la base y nadie lo usaba.
//
// El membrete encabeza TODO documento impreso: notas de entrada, actas, notas de
// compra, cotizaciones y notas de remisión. Por eso la acción vive en su dominio
// (`empresa`), no dentro de las acciones de plantillas.
//
// ⚠️ Devuelve `null` si la fila no está: NO es un error — es «membrete sin
// configurar», y el papel tiene que poder imprimirse sin encabezado.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server'
import type { MembreteDocumento } from '@/types/empresa'

const COLUMNAS_MEMBRETE = [
    'razon_social', 'nombre_comercial', 'rfc', 'codigo_postal',
    'direccion', 'colonia', 'ciudad', 'estado',
    'telefono', 'email', 'sitio_web', 'logo_url',
].join(',')

/**
 * El membrete de la empresa emisora (fila única).
 *
 * `null` ⇒ no hay membretes configurado; el documento se imprime sin encabezado.
 * No lanza: la ausencia es un estado, no una excepción (mismo criterio que el
 * registro de plantillas).
 */
export async function obtenerMembrete(): Promise<MembreteDocumento | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('empresa_emisora')
        .select(COLUMNAS_MEMBRETE)
        .limit(1)
        .maybeSingle()

    if (error || !data) return null
    return data as unknown as MembreteDocumento
}
