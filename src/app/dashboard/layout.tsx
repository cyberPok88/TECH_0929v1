// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD LAYOUT — Guía 0.6 · SERVER COMPONENT (el Supervisor)
//
// Reemplaza el layout de la Guía 0.5, que solo envolvía en AuthWrapper y
// anotaba: "La estructura visual se implementa en la Guía 0.6".
//
// Cuatro capas de protección, ninguna redundante:
//   1. proxy.ts     — Edge, sobre peticiones HTTP. No ve la navegación SPA.
//   2. ESTE layout  — servidor, ANTES de generar el HTML. Además lee el tema.
//   3. AuthWrapper  — cliente, cubre la navegación SPA y el logout multipestaña.
//   4. RBACGuard    — cliente, POR URL, contra el menu[] de la BD (Guía 0.7).
//
// Guía 0.11 Parte 4: además deriva esPrimerIngreso del user_metadata y monta
// <PrimerIngresoBanner /> dentro del <main>, arriba del <RBACGuard>.
//
// ⚠️ NUNCA agregar 'use client': se perdería la verificación en servidor y
//    volvería el parpadeo de tema.
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'

import { AuthWrapper } from '@/components/auth/AuthWrapper'
import { FiltrosBar, Footer, Sidebar, Toolbar, Topbar } from '@/components/shell'
import { PrimerIngresoBanner } from '@/components/shell/PrimerIngresoBanner'
import { RBACGuard } from '@/components/shell/RBACGuard'
import { ThemeInjector } from '@/components/shell/ThemeInjector'
import { createClient } from '@/lib/supabase/server'
import { TEMA_DEFAULT, esTemaValido, type TemaValue } from '@/types/shell'

export const metadata = {
    title: 'Dashboard',
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    // getUser() verifica el JWT contra el servidor.
    // getSession() lee de localStorage y está prohibido por ESLint (Guía 0.1).
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // ── Banner de primer ingreso (Guía 0.11 Parte 4) ───────────────────────────
    // Cero round-trip extra: el flag vive en user_metadata que ya vino en getUser().
    // La comparación estricta contra `true` evita false-positives por
    // serializaciones raras (string "true", número 1). Ausencia == mostrar banner.
    const metadata = user.user_metadata as { password_changed_once?: unknown } | null
    const esPrimerIngreso = metadata?.password_changed_once !== true

    // ── Tema, ANTES de renderizar HTML ─────────────────────────────────────────
    // Este es el único punto del ciclo donde se puede leer la preferencia a
    // tiempo para inyectarla sin parpadeo.
    const { data: fila } = await supabase
        .from('usuarios')
        .select('preferencias')
        .eq('id', user.id)
        .single()

    const temaCrudo = (fila?.preferencias as { tema?: unknown } | null)?.tema
    // La columna es JSONB: puede traer un valor viejo o basura. Sin este filtro
    // el inyector aplicaría un data-theme inexistente y la app saldría a medias.
    const tema: TemaValue = esTemaValido(temaCrudo) ? temaCrudo : TEMA_DEFAULT

    return (
        <>
            {/* FUERA de AuthWrapper a propósito: mientras AuthWrapper verifica
                devuelve un spinner y no renderiza a sus hijos. Dentro, el script
                no correría hasta después del primer pintado — justo lo que evita. */}
            <ThemeInjector tema={tema} />

            <AuthWrapper>
{/* ⭐ FIX 26 Ago 2026 (2da iteración) — `fixed inset-0` en vez de
                    `h-screen h-svh`: el shell sale del flujo del documento y su
                    overflow interno (el <main> con tablas largas) DEJA de
                    contribuir al scrollable overflow del viewport. La 1ra
                    iteración (h-screen fallback + min-h-0) hizo que el <main>
                    scrolleara interno, pero html/body con overflow visible
                    seguían scrolleables (document.scrollHeight > innerHeight):
                    la rueda al llegar al fondo del main encadenaba hacia la
                    ventana y movía sidebar/toolbar/topbar juntos — la pestaña
                    Categorías (tabla larga) lo exponía; Impuestos (tabla
                    corta) no. Con `fixed inset-0` la ventana NUNCA scrollea
                    (scrollY queda en 0) y el main conserva su scroll interno.
                    En móvil el fixed sigue al viewport visible (dvh-like, sin
                    hueco con la barra del navegador), cubriendo lo que h-svh
                    intentaba. */}
                <div className="fixed inset-0 flex overflow-hidden bg-background">
                    <Sidebar />

                    <div className="flex min-w-0 flex-1 flex-col">
                        <Topbar />
                        <Toolbar />

                        {/* ⭐ Guía 0.6 (Decisión 25 · 01 Sep 2026) — FiltrosBar:
                            la sección de filtros del Shell. El ESPACIO siempre
                            existe; colapsa si la página no registra filtros
                            (usePageConfig.filtros).
                            ⭐ ALINEACIÓN 03 Sep 2026: la enmienda original de
                            esta Parte (26 Ago) predata a FiltrosBar (01 Sep) —
                            conservarlo aquí o el reemplazo del layout elimina
                            la sección de filtros de la app. */}
                        <FiltrosBar />

{/* Solo <main> desborda: así Sidebar y Topbar quedan
                            anclados al bajar por una tabla larga.
                            ⭐ FIX 26 Ago 2026 — min-h-0 explícito: en flexbox un
                            flex item con overflow-y-auto necesita poder encogerse
                            bajo su contenido para activar el scroll interno. El
                            spec lo permite vía "overflow no visible ⇒ min-auto = 0",
                            pero min-h-0 lo garantiza en CUALQUIER navegador y hace
                            la intención visible sin depender de esa sutileza. */}
                        <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
{/* Guía 0.11 Parte 4 — banner de primer ingreso.
                                Dentro del <main> para que scrollee con el contenido.
                                Arriba del RBACGuard para que se vea en cualquier
                                ruta accesible o sumidero.
                                ⭐ FIX 21 Ago 2026: userId para dismiss POR USUARIO
                                (la clave sessionStorage no puede ser global a la
                                pestaña — contaminaba al siguiente usuario). */}
                            <PrimerIngresoBanner mostrar={esPrimerIngreso} userId={user.id} />

                            {/* ⭐ GUÍA 0.7 — cuarta capa, POR URL: la URL escrita a
                                mano (barra o SPA) se cruza contra el menú que la BD
                                le dio a este usuario. El rechazo navega al sumidero
                                con el Shell completo visible (Decisión 5). */}
                            <RBACGuard>{children}</RBACGuard>
                        </main>

                        <Footer />
                    </div>
                </div>
            </AuthWrapper>
        </>
    )
}
