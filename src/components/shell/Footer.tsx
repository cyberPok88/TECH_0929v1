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
        <footer className="border-t border-border px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                    <span className="font-display font-semibold">Tenochtitlán</span>
                    {' by Tech Computer · Sistema de Control de Ventas'}
                </span>
                <span className="font-mono">© {anio}</span>
            </div>
        </footer>
    )
}
