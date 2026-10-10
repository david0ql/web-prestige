import { QueryClient, MutationCache } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: (count, err) => !(err instanceof ApiError && [400, 401, 403, 404, 422].includes(err.status)) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onError: (err, _v, _c, mutation) => {
      // Las mutaciones que manejan su propio error (meta.silent) no muestran toast global.
      if (mutation.meta?.silent) return
      toast.error(err instanceof Error ? err.message : 'Ocurrió un error')
    },
  }),
})
