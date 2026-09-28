// ═══════════════════════════════════════════════════════════════════════════════
// MOTOR DE PLANTILLAS — interpolación + saneado (Guía 2.1 · P6)
//
// El ÚNICO punto de saneado del proyecto (decisión 2 de la Parte 0). Una plantilla
// es HTML guardado en la BD: sin sanear, es un vector de XSS dentro de la propia app.
// El papel ya es la excepción declarada del sistema de tokens (SPEC §2.1.d) y ahí se
// aísla; el saneado se aísla aquí.
//
// ⚠️ DOMPurify es DOM-ONLY: este archivo se importa SIEMPRE desde componentes de
// cliente. Por eso NO se instala `jsdom` (decisión 3 de la Parte 0) — el saneado
// corre en el punto de pintado, con el DOM real.
//
// Marcadores (documentados abajo, junto a los regex): {{clave}} · {{#clave}}…{{/clave}}
// · {{^clave}}…{{/clave}} — minúsculas, números y guion bajo: el mismo vocabulario que
// el esquema declarado de variables.
// ═══════════════════════════════════════════════════════════════════════════════

import DOMPurify from 'dompurify'

/**
 * Un valor de documento. Los documentos son **planos** (`{{clave}}`) salvo las
 * **listas** — las partidas de una nota, sus pagos —, que se pasan como arreglos de
 * objetos y se recorren con **secciones**.
 */
export type ValorVariable = string | number | boolean | null | undefined

export type VariablesDocumento = Record<
    string,
    ValorVariable | Array<Record<string, ValorVariable>>
>

/**
 * Subconjunto permitido de HTML. Es lo que un documento de negocio necesita para
 * maquetarse — ni `<script>`, ni `<iframe>`, ni `<form>`, ni atributos `on*`.
 * ⚠️ AMPLIAR ESTA LISTA AMPLÍA EL VECTOR DE ENTRADA DEL PAPEL.
 */
const TAGS_PERMITIDOS = [
    'div', 'span', 'p', 'section', 'header', 'footer', 'figure', 'figcaption',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup', 'mark',
    'br', 'hr', 'img', 'blockquote', 'pre', 'code',
]

const ATRIBUTOS_PERMITIDOS = [
    'class', 'style', 'colspan', 'rowspan', 'scope',
    'src', 'alt', 'width', 'height',
]

// ── Los 3 marcadores del motor ────────────────────────────────────────────────
//   {{clave}}             → el VALOR, escapado. Un dato nunca se vuelve marcado.
//   {{#clave}}…{{/clave}} → SECCIÓN: si `clave` es un arreglo, repite el bloque por
//                           cada elemento (sus campos quedan en alcance); si es
//                           verdadero, pinta el bloque una vez; si es vacío, nada.
//   {{^clave}}…{{/clave}} → SECCIÓN INVERTIDA: pinta el bloque cuando `clave` está
//                           vacío — es el «sin pagos registrados» del papel.
const REGEX_INVERTIDA = /\{\{\^([a-z][a-z0-9_]*)\}\}([\s\S]*?)\{\{\/\1\}\}/g
const REGEX_SECCION = /\{\{#([a-z][a-z0-9_]*)\}\}([\s\S]*?)\{\{\/\1\}\}/g
const REGEX_VALOR = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g

/** Escapa un valor para que un DATO nunca se convierta en marcado. */
function escapar(valor: string): string {
    return valor
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/** Vacío = ausente, nulo, falso, cadena vacía o arreglo sin elementos. */
function esVacio(v: unknown): boolean {
    return (
        v === null ||
        v === undefined ||
        v === false ||
        v === '' ||
        (Array.isArray(v) && v.length === 0)
    )
}

/**
 * Resuelve el cuerpo contra un alcance. RECURSIVO: una sección dentro de otra se
 * resuelve sola mientras las claves sean distintas (el `\1` del cierre ata cada
 * apertura con su propio cierre).
 *
 * El orden importa: las SECCIONES primero y los VALORES al final — así el texto que
 * una sección ya resolvió no se vuelve a interpretar.
 */
function interpolar(cuerpo: string, alcance: Record<string, unknown>): string {
    let out = cuerpo.replace(REGEX_INVERTIDA, (_todo, clave: string, dentro: string) =>
        esVacio(alcance[clave]) ? interpolar(dentro, alcance) : ''
    )

    out = out.replace(REGEX_SECCION, (_todo, clave: string, dentro: string) => {
        const v = alcance[clave]
        if (Array.isArray(v)) {
            return v
                .map((item) => interpolar(dentro, { ...alcance, ...(item as Record<string, unknown>) }))
                .join('')
        }
        return esVacio(v) ? '' : interpolar(dentro, alcance)
    })

    return out.replace(REGEX_VALOR, (_todo, clave: string) => {
        const v = alcance[clave]
        if (v === null || v === undefined) return ''
        // Un marcador de valor sobre una lista no significa nada: se pinta vacío en vez
        // de «[object Object]».
        if (typeof v === 'object') return ''
        return escapar(String(v))
    })
}

/**
 * ⭐ LA PUERTA ÚNICA: interpola y sanea.
 *
 * @param cuerpo   El `cuerpo` de `plantillas_documento` (HTML con los 3 marcadores).
 * @param variables Los datos del documento, ya resueltos por quien imprime. La
 *                  plantilla PINTA: los totales, el redondeo y los folios llegan
 *                  calculados (ley L6 — un solo lugar por cifra).
 * @returns HTML seguro, listo para inyectar.
 */
export function renderPlantilla(cuerpo: string, variables: VariablesDocumento): string {
    const conDatos = interpolar(cuerpo, { ...variables })
    return DOMPurify.sanitize(conDatos, {
        ALLOWED_TAGS: TAGS_PERMITIDOS,
        ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
        // Sin `data:` en imágenes: un `src` con data-URI es un canal de exfiltración.
        ALLOW_DATA_ATTR: false,
    })
}
