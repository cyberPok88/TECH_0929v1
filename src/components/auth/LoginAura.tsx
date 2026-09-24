// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN AURA — Guía 0.11 Parte 5 · Server Component decorativo
//
// Seis capas apiladas detrás del panel glass del área de login:
//   z-0  .mesh + 3 .blob   Fondo base — gradientes vivos desplazándose
//   z-0  .halo             Energía central que respira
//   z-0  .orbit            Doble anillo giratorio
//   z-0  .greca            Banda de greca escalonada (ADN de marca) desplazándose
//   z-1  .grain            Grano de cine (feTurbulence, mix-blend overlay)
//   z-1  .dust             Polvo de oro (44 partículas deterministas)
//
// Todo aria-hidden y pointer-events:none. Server Component: 0 JS enviado.
// Se usa en /login, /login/recuperar y /login/reset (montaje idéntico).
//
// Tokens usados (todos existen en las 3 paletas — CATALOGO_UI.md):
//   --bg · --primary · --secondary · --success · --surface-raised · --fg
// Se aplican con oklch(var(--x) / alpha) según SPEC_LOGIN_AURA §3.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Array determinista de 44 partículas ─────────────────────────────────────
// El HTML de referencia (login-nuevo.html) las genera con Math.random() en el
// script del cliente. En Server Component eso produce hydration mismatch: el
// server pinta un array y el cliente otro. Se calculan con un LCG barato
// (Park-Miller minstd) semilla=1 — mismos valores en server y cliente para
// siempre. Cada configuración es una config única en el rango pedido por la
// spec §3.6 (tamaño 1.5–4.5px, duración 13–29s, delay 0–22s, dx ±60, op .25–.75).
//
// Nota: el LCG produce enteros en [1, 2^31-2]. Se normalizan a [0, 1) dividiendo
// por 2^31. El primer valor arranca fuera del cero para evitar posiciones nulas.
const DUST_COUNT = 44

interface DustConfig {
    left: number       // % horizontal
    size: number       // px
    duration: number   // s
    delay: number      // s (negativo en el CSS — arranca en vuelo)
    dx: number         // px de deriva lateral
    opacity: number
    glow: boolean      // ~55% brilla con box-shadow
}

function generarDust(): DustConfig[] {
    let seed = 1
    const next = () => {
        // LCG minstd (Park-Miller): a=48271, m=2^31-1
        seed = (seed * 48271) % 0x7fffffff
        return seed / 0x7fffffff
    }
    return Array.from({ length: DUST_COUNT }, () => ({
        left: +(next() * 100).toFixed(1),
        size: +(1.5 + next() * 3).toFixed(1),
        duration: +(13 + next() * 16).toFixed(1),
        delay: +(next() * 22).toFixed(1),
        dx: Math.round(next() * 120 - 60),
        opacity: +(0.25 + next() * 0.5).toFixed(2),
        glow: next() > 0.55,
    }))
}

const DUST_CONFIG: DustConfig[] = generarDust()

export function LoginAura() {
    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: AURA_CSS }} />

            <div className="login-aura-mesh" aria-hidden="true">
                <div className="blob blob-1" />
                <div className="blob blob-2" />
                <div className="blob blob-3" />
            </div>

            <div className="login-aura-halo" aria-hidden="true" />
            <div className="login-aura-orbit" aria-hidden="true" />
            <div className="login-aura-greca" aria-hidden="true" />

            <div className="login-aura-dust" aria-hidden="true">
                {DUST_CONFIG.map((p, i) => (
                    <i
                        key={i}
                        style={{
                            left: `${p.left}%`,
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            animationDuration: `${p.duration}s`,
                            animationDelay: `-${p.delay}s`,
                            // CSS custom properties — la animación las lee con var()
                            ['--dx' as string]: `${p.dx}px`,
                            ['--o' as string]: p.opacity,
                            ...(p.glow
                                ? { boxShadow: '0 0 8px oklch(var(--primary) / 0.8)' }
                                : { opacity: 0.8 }),
                        }}
                    />
                ))}
            </div>

            <div className="login-aura-grain" aria-hidden="true" />
        </>
    )
}

