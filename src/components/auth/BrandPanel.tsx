// ============================================================================
// BRAND PANEL — Guía 0.11 Parte 5 · Envoltorio glass del área de login
//
// TRANSFORMADO respecto a la Guía 0.5: antes era panel lateral fijo con `subtitle`.
// Ahora es el vidrio del área de login: recibe children (el formulario) y provee
// la ficha de marca completa (sigilo + wordmark + título + subtítulo + status +
// footer B2B/B2C).
//
// Mismo nombre `BrandPanel` — su propósito conceptual sigue siendo "el panel de
// la marca". Solo cambió su composición interna. Consumidores actualizados en
// login/page.tsx, login/recuperar/page.tsx, login/reset/page.tsx (Parte 5 B5-B7).
//
// Server Component: 0 JS al bundle. Los estilos van inline (mismo patrón que
// LoginAura Bloque 1) para aislar del CSS global.
// ============================================================================

interface BrandPanelProps {
    // Título del panel — cambia por pantalla:
    //   /login          → "Acceso al sistema"
    //   /login/recuperar → "¿Olvidaste tu contraseña?"
    //   /login/reset     → "Nueva contraseña"
    title: string
    // Subtítulo bajo el título — opcional.
    subtitle?: string
    // El formulario del área — LoginForm, RecuperarPasswordForm, ResetPasswordForm.
    children: React.ReactNode
}

export function BrandPanel({ title, subtitle, children }: BrandPanelProps) {
    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: PANEL_CSS }} />

            <main className="brand-panel-shell">
                <section className="brand-panel">
                    <header className="brand-panel-head">
                        {/* Sigilo pirámide — 4 rectángulos escalonados. Drop-shadow
                            con oklch(var(--primary)) reacciona al tema activo. */}
                        <svg
                            className="brand-panel-sigil"
                            viewBox="0 0 40 28"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <rect x="17" y="1" width="6" height="5" />
                            <rect x="13" y="8" width="14" height="5" />
                            <rect x="9" y="15" width="22" height="5" />
                            <rect x="5" y="22" width="30" height="5" />
                        </svg>
                        <div>
                            <p className="brand-panel-name">Tenochtitlán</p>
                            <p className="brand-panel-sub">by Tech Computer</p>
                        </div>
                    </header>

                    <h1 className="brand-panel-title">{title}</h1>
                    {subtitle && <p className="brand-panel-subtitle">{subtitle}</p>}

                    <p className="brand-panel-status">
                        <span className="brand-panel-led" aria-hidden="true" />
                        Plataforma operativa · en línea
                    </p>

                    <div className="brand-panel-content">{children}</div>

                    <footer className="brand-panel-foot">
                        <div className="brand-panel-foot-brand">
                            Mayoreo · B2B<b>Tech Computer</b>
                        </div>
                        <div className="brand-panel-foot-brand">
                            Menudeo · B2C<b>Tenochtitlán</b>
                        </div>
                        <span className="brand-panel-foot-copy">© 2026</span>
                    </footer>
                </section>
            </main>
        </>
    )
}

const PANEL_CSS = `
.brand-panel-shell {
    position: relative;
    z-index: 2;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
}
.brand-panel {
    width: 100%;
    max-width: 420px;
    background: oklch(var(--surface-raised) / 0.86);
    -webkit-backdrop-filter: blur(26px) saturate(1.25);
    backdrop-filter: blur(26px) saturate(1.25);
    border: 1px solid oklch(var(--fg) / 0.16);
    border-radius: calc(var(--radius) + 8px);
    box-shadow:
        0 40px 90px rgb(0 0 0 / .5),
        0 0 0 1px oklch(var(--border) / 0.4),
        0 0 70px oklch(var(--primary) / 0.10);
    padding: 42px 38px 28px;
    animation: brand-panel-rise .55s ease-out both;
    position: relative;
    overflow: hidden;
}
.brand-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 8%;
    right: 8%;
    height: 2px;
    background: linear-gradient(90deg, transparent, oklch(var(--primary)), transparent);
    opacity: .85;
    animation: brand-panel-linea 4.5s ease-in-out infinite;
}
@keyframes brand-panel-rise { from { opacity: 0; transform: translateY(16px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes brand-panel-linea { 0%, 100% { opacity: .35; } 50% { opacity: .9; } }

.brand-panel-head { display: flex; align-items: center; gap: 12px; }
.brand-panel-sigil { width: 30px; height: 21px; color: oklch(var(--primary)); filter: drop-shadow(0 0 10px oklch(var(--primary) / 0.55)); }
.brand-panel-name { font-family: Orbitron, sans-serif; font-size: 13px; font-weight: 800; letter-spacing: .28em; text-transform: uppercase; color: oklch(var(--fg)); }
.brand-panel-sub { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .3em; text-transform: uppercase; color: oklch(var(--muted-fg)); }

.brand-panel-title { margin-top: 26px; font-family: Orbitron, sans-serif; font-size: 19px; font-weight: 800; letter-spacing: .01em; color: oklch(var(--fg)); }
.brand-panel-subtitle { margin-top: 6px; font-size: 13.5px; color: oklch(var(--muted-fg)); line-height: 1.5; }

.brand-panel-status { margin-top: 14px; display: flex; align-items: center; gap: 8px; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: oklch(var(--muted-fg) / 0.9); }
.brand-panel-led { width: 7px; height: 7px; border-radius: 50%; background: oklch(var(--success)); box-shadow: 0 0 8px oklch(var(--success) / 0.8); animation: brand-panel-parpadeo 2.2s ease-in-out infinite; }
@keyframes brand-panel-parpadeo { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }

.brand-panel-content { margin-top: 4px; }

.brand-panel-foot { margin-top: 26px; padding-top: 18px; border-top: 1px solid oklch(var(--fg) / 0.08); display: flex; justify-content: space-between; gap: 12px; }
.brand-panel-foot-brand { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: oklch(var(--muted-fg)); }
.brand-panel-foot-brand b { display: block; margin-top: 4px; color: oklch(var(--fg) / 0.8); font-weight: 500; }
.brand-panel-foot-copy { font-size: 10.5px; color: oklch(var(--muted-fg) / 0.8); align-self: flex-end; }

@media (prefers-reduced-motion: reduce) {
    .brand-panel { animation-duration: .01s; }
    .brand-panel::before, .brand-panel-led { animation: none !important; }
}
@media (max-width: 720px) {
    .brand-panel { padding: 32px 24px 24px; }
}
`
