// ═════════════════════════════════════════════════════════════════════════════════
// TAILWIND CONFIG — SISTEMA DE TOKENS SEMANTICOS oklch
// 3 direcciones visuales (Obsidiana, Turquesa, Piedra Solar) — valores en globals.css
// Los componentes consumen clases semanticas, nunca colores oklch directos.
// ════════════════════════════════════════════════════════════════════════════════
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  // Activa dark mode por clase CSS (.dark en <html>) — manejado por next-themes.
  // El modo "media" (prefers-color-scheme) no permite que el usuario overridee
  // su preferencia del sistema operativo, asi que no lo usamos.
  darkMode: ["class"],

  // Tailwind escanea estos archivos para generar solo las clases que se usan.
  // Sin esta lista, el CSS de produccion incluiria miles de clases no utilizadas.
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/config/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/types/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
  	extend: {
  		colors: {
  			background: 'oklch(var(--bg) / <alpha-value>)',
  			foreground: 'oklch(var(--fg) / <alpha-value>)',
  			'muted-foreground': 'oklch(var(--muted-fg) / <alpha-value>)',
  			border: 'oklch(var(--border) / <alpha-value>)',
  			surface: 'oklch(var(--surface) / <alpha-value>)',
  			'surface-2': 'oklch(var(--surface-2) / <alpha-value>)',
  			'surface-raised': 'oklch(var(--surface-raised) / <alpha-value>)',
  			'surface-overlay': 'oklch(var(--surface-overlay) / <alpha-value>)',
  			'hover-background': 'oklch(var(--hover-bg) / <alpha-value>)',
  			sidebar: 'oklch(var(--sidebar) / <alpha-value>)',
  			'sidebar-foreground': 'oklch(var(--sidebar-foreground) / <alpha-value>)',
  			'sidebar-hover': 'oklch(var(--sidebar-hover) / <alpha-value>)',
  			primary: 'oklch(var(--primary) / <alpha-value>)',
  			'primary-bg': 'oklch(var(--primary-bg) / <alpha-value>)',
  			'primary-fg': 'oklch(var(--primary-fg) / <alpha-value>)',
  			secondary: 'oklch(var(--secondary) / <alpha-value>)',
  			'secondary-bg': 'oklch(var(--secondary-bg) / <alpha-value>)',
  			'secondary-fg': 'oklch(var(--secondary-fg) / <alpha-value>)',
  			success: 'oklch(var(--success) / <alpha-value>)',
  			'success-bg': 'oklch(var(--success-bg) / <alpha-value>)',
  			warning: 'oklch(var(--warning) / <alpha-value>)',
  			'warning-bg': 'oklch(var(--warning-bg) / <alpha-value>)',
  			destructive: 'oklch(var(--destructive) / <alpha-value>)',
  			'destructive-bg': 'oklch(var(--destructive-bg) / <alpha-value>)',
  			info: 'oklch(var(--info) / <alpha-value>)',
  			'info-bg': 'oklch(var(--info-bg) / <alpha-value>)',
  			'chart-1': 'oklch(var(--chart-1) / <alpha-value>)',
  			'chart-2': 'oklch(var(--chart-2) / <alpha-value>)',
  			'chart-3': 'oklch(var(--chart-3) / <alpha-value>)',
  			'chart-4': 'oklch(var(--chart-4) / <alpha-value>)',
			'acc-sistema': 'oklch(var(--acc-sistema) / <alpha-value>)',
			'acc-catalogos': 'oklch(var(--acc-catalogos) / <alpha-value>)',
			'acc-compras': 'oklch(var(--acc-compras) / <alpha-value>)',
			'acc-inventario': 'oklch(var(--acc-inventario) / <alpha-value>)',
			'acc-entradas': 'oklch(var(--acc-entradas) / <alpha-value>)',
  			'primary-foreground': 'oklch(var(--primary-fg) / <alpha-value>)',
  			'secondary-foreground': 'oklch(var(--secondary-fg) / <alpha-value>)',
  			muted: 'oklch(var(--surface) / <alpha-value>)',
  			accent: 'oklch(var(--hover-bg) / <alpha-value>)',
  			'accent-foreground': 'oklch(var(--fg) / <alpha-value>)',
  			'destructive-foreground': 'oklch(var(--destructive-fg) / <alpha-value>)',
  			ring: 'oklch(var(--primary) / <alpha-value>)',
  			input: 'oklch(var(--border) / <alpha-value>)',
  			popover: 'oklch(var(--surface-raised) / <alpha-value>)',
  			'popover-foreground': 'oklch(var(--fg) / <alpha-value>)',
  			card: 'oklch(var(--surface) / <alpha-value>)',
  			'card-foreground': 'oklch(var(--fg) / <alpha-value>)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			xs: 'calc(var(--radius) - 6px)'
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-inter)',
  				'ui-sans-serif',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-ibm-plex-mono)',
  				'ui-monospace',
  				'SFMono-Regular',
  				'monospace'
  			],
  			display: [
  				'var(--font-orbitron)',
  				'sans-serif'
  			]
  		},
  		boxShadow: {
  			'premium-sm': '0 2px 8px -1px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.04)',
  			'premium-md': '0 8px 24px -4px rgba(0,0,0,0.10), 0 4px 12px -2px rgba(0,0,0,0.06)',
  			'premium-lg': '0 20px 48px -8px rgba(0,0,0,0.14), 0 12px 24px -4px rgba(0,0,0,0.08)',
  			'premium-inner': 'inset 0 1px 3px 0 rgba(0,0,0,0.06)',
  			'premium-side': '4px 0 16px -2px rgba(0,0,0,0.08)'
  		},
  		keyframes: {
  			'fade-up': {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(8px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'fade-in': {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'fade-up': 'fade-up 0.3s ease-out',
  			'fade-in': 'fade-in 0.2s ease-out',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },

  // tailwindcss-animate: requerido por los componentes shadcn/ui (Dialog,
  // Sheet, Popover) para sus animaciones de entrada/salida.
  plugins: [tailwindcssAnimate],
};

export default config;
