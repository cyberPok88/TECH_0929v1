// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER — Guía 0.6 · SERVER COMPONENT PURO
//
// Sin 'use client': 0 bytes de JavaScript al navegador.
//
// ⚠️ Vive dentro de <AuthWrapper>, que SÍ es cliente, y aun así sigue siendo
//    Server Component: en RSC lo que decide es dónde se COMPONE el JSX. El
//    layout (servidor) lo pasa ya renderizado como children, así que el
//    componente cliente recibe HTML, no la función. Es el patrón oficial para
//    no contagiar 'use client' hacia abajo.
//
// ⚠️ NO agregar 'use client' "para que funcione algo": si necesita interacción,
//    ese algo va en otro componente.
// ═══════════════════════════════════════════════════════════════════════════════

export function Footer() {
    // En el servidor se evalúa una vez. En cliente, una petición que cruce la
    // medianoche del 31 de diciembre daría un hydration mismatch irreproducible.
    const anio = new Date().getFullYear()

    return (
        // ⭐ MEJORA 26 Sep 2026 — el Shell es `fixed inset-0 … overflow-hidden`:
        // cada píxel del pie sale del alto de la tabla. En móvil la coletilla
        // «by Tech Computer · Sistema de Control de Ventas» envolvía a 2 líneas
        // (~57px); se oculta bajo sm y queda la marca + el año en una sola.
        // `shrink-0`: es una banda fija del layout, no un flex item elástico.
        <footer className="shrink-0 border-t border-border px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                    <span className="font-display font-semibold">Tenochtitlán</span>
                    <span className="hidden sm:inline">
                        {' by Tech Computer · Sistema de Control de Ventas'}
                    </span>
                </span>
                <span className="font-mono">© {anio}</span>
            </div>
        </footer>
    )
}
