// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — SAT (Guía 1.1 · Parte 3)
// Lecturas de catálogos SAT que alimentan formularios. Hoy solo
// sat_regimenes_fiscales (opciones del Select Fiscal del proveedor);
// crecerá cuando Clientes 1.3 y la facturación (V2) lo necesiten.
// Retorna objetos tipados — nunca throw (patrón 0.9).
// ═══════════════════════════════════════════════════════════════════════════════

'use server'

import { createClient } from '@/lib/supabase/server'
import type { RespuestaLista } from '@/types/proveedores'

/** Opción del Select de régimen fiscal (label = descripción SAT). */
export interface RegimenFiscalOpcion {
    id: string
    clave: string
    descripcion: string
}

export async function listarRegimenesFiscalesActivos(): Promise<
    RespuestaLista<RegimenFiscalOpcion>
> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('sat_regimenes_fiscales')
        .select('id, clave, descripcion')
        .eq('es_activo', true)
        .order('clave', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as RegimenFiscalOpcion[] }
}
