import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ApiEndpoints as Endpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../contexts/ApiContext';
import { type Branch, useBranchState } from '../state/BranchState';

/**
 * Query keys in the FZ app are always prefixed with ['fz', activeBranchId]
 * so that switching branch refetches everything without manual invalidation.
 */
export function fzKey(branchId: number | null, ...parts: any[]) {
  return ['fz', branchId, ...parts];
}

/** InvenTree list endpoints return a plain array, or {results} when paginated. */
export function listResults(data: any): any[] {
  return Array.isArray(data) ? data : (data?.results ?? []);
}

/** Fetch the list of active branches (not branch-scoped itself). */
export function useBranches() {
  const api = useApi();

  return useQuery<Branch[]>({
    queryKey: ['fz', 'branches'],
    queryFn: async () =>
      api
        .get(apiUrl(Endpoints.tenant_list), { params: { is_active: true } })
        .then((res) => listResults(res.data))
  });
}

/**
 * Branch-scoped GET query. Merges `tenant=<active branch>` into list params
 * (disable with scoped: false for per-record detail queries, which are
 * already implicitly scoped) and prefixes the query key with the branch.
 */
export function useBranchQuery<T = any>({
  key,
  endpoint,
  pk,
  params,
  scoped = true,
  enabled = true
}: {
  key: any[];
  endpoint: ApiEndpoints | string;
  pk?: number | string;
  params?: Record<string, any>;
  scoped?: boolean;
  enabled?: boolean;
}) {
  const api = useApi();
  const branchId = useBranchState((s) => s.activeBranchId);

  return useQuery<T>({
    queryKey: fzKey(branchId, ...key),
    enabled: enabled && branchId != null,
    queryFn: async () =>
      api
        .get(apiUrl(endpoint, pk), {
          params: scoped ? { ...params, tenant: branchId } : params
        })
        .then((res) => res.data)
  });
}

/**
 * Query keys for branch-independent data (parts, parameter templates,
 * customers): prefixed ['fz-global'] so switching branch does not
 * refetch them and branch invalidation does not touch them.
 */
export function fzGlobalKey(...parts: any[]) {
  return ['fz-global', ...parts];
}

/** GET query for global (non-branch) data. */
export function useGlobalQuery<T = any>({
  key,
  endpoint,
  pk,
  params,
  enabled = true
}: {
  key: any[];
  endpoint: ApiEndpoints | string;
  pk?: number | string;
  params?: Record<string, any>;
  enabled?: boolean;
}) {
  const api = useApi();

  return useQuery<T>({
    queryKey: fzGlobalKey(...key),
    enabled: enabled,
    queryFn: async () =>
      api.get(apiUrl(endpoint, pk), { params: params }).then((res) => res.data)
  });
}

/** Invalidate every query for the active branch (post-mutation refresh). */
export function useInvalidateBranch() {
  const queryClient = useQueryClient();
  const branchId = useBranchState((s) => s.activeBranchId);

  return () => queryClient.invalidateQueries({ queryKey: ['fz', branchId] });
}
