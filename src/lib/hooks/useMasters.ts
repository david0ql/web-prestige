import { useQuery } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import type { Customer, FinanceCategory, Location, Material, PaymentMethod, Product, ProductFamily, ProductionStage, TechnicalVariable, Unit, Workshop } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'

/** Catálogos maestros cacheados (5 min). Solo se piden si el rol puede leerlos. */
const LONG = 5 * 60_000

export const useMaterials = () =>
  useQuery({ queryKey: ['materials', 'all'], queryFn: () => api.get<Paginated<Material>>('/materials', { pageSize: 200 }).then((r) => r.items), staleTime: LONG })

export const useWorkshops = () => {
  const can = usePermission('masters.read')
  return useQuery({ queryKey: ['workshops', 'all'], queryFn: () => api.get<Paginated<Workshop>>('/workshops', { pageSize: 200 }).then((r) => r.items), staleTime: LONG, enabled: can })
}

export const useProducts = (workshopId?: string) => {
  const can = usePermission('masters.read', 'catalog.read')
  return useQuery({
    queryKey: ['products', 'all', workshopId ?? ''],
    queryFn: () => api.get<Paginated<Product>>('/products', { pageSize: 200, workshopId }).then((r) => r.items),
    staleTime: LONG,
    enabled: can,
  })
}

export const useCustomers = (search = '') => {
  const can = usePermission('customers.read')
  return useQuery({ queryKey: ['customers', 'search', search], queryFn: () => api.get<Paginated<Customer>>('/customers', { pageSize: 50, search }).then((r) => r.items), enabled: can })
}

export const useStages = () => useQuery({ queryKey: ['stages'], queryFn: () => api.get<ProductionStage[]>('/production-stages'), staleTime: LONG })
export const useVariables = () => useQuery({ queryKey: ['variables'], queryFn: () => api.get<TechnicalVariable[]>('/technical-variables'), staleTime: LONG })
export const useFamilies = () => useQuery({ queryKey: ['families'], queryFn: () => api.get<ProductFamily[]>('/product-families'), staleTime: LONG })
export const useUnits = () => useQuery({ queryKey: ['units'], queryFn: () => api.get<Unit[]>('/units'), staleTime: LONG })
export const useLocations = () => {
  const can = usePermission('masters.read')
  return useQuery({ queryKey: ['locations'], queryFn: () => api.get<Location[]>('/locations'), staleTime: LONG, enabled: can })
}
export const usePaymentMethods = () => useQuery({ queryKey: ['payment-methods'], queryFn: () => api.get<PaymentMethod[]>('/payment-methods'), staleTime: LONG })
export const useFinanceCategories = () => useQuery({ queryKey: ['finance-categories'], queryFn: () => api.get<FinanceCategory[]>('/finance-categories'), staleTime: LONG })
