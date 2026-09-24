// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN THEME INJECTOR — Remasterización Fase 3 (Guía 0.11) · Server Component
//
// Aplica TEMA_LOGIN al data-theme ANTES del primer pintado en el área de login.
// Espejo del ThemeInjector del dashboard (0.6), pero sin leer BD: aquí no hay
// sesión y la paleta de arranque es una CONSTANTE del código (types/shell.ts).
//
// ⭐ MEJORA 22 Sep 2026 (decisión del usuario) — el login arranca SIEMPRE en
//    Obsidiana (TEMA_LOGIN), no en TEMA_DEFAULT. Antes forzaba Piedra Solar
//    mientras el LoginThemeSwitcher resaltaba la paleta guardada en
//    localStorage['theme']: el círculo marcaba una paleta y la página pintaba
//    otra. Ahora la constante es una sola y los dos la respetan.
//    Obsidiana vive en :root SIN atributo → el script lo QUITA (no escribe
//    data-theme="obsidiana", que no existe en globals.css).
//    La elección pre-login no sobrevive a la recarga; el clic en el switcher sí
//    aplica y resalta la paleta elegida hasta la siguiente carga completa.
//
// ⚠️ FIX 22 Sep 2026 — el supuesto anterior ("el login nunca se navega por SPA,
//    así que el script solo existe en el HTML inicial y no se materializa en el
//    cliente") era FALSO, y se comprobó midiendo contra el servidor real:
//    `curl -H "RSC: 1" /login` devolvía el <script> DENTRO del payload de vuelo
//    (2 ocurrencias de data-theme en la respuesta de 27 KB), así que React 19 lo
//    denunciaba al CREARLO en el cliente — "Encountered a script tag while
//    rendering React component" (react-dom-client.development.js · completeWork ·
//    case "script"). Se dispara con cualquier render en cliente de esta pantalla:
//    navegar de /login a /login/recuperar (o /login/reset) por <Link>, un
//    prefetch + navegación, o un Fast Refresh en dev.
//
//    La señal confiable es el Accept: una navegación de documento SIEMPRE trae
//    `text/html` (el browser lo manda en todo request de documento); los fetch de
//    vuelo del router (SPA, prefetch, server actions) traen `*/*`
//    (sec-fetch-dest: empty). Con el guard el script solo existe en el HTML
//    inicial y React nunca lo crea en el cliente — MISMO FIX que el ThemeInjector
//    del dashboard (02 Sep 2026), que ya había sufrido este mismo error.
//
//    NO usar guards tipo `typeof window` ni 'use client': romperían la
//    hidratación (HTML del servidor con el <script> vs cliente devolviendo null).
// ═══════════════════════════════════════════════════════════════════════════════

import { headers } from 'next/headers'
import { TEMAS, TEMA_LOGIN } from '@/types/shell'

export async function LoginThemeInjector() {
    const headersList = await headers()

    // Solo el HTML inicial necesita el script (anti-FOUC). En una petición que no
    // es documento el data-theme ya está aplicado en el DOM: no inyectar nada
    // evita que React cree el <script> en el cliente (dev error) y no hace falta
    // ejecutarlo. Las 3 rutas de login ya son dinámicas (ƒ) — headers() no cambia
    // su modo de render.
    const esDocumentoHTML = (headersList.get('accept') || '').includes('text/html')
    if (!esDocumentoHTML) return null

    const definicion = TEMAS.find((t) => t.id === TEMA_LOGIN)!

    // Valores del código fuente, no del usuario: JSON.stringify solo escapa.
    const script = [
        '(function(){try{',
        'var d=document.documentElement;',
        'var dt=' + JSON.stringify(definicion.dataTheme) + ';',
        'if(dt){d.setAttribute("data-theme",dt);}else{d.removeAttribute("data-theme");}',
        // next-themes (clase dark/light + color-scheme) tiene que concordar con la
        // paleta forzada: mismo mapeo que ThemeToggler (0.6) — esOscuro → 'dark'.
        'try{localStorage.setItem("theme",' + JSON.stringify(definicion.esOscuro ? 'dark' : 'light') + ');}catch(e){}',
        '}catch(e){}})();',
    ].join('')

    return <script dangerouslySetInnerHTML={{ __html: script }} />
}
