import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

// ══════════════════════════════════════════════════════════════════════════════════
// FUENTES — Inter + IBM Plex Mono + Orbitron
//
// Inter: diseñada para interfaces densas con datos.
// - Numeros tabulares por defecto: columnas de importes alineadas
// - Alta legibilidad en tamanos pequenos (12-14px) — tablas, KPIs
// - Pesos 400, 500, 600, 700 cubren desde notas al pie hasta titulos de seccion
//
// IBM Plex Mono: monoespaciada con ligaduras de programacion.
// - RFC, folios fiscales, codigos de producto, SKUs
// - Las ligaduras ayudan a leer secuencias alfanumericas
//
// Orbitron: display para titulos con identidad mexicana.
// - Pesos 500, 600, 700, 800 para encabezados
//
// next/font optimiza la carga automaticamente:
// - CSS inline (sin peticion adicional a Google Fonts)
// - 'display: swap' evita bloqueo de renderizado (FOUT controlado)
// - Variables CSS disponibles globalmente para tailwind.config.ts
// ══════════════════════════════════════════════════════════════════════════════════
const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
    weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
    subsets: ["latin"],
    variable: "--font-ibm-plex-mono",
    display: "swap",
    weight: ["400", "500"],
});

const orbitron = Orbitron({
    subsets: ["latin"],
    variable: "--font-orbitron",
    display: "swap",
    weight: ["500", "600", "700", "800"],
});

// ════════════════════════════════════════════════════════════════════════════════════
// METADATA GLOBAL
//
// Aparece en: pestaña del navegador, resultados de Google,
// previews de redes sociales (Open Graph) y bookmarks.
// Cada page.tsx puede sobreescribir title y description con
// export const metadata: Metadata = { title: "...", ... }
// ═══════════════════════════════════════════════════════════════════════════════════════
export const metadata: Metadata = {
    title: {
        // template: permite que las paginas hijas agreguen su propio titulo
        // Resultado en una pagina: "Inventario | Tenochtitlán"
        template: "%s | Tenochtitlán",
        // Titulo por defecto cuando la pagina no define el suyo
        default: "Tenochtitlán",
    },
    description: "Aplicacion de gestion empresarial",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        // suppressHydrationWarning en <html>:
        // next-themes modifica class="dark" en el cliente despues del SSR.
        // Esa diferencia entre servidor y cliente es INTENCIONAL — no es un bug.
        // Sin este atributo, React lanza warnings de hidratacion en cada carga.
        //
        // inter.variable, ibmPlexMono.variable y orbitron.variable inyectan las fuentes como
        // variables CSS disponibles en todo el arbol de componentes.
        <html lang="es" suppressHydrationWarning className={`${inter.variable} ${ibmPlexMono.variable} ${orbitron.variable}`}>
            <body className="antialiased font-sans" suppressHydrationWarning>
                {/*
                    ThemeProvider es el interruptor maestro del sistema visual.
                    Sin el, useTheme(), dark mode y las 3 direcciones no funcionan.

                    attribute="class"    → usa clase CSS 'dark' en <html>
                                           debe coincidir con darkMode:["class"]
                                           en tailwind.config.ts
                    defaultTheme="system" → detecta la preferencia del SO
                    enableSystem         → habilita prefers-color-scheme
                    disableTransitionOnChange → cambio de modo instantaneo,
                                           sin flash visual entre light y dark
                */}
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    {children}


                        {/*
                            Toaster — wrapper ui/sonner (Guía 0.8).
                            La configuración (richColors, position bottom-right,
                            closeButton) vive en el wrapper, que hereda el tema
                            de next-themes vía ThemeProvider.
                        */}
                        <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
