import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';

/**
 * Find-or-create the SupplierPart linking a part to a supplier.
 *
 * The FZ PO page lets the user pick any purchaseable part; the backend
 * still requires a SupplierPart on every PO line, so the link record is
 * resolved (or silently created) here. Auto-created links get SKU = IPN
 * (fallback: part name) and pack size 1, so receiving stays 1:1.
 */

/** SKU for an auto-created supplier part link (SKU max_length is 100). */
export function buildAutoSku(part: { IPN?: string; name: string }): string {
  return (part.IPN?.trim() || part.name).slice(0, 100);
}

/**
 * Choose which existing SupplierPart to reuse for a (part, supplier) pair.
 * Inactive candidates are eligible: the PO line API accepts them, and
 * creating a duplicate would trip the (part, supplier, SKU) constraint.
 */
export function pickExistingSupplierPart(candidates: any[]): any | null {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const score = (sp: any) => (sp.active ? 1 : 0) + (sp.primary ? 2 : 0);

  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

/** Fetch the reusable SupplierPart (with price breaks) or null if none. */
export async function lookupSupplierPart(
  api: any,
  { partId, supplierId }: { partId: number; supplierId: number }
): Promise<any | null> {
  const response = await api.get(apiUrl(ApiEndpoints.supplier_part_list), {
    params: {
      part: partId,
      supplier: supplierId,
      price_breaks: true,
      limit: 100
    }
  });

  const data = response.data;
  return pickExistingSupplierPart(
    Array.isArray(data) ? data : (data?.results ?? [])
  );
}

/**
 * Return the SupplierPart for (part, supplier), creating a minimal one if
 * none exists. On a create failure (concurrent create elsewhere), retries
 * the lookup once before giving up.
 */
export async function resolveSupplierPart(
  api: any,
  { part, supplierId }: { part: any; supplierId: number }
): Promise<any> {
  const existing = await lookupSupplierPart(api, {
    partId: part.pk,
    supplierId
  });

  if (existing) {
    return existing;
  }

  try {
    const response = await api.post(apiUrl(ApiEndpoints.supplier_part_list), {
      part: part.pk,
      supplier: supplierId,
      SKU: buildAutoSku(part)
    });
    return response.data;
  } catch (error) {
    const winner = await lookupSupplierPart(api, {
      partId: part.pk,
      supplierId
    }).catch(() => null);

    if (winner) {
      return winner;
    }

    throw error;
  }
}
