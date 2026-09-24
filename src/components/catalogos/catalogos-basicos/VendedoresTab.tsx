'use client'

// VendedoresTab.tsx — Vendedores (derivado read-only · Guía 1.0 · P8)
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable, TableSkeleton } from '@/components/data-table'
import type { ColumnDefExtension } from '@/types/table'
import type { VendedorFila } from '@/types/catalogos'
import { listarVendedores } from '@/lib/actions/catalogos'

type Columna = ColumnDef<VendedorFila> & ColumnDefExtension<VendedorFila>

const columnas: Columna[] = [
  { accessorKey: 'nombre', header: 'Nombre', label: 'Nombre' },
  { accessorKey: 'correo', header: 'Correo', label: 'Correo' },
  { accessorKey: 'es_activo', header: 'Activo', label: 'Activo', render: (v) => (v ? 'Activo' : 'Inactivo') },
  {
    accessorKey: 'id',
    header: '',
    label: 'Acciones',
    visible: false,
    render: () => (
      <Link className="text-sm underline" href={`/dashboard/sistema/usuarios`}>Ver usuario</Link>
    ),
  },
]

export function VendedoresTab() {
  const [filas, setFilas] = useState<VendedorFila[]>([])
  const [estado, setEstado] = useState<'idle' | 'loading' | 'error'>('loading')

  const cargar = useCallback(async () => {
    setEstado('loading')
    try {
      const res = await listarVendedores()
      if (res?.success) setFilas(res.data)
      else setEstado('error')
    } catch { setEstado('error') } finally { setEstado('idle') }
  }, [])
  useEffect(() => {
    let activo = true
    const inicial = async () => {
      try {
        const res = await listarVendedores()
        if (!activo) return
        if (res?.success) { setFilas(res.data); setEstado('idle') }
        else setEstado('error')
      } catch {
        if (activo) setEstado('error')
      }
    }
    void inicial()
    return () => { activo = false }
  }, [])

  if (estado === 'loading' && filas.length === 0) return <TableSkeleton />

  return (
    <DataTable
      columns={columnas}
      data={filas}
      rowKey={(f) => f.id}
      estado={estado}
      emptyMessage="No hay vendedores con ese rol"
      onRetry={cargar}
    />
  )
}
