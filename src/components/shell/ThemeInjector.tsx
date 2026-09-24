// ═══════════════════════════════════════════════════════════════════════════════
// THEME INJECTOR — Guía 0.6 · SERVER COMPONENT (sin 'use client')
//
// Aplica el tema ANTES del primer pintado. Sin esto:
//   HTML sin data-theme → se pinta Obsidiana → hidrata → useEffect aplica
//   'piedra' → repinta claro  ⇒  destello visible en CADA carga.
//
// El <script> inline corre durante el parseo del documento; un useEffect corre
// después de hidratar, que es después de pintar. Por eso tiene que ser script.
//
// ⚠️ FIX 02 Sep 2026 — el guard anterior (headers 'rsc' / accept
//    'text/x-component') NUNCA funcionó: Next.js 16 filtra los headers internos
//    de vuelo (`rsc`, `next-*`) del objeto `headers()` — verificado con el
//    servidor real (31 Ago 2026). El <script> viajaba en los payloads flight y
//    React 19 denunciaba en consola "Encountered a script tag while rendering
//    React component" al materializarlo en el cliente durante navegaciones SPA
//    (login → /dashboard). En F5 el warning NO aparece: la hidratación no crea
//    el elemento.
//    La señal confiable es el Accept: una navegación de documento SIEMPRE trae
//    `text/html` (el browser lo manda en todo request de documento); los fetch
//    de vuelo del router (SPA, prefetch, server actions) traen `*/*`
//    (sec-fetch-dest: empty). Con esto el script solo existe en el HTML inicial
//    y React nunca lo crea en el cliente.
//    NO usar guards tipo `typeof window` ni 'use client': romperían la
//    hidratación (HTML del servidor con el <script> vs cliente devolviendo null).
//
// ⚠️ NO toca la clase `dark`: next-themes la administra con su propio script y
//    habría forcejeo. La sincronización la hace ThemeToggler al montar.
// ═══════════════════════════════════════════════════════════════════════════════

import { headers } from 'next/headers'
import { TEMAS, TEMA_DEFAULT, type TemaValue } from '@/types/shell'

interface ThemeInjectorProps {
    /** Ya validado con esTemaValido() en el layout. */
    tema: TemaValue
}

export async function ThemeInjector({ tema }: ThemeInjectorProps) {
    const headersList = await headers()

    // Solo el HTML inicial necesita el script (anti-FOUC). El browser manda
    // `Accept: text/html,...` en toda navegación real de documento; los fetch de
    // vuelo del router (SPA, prefetch, server actions) mandan `*/*`. Si no es
    // documento HTML, el data-theme ya está aplicado en el DOM: no inyectar nada
    // evita que React cree el <script> en el cliente (dev warning) y no hace
    // falta ejecutarlo.
    const esDocumentoHTML = (headersList.get('accept') || '').includes('text/html')
    if (!esDocumentoHTML) return null

    const definicion = TEMAS.find((t) => t.id === tema) ?? TEMAS.find((t) => t.id === TEMA_DEFAULT)!

    // ⚠️ Sobre dangerouslySetInnerHTML: los valores NO vienen del usuario.
    // Salen de la constante TEMAS (3 literales fijos del código fuente) y el
    // layout ya filtró lo que llega de la BD con esTemaValido(). Encima se
    // serializan con JSON.stringify, que escapa comillas y barras.
    const script = [
        '(function(){try{',
        'var d=document.documentElement;',
        'var dt=' + JSON.stringify(definicion.dataTheme) + ';',
        // Obsidiana vive en :root SIN atributo — por eso null significa "quitar".
        'if(dt){d.setAttribute("data-theme",dt);}else{d.removeAttribute("data-theme");}',
        // Alinea la clave que introdujo el ThemeSwitcher de la Guía 0.1 con la BD.
        'try{localStorage.setItem("app-palette",' + JSON.stringify(definicion.id) + ');}catch(e){}',
        // Un fallo aquí NUNCA debe romper la página: peor caso, tema por defecto.
        '}catch(e){}})();',
    ].join('')

    return <script dangerouslySetInnerHTML={{ __html: script }} />
}
