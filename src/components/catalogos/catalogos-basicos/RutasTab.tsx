'use client'

// RutasTab.tsx — Rutas de cobro (Guía 1.0 · P7, custom por selector de cobrador)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Power } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable, ConfirmDialog, crearColumnaAcciones, TableSkeleton, useSeleccionTabla } from '@/components/data-table'
import type { ColumnDefExtension } from '@/types/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import type { RutaCobroFila } from '@/types/catalogos'
import type { SolicitudNueva } from './catalogos-config'
import { listarRutasCobro, crearRutaCobro, editarRutaCobro, cambiarEstadoRutaCobro, listarUsuariosActivos } from '@/lib/actions/catalogos'

type Columna = ColumnDef<RutaCobroFila> & ColumnDefExtension<RutaCobroFila>
interface ToggleState { id: string; activo: boolean }
interface ModalState { abierto: boolean; modo: 'crear' | 'editar'; registro?: RutaCobroFila }

interface RutasTabProps {
  solicitudNuevo?: SolicitudNueva
}

export function RutasTab({ solicitudNuevo }: RutasTabProps) {
  const [filas, setFilas] = useState<RutaCobroFila[]>([])
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([])
  const [estado, setEstado] = useState<'idle' | 'loading' | 'error'>('loading')
  const [modal, setModal] = useState<ModalState>({ abierto: false, modo: 'crear' })
  const [toggle, setToggle] = useState<ToggleState | null>(null)
  const nuevoUltima = useRef(0)

  const cargar = useCallback(async () => {
    setEstado('loading')
    try {
      const [r, u] = await Promise.all([listarRutasCobro(), listarUsuariosActivos()])
      if (r?.success) setFilas(r.data as RutaCobroFila[])
      if (u?.success) setUsuarios(u.data)
      else setEstado('error')
    } catch { setEstado('error') } finally { setEstado('idle') }
  }, [])
  useEffect(() => {
    let activo = true
    const inicial = async () => {
      try {
        const [r, u] = await Promise.all([listarRutasCobro(), listarUsuariosActivos()])
        if (!activo) return
        if (r?.success) setFilas(r.data as RutaCobroFila[])
        if (u?.success) setUsuarios(u.data)
        if (r?.success && u?.success) setEstado('idle')
        else setEstado('error')
      } catch {
        if (activo) setEstado('error')
      }
    }
    void inicial()
    return () => { activo = false }
  }, [])

  const nombreCobrador = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of usuarios) m.set(u.id, u.nombre)
    return m
  }, [usuarios])

  const columnas = useMemo<Columna[]>(() => {
    const acciones = crearColumnaAcciones<RutaCobroFila>({
      acciones: [
        { icon: Pencil, label: 'Editar', onClick: (f) => setModal({ abierto: true, modo: 'editar', registro: f }) },
        { icon: Power, label: 'Cambiar estado', onClick: (f) => setToggle({ id: f.id, activo: f.es_activo }) },
      ],
    })
    return [
      { accessorKey: 'clave', header: 'Clave', label: 'Clave' },
      { accessorKey: 'nombre', header: 'Nombre', label: 'Nombre' },
      {
        accessorKey: 'id_cobrador_asignado',
        header: 'Cobrador',
        label: 'Cobrador',
        render: (_v, f: RutaCobroFila) => (f.id_cobrador_asignado ? nombreCobrador.get(f.id_cobrador_asignado) ?? '—' : '—'),
      },
      { accessorKey: 'es_activo', header: 'Activo', label: 'Activo', render: (v) => (v ? 'Activo' : 'Inactivo') },
      acciones,
    ]
  }, [nombreCobrador])

  const alExito = useCallback(() => { setModal((m) => ({ ...m, abierto: false })); void cargar() }, [cargar])
  const ejecutarToggle = useCallback(async () => {
    if (!toggle) return { error: null as string | null }
    const res = await cambiarEstadoRutaCobro(toggle.id, !toggle.activo)
    if (!res.success) return { error: res.error ?? 'No se pudo cambiar el estado' }
    setToggle(null); void cargar()
    return { error: null as string | null }
  }, [toggle, cargar])

  const { seleccion, onSeleccionChange } = useSeleccionTabla(filas, (f) => f.id)

  // Toolbar "Nuevo" → abrir modal de crear (dirigida a esta pestaña)
  useEffect(() => {
    if (!solicitudNuevo || solicitudNuevo.tab !== 'rutas_cobro') return
    if (solicitudNuevo.seq === nuevoUltima.current) return
    nuevoUltima.current = solicitudNuevo.seq
    setModal({ abierto: true, modo: 'crear' })
  }, [solicitudNuevo])

  if (estado === 'loading' && filas.length === 0) return <TableSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModal({ abierto: true, modo: 'crear' })}><Plus className="size-4" /> Nueva ruta de cobro</Button>
      </div>
      <DataTable
        columns={columnas}
        data={filas}
        rowKey={(f) => f.id}
        estado={estado}
        emptyMessage="Sin rutas de cobro"
        onRetry={cargar}
        enableRowSelection
        rowSelection={seleccion}
        onRowSelectionChange={onSeleccionChange}
      />
      {modal.abierto && (
        <RutaModal key={`${modal.modo}-${modal.registro?.id ?? 'nuevo'}`} modo={modal.modo} registro={modal.registro} usuarios={usuarios} onClose={() => setModal((m) => ({ ...m, abierto: false }))} onExito={alExito} />
      )}
      <ConfirmDialog open={toggle !== null} onOpenChange={(v) => { if (!v) setToggle(null) }} titulo={toggle?.activo ? 'Desactivar ruta' : 'Activar ruta'} descripcion="¿Confirmas el cambio de estado de esta ruta?" onConfirm={ejecutarToggle} />
    </div>
  )
}

