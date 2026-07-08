export interface PriceBreak {
  pk: number;
  part: number;
  quantity: number;
  price: string;
  price_currency: string;
  customer: number | null;
  customer_detail?: { pk: number; name: string } | null;
}

export interface PriceBreakMatch {
  price: string;
  break: PriceBreak;
  customerSpecific: boolean;
}

/**
 * Pick the applicable sale price break for a part.
 *
 * Selection rules (fixes the classic form, which ignored the customer FK):
 * 1. Only breaks matching the order currency and quantity threshold apply.
 *    Generic breaks (no customer) and breaks for the order's customer apply;
 *    breaks for other customers never do.
 * 2. Customer-specific breaks win over generic ones.
 * 3. Within that, the highest quantity threshold wins.
 */
export function pickPriceBreak(
  breaks: PriceBreak[] | undefined,
  {
    customerId,
    currency,
    quantity
  }: { customerId: number | null; currency: string; quantity: number }
): PriceBreakMatch | null {
  if (!breaks || breaks.length === 0 || quantity <= 0) {
    return null;
  }

  const applicable = breaks.filter(
    (pb) =>
      pb.price_currency === currency &&
      quantity >= Number(pb.quantity) &&
      (pb.customer == null || pb.customer === customerId)
  );

  if (applicable.length === 0) {
    return null;
  }

  applicable.sort((a, b) => {
    const aSpecific = a.customer != null ? 1 : 0;
    const bSpecific = b.customer != null ? 1 : 0;

    if (aSpecific !== bSpecific) {
      return bSpecific - aSpecific;
    }

    return Number(b.quantity) - Number(a.quantity);
  });

  const chosen = applicable[0];

  return {
    price: chosen.price,
    break: chosen,
    customerSpecific: chosen.customer != null
  };
}

export interface SupplierPriceBreak {
  pk: number;
  part: number; // SupplierPart pk
  quantity: number;
  price: string;
  price_currency: string;
}

export interface SupplierPriceBreakMatch {
  price: string;
  break: SupplierPriceBreak;
}

/**
 * Pick the applicable supplier price break for a PO line, mirroring the
 * backend's SupplierPart.get_price (common/currency.py):
 * 1. Only breaks in the order currency apply — no client-side FX; leave
 *    the price blank instead and let the server fill it via auto_pricing.
 * 2. The largest quantity threshold <= quantity wins.
 * 3. Below the smallest threshold, the smallest break applies.
 */
export function pickSupplierPriceBreak(
  breaks: SupplierPriceBreak[] | undefined,
  { currency, quantity }: { currency: string; quantity: number }
): SupplierPriceBreakMatch | null {
  if (!breaks || quantity <= 0) {
    return null;
  }

  const sameCurrency = breaks.filter((pb) => pb.price_currency === currency);

  if (sameCurrency.length === 0) {
    return null;
  }

  const applicable = sameCurrency
    .filter((pb) => quantity >= Number(pb.quantity))
    .sort((a, b) => Number(b.quantity) - Number(a.quantity));

  const chosen =
    applicable[0] ??
    [...sameCurrency].sort(
      (a, b) => Number(a.quantity) - Number(b.quantity)
    )[0];

  return { price: chosen.price, break: chosen };
}

/** Short human hint for where an auto-applied price came from. */
export function priceBreakHint(match: PriceBreakMatch): string {
  const source = match.customerSpecific
    ? (match.break.customer_detail?.name ?? 'customer')
    : 'standard';
  return `${source}, ${Number(match.break.quantity)}+`;
}
