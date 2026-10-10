import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusBadge } from '../domain/StatusBadge'
import { Stat } from '../domain/Stat'
import { DataTable } from '../domain/DataTable'
import { ReasonDialog } from '../domain/ReasonDialog'
import { ORDER_STATUS } from '@/lib/labels'
import { PasswordRules, passwordValid } from '@/pages/auth/PasswordRules'

describe('componentes de dominio', () => {
  it('StatusBadge muestra la etiqueta en español', () => {
    render(<StatusBadge map={ORDER_STATUS} value="PENDING_MATERIALS" />)
    expect(screen.getByText('Pendiente de materiales')).toBeInTheDocument()
  })

  it('Stat muestra valor y pista', () => {
    render(<Stat label="Inventario" value="1.000 g" hint="Oficina" />)
    expect(screen.getByText('1.000 g')).toBeInTheDocument()
    expect(screen.getByText('Oficina')).toBeInTheDocument()
  })

  it('DataTable vacío y con filas clicables', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<DataTable columns={[{ key: 'n', header: 'Nombre', cell: (r: { n: string }) => r.n }]} rows={[]} rowKey={(r) => r.n} empty={{ title: 'Nada aquí' }} />)
    expect(screen.getByText('Nada aquí')).toBeInTheDocument()
    rerender(<DataTable columns={[{ key: 'n', header: 'Nombre', cell: (r: { n: string }) => r.n }]} rows={[{ n: 'Oro 24K' }]} rowKey={(r) => r.n} onRowClick={onClick} />)
    await userEvent.click(screen.getByText('Oro 24K'))
    expect(onClick).toHaveBeenCalledWith({ n: 'Oro 24K' })
  })

  it('ReasonDialog exige un motivo mínimo', async () => {
    const onConfirm = vi.fn()
    render(<ReasonDialog open onOpenChange={() => {}} title="Cancelar orden" onConfirm={onConfirm} />)
    const btn = screen.getByTestId('reason-confirm')
    expect(btn).toBeDisabled()
    await userEvent.type(screen.getByTestId('reason-input'), 'Cliente desistió')
    expect(btn).toBeEnabled()
    await userEvent.click(btn)
    expect(onConfirm).toHaveBeenCalledWith('Cliente desistió')
  })

  it('política de contraseña', () => {
    expect(passwordValid('Prestige.2026!')).toBe(true)
    expect(passwordValid('debil')).toBe(false)
    render(<PasswordRules value="Abc" />)
    expect(screen.getByText('Mínimo 10 caracteres')).toBeInTheDocument()
  })
})