interface RutaModalProps {
  modo: 'crear' | 'editar'
  registro?: RutaCobroFila
  usuarios: { id: string; nombre: string }[]
  onClose: () => void
  onExito: () => void
}

function RutaModal({ modo, registro, usuarios, onClose, onExito }: RutaModalProps) {
  const [nombre, setNombre] = useState(registro?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(registro?.descripcion ?? '')
  const [cobrador, setCobrador] = useState<string>(registro?.id_cobrador_asignado ?? '')
  const [activo, setActivo] = useState(registro?.es_activo ?? true)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const guardar = async () => {
    setError(null)
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setOcupado(true)
    const res = modo === 'crear'
      ? await crearRutaCobro({ nombre: nombre.trim(), descripcion, id_cobrador_asignado: cobrador || null, es_activo: activo })
      : await editarRutaCobro(registro!.id, { nombre: nombre.trim(), descripcion, id_cobrador_asignado: cobrador || null, es_activo: activo })
    setOcupado(false)
    if (!res.success) { setError(res.error ?? 'Error al guardar'); return }
    toast.success(modo === 'crear' ? 'Ruta creada' : 'Ruta actualizada')
    onExito()
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{modo === 'crear' ? 'Nueva ruta de cobro' : 'Editar ruta de cobro'}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={ocupado} /></div>
          <div className="grid gap-1.5"><Label>Descripción (opcional)</Label><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={ocupado} /></div>
          <div className="grid gap-1.5">
            <Label>Cobrador asignado</Label>
            <Select value={cobrador} onValueChange={setCobrador} disabled={ocupado}>
              <SelectTrigger><SelectValue placeholder="Sin cobrador asignado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin cobrador</SelectItem>
                {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between rounded border p-3 text-sm">Activa<Switch checked={activo} onCheckedChange={setActivo} disabled={ocupado} /></label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={ocupado}>Cancelar</Button>
          <Button onClick={guardar} disabled={ocupado}>{modo === 'crear' ? 'Crear' : 'Guardar cambios'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
