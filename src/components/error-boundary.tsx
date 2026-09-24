"use client"

import React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
    children: React.ReactNode
    fallbackMessage?: string
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE
// Debe ser una clase — getDerivedStateFromError y componentDidCatch
// no tienen equivalente en hooks. Esta es la unica excepcion al
// patron de componentes funcionales en el proyecto.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ErrorBoundary — Captura errores de React en el arbol de componentes.
 *
 * En desarrollo: Next.js muestra su propio overlay de error encima.
 * En produccion: muestra la UI de este componente al usuario.
 *
 * Uso:
 * <ErrorBoundary><ComponenteComplejo /></ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary:", error.message)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children
        }

        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-6 max-w-md w-full">

                    <div className="w-full bg-surface border border-border rounded-xl p-8 shadow-premium-md flex flex-col items-center gap-4 text-center">

                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive-bg">
                            <AlertTriangle className="w-6 h-6 text-destructive" />
                        </div>

                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-semibold text-foreground">
                                Algo salio mal
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {this.props.fallbackMessage ??
                                    "Ocurrio un error inesperado. Puedes intentar recargar esta seccion."}
                            </p>
                        </div>

                        {process.env.NODE_ENV === "development" && this.state.error && (
                            <div className="w-full bg-hover-background border border-border rounded-lg p-3 text-left">
                                <p className="text-xs font-mono text-muted-foreground break-all">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={this.handleReset}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-fg text-sm font-medium transition-all duration-150 hover:opacity-90 shadow-premium-sm"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reintentar
                        </button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        Si el problema persiste, recarga la pagina completa.
                    </p>
                </div>
            </div>
        )
    }
}
