import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Scale, Truck } from 'lucide-react'
import { usePermission } from '@/lib/auth/store'
import { PageHeader } from '@/components/domain/PageHeader'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { SummaryTab } from './components/SummaryTab'
import { BalancesTab } from './components/BalancesTab'
import { CustodyTab } from './components/CustodyTab'
import { MovementsTab } from './components/MovementsTab'
import { KardexTab } from './components/KardexTab'
import { AdjustmentsTab } from './components/AdjustmentsTab'

/** P04 · Inventario global (RF-005/006, RN-004, CA-002, reportes Kardex y Material por taller). */
export default function InventoryPage() {
  const [tab, setTab] = useState('summary')
  const canEntry = usePermission('inventory.entry')
  const canDispatch = usePermission('orders.dispatch')
  const canMaintain = usePermission('inventory.adjust', 'inventory.transfer')

  return (
    <div>
      <PageHeader
        code="P04"
        title="Inventario global"
        description="Existencias por material, ley, lote y ubicación. El material entregado a talleres sigue bajo control de Prestige Gold como custodia."
        actions={
          <>
            {canEntry && (
              <Link to="/balanza">
                <Button variant="secondary"><Scale className="size-4" /> Registrar entrada</Button>
              </Link>
            )}
            {canDispatch && (
              <Link to="/asignaciones">
                <Button><Truck className="size-4" /> Asignar a taller</Button>
              </Link>
            )}
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 overflow-x-auto">
          <TabsTrigger value="summary" data-testid="inv-tab-summary">Resumen global</TabsTrigger>
          <TabsTrigger value="balances" data-testid="inv-tab-balances">Existencias detalladas</TabsTrigger>
          <TabsTrigger value="custody" data-testid="inv-tab-custody">Custodia por taller</TabsTrigger>
          <TabsTrigger value="movements" data-testid="inv-tab-movements">Movimientos</TabsTrigger>
          <TabsTrigger value="kardex" data-testid="inv-tab-kardex">Kardex</TabsTrigger>
          {canMaintain && <TabsTrigger value="adjustments" data-testid="inv-tab-adjustments">Ajustes y traslados</TabsTrigger>}
        </TabsList>
        <TabsContent value="summary"><SummaryTab /></TabsContent>
        <TabsContent value="balances"><BalancesTab /></TabsContent>
        <TabsContent value="custody"><CustodyTab /></TabsContent>
        <TabsContent value="movements"><MovementsTab /></TabsContent>
        <TabsContent value="kardex"><KardexTab /></TabsContent>
        {canMaintain && <TabsContent value="adjustments"><AdjustmentsTab /></TabsContent>}
      </Tabs>
    </div>
  )
}