// ── CSS de las 6 capas ──────────────────────────────────────────────────────
// Prefijos `login-aura-*` para aislar del resto de la app. Los @keyframes
// no colisionan con nombres del proyecto (drift1-3 / respirar / girar / etc).
// SVG data-URIs escapados para el grain (feTurbulence) y la greca (M0 56 H14...).
const AURA_CSS = `
.login-aura-mesh { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.login-aura-mesh .blob { position: absolute; border-radius: 50%; filter: blur(90px); will-change: transform; }
.login-aura-mesh .blob-1 { width: 56vw; height: 56vw; left: -14vw; top: -16vw; background: radial-gradient(circle, oklch(var(--primary) / 0.34), transparent 65%); animation: login-drift1 26s ease-in-out infinite alternate; }
.login-aura-mesh .blob-2 { width: 48vw; height: 48vw; right: -12vw; bottom: -14vw; background: radial-gradient(circle, oklch(var(--secondary) / 0.26), transparent 65%); animation: login-drift2 32s ease-in-out infinite alternate; }
.login-aura-mesh .blob-3 { width: 34vw; height: 34vw; left: 30vw; top: 30vh; background: radial-gradient(circle, oklch(var(--primary) / 0.16), transparent 65%); animation: login-drift3 38s ease-in-out infinite alternate; }
@keyframes login-drift1 { to { transform: translate(9vw, 7vh) scale(1.15); } }
@keyframes login-drift2 { to { transform: translate(-8vw, -6vh) scale(1.1); } }
@keyframes login-drift3 { to { transform: translate(-7vw, 9vh) scale(0.9); } }

.login-aura-halo { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 560px; height: 560px; border-radius: 50%; pointer-events: none; z-index: 0; background: radial-gradient(circle, oklch(var(--primary) / 0.16), transparent 62%); filter: blur(50px); animation: login-respirar 7s ease-in-out infinite; }
@keyframes login-respirar { 0%,100% { transform: translate(-50%, -50%) scale(1); opacity: .8; } 50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; } }

.login-aura-orbit { position: fixed; left: 50%; top: 50%; width: 560px; height: 560px; transform: translate(-50%, -50%); pointer-events: none; z-index: 0; border-radius: 50%; border: 1px solid oklch(var(--primary) / 0.14); }
.login-aura-orbit::before { content: ''; position: absolute; inset: -1px; border-radius: 50%; border: 2px solid transparent; border-top-color: oklch(var(--primary) / 0.75); border-right-color: oklch(var(--primary) / 0.25); animation: login-girar 9s linear infinite; filter: drop-shadow(0 0 12px oklch(var(--primary) / 0.5)); }
.login-aura-orbit::after { content: ''; position: absolute; inset: 42px; border-radius: 50%; border: 1px dashed oklch(var(--secondary) / 0.22); animation: login-girar 24s linear infinite reverse; }
@keyframes login-girar { to { transform: rotate(360deg); } }

.login-aura-greca { position: fixed; left: 0; right: 0; bottom: 0; height: 56px; z-index: 0; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cpath d='M0 56 H14 V42 H28 V28 H42 V14 H56 V0' fill='none' stroke='%23ffffff' stroke-width='1.3' stroke-opacity='0.35'/%3E%3C/svg%3E"); background-size: 56px 56px; opacity: .10; animation: login-deslizar 26s linear infinite; }
.login-aura-greca::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, oklch(var(--bg)) 0%, transparent 70%); }
@keyframes login-deslizar { to { background-position: 448px 0; } }

.login-aura-grain { position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: .05; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E"); mix-blend-mode: overlay; }

.login-aura-dust { position: fixed; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
.login-aura-dust i { position: absolute; bottom: -12px; border-radius: 50%; background: oklch(var(--primary)); animation: login-deriva linear infinite; will-change: transform, opacity; }
@keyframes login-deriva {
    0%   { transform: translate(0, 0); opacity: 0; }
    12%  { opacity: var(--o, .5); }
    88%  { opacity: var(--o, .5); }
    100% { transform: translate(var(--dx, 20px), -112vh); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
    .login-aura-mesh .blob,
    .login-aura-orbit, .login-aura-orbit::before, .login-aura-orbit::after,
    .login-aura-greca, .login-aura-halo,
    .login-aura-dust i { animation: none !important; }
    .login-aura-dust { display: none; }
}

@media (max-width: 720px) {
    .login-aura-halo, .login-aura-orbit { width: 420px; height: 420px; }
}
`
