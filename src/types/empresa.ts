// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — EMPRESA (Guía 2.1 · P7 · 27 Sep 2026)
// Espejo LITERAL de public.empresa_emisora (fila única, UUID …0001 ·
// ESQUEMA_BD.md §169 · MODELO_DATOS §6.3).
//
// Los nombres snake_case son contrato con la BD: renombrar uno imprime el
// membrete vacío sin romper el build (CLAUDE.md, regla 4).
//
// ⚠️ NO pertenece al dominio de plantillas: es de la EMPRESA. Mañana lo consumirán
// `/dashboard/sistema/empresa`, los PDFs de cotización y los de venta. Por eso vive
// en su propio archivo y no dentro de `types/plantillas.ts`.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El membrete: los datos de la empresa que encabezan TODO documento impreso.
 * Todo es `string | null` porque así está la tabla — un membrete a medio cargar es
 * un estado real y el papel tiene que poder imprimirse igual.
 */
export interface MembreteDocumento {
    razon_social: string | null
    nombre_comercial: string | null
    rfc: string | null
    codigo_postal: string | null
    direccion: string | null
    colonia: string | null
    ciudad: string | null
    estado: string | null
    telefono: string | null
    email: string | null
    sitio_web: string | null
    logo_url: string | null
}
