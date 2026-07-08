import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { useGlobalSettingsState } from '../../states/SettingsStates';

/**
 * Effective currency for an order: explicit order currency, else the
 * customer's currency, else the global default (same fallback chain
 * as the classic SalesOrderDetail page).
 */
export function effectiveOrderCurrency(order: any): string {
  return (
    order?.order_currency ||
    order?.customer_detail?.currency ||
    order?.supplier_detail?.currency ||
    useGlobalSettingsState.getState().lookup.INVENTREE_DEFAULT_CURRENCY ||
    'USD'
  );
}

/**
 * Sales order status codes (order/status_codes.py) and the actions
 * available in each state. This is the single place where the FZ SO
 * header derives its buttons from — the Phase 2 approval gate will
 * plug in here (an 'Approve' action + approval_status chip).
 */
export const SO_STATUS = {
  PENDING: 10,
  IN_PROGRESS: 15,
  SHIPPED: 20,
  ON_HOLD: 25,
  COMPLETE: 30,
  CANCELLED: 40,
  LOST: 50,
  RETURNED: 60
} as const;

/** Statuses in which line items may still be edited / allocated */
export const SO_EDITABLE_STATUSES: number[] = [
  SO_STATUS.PENDING,
  SO_STATUS.IN_PROGRESS,
  SO_STATUS.ON_HOLD
];

export interface SoAction {
  key: string;
  label: string;
  color: string;
  variant?: string;
  endpoint: ApiEndpoints;
  confirm?: string;
}

/**
 * Actions available for a sales order in its current status.
 * All endpoints take the order pk as :id and an empty POST body.
 */
export function soActions(order: any): SoAction[] {
  const status: number = order?.status ?? 0;

  switch (status) {
    case SO_STATUS.PENDING:
      return [
        {
          key: 'issue',
          label: 'Issue Order',
          color: 'blue',
          endpoint: ApiEndpoints.sales_order_issue
        },
        {
          key: 'hold',
          label: 'Hold',
          color: 'orange',
          variant: 'default',
          endpoint: ApiEndpoints.sales_order_hold
        },
        {
          key: 'cancel',
          label: 'Cancel',
          color: 'red',
          variant: 'default',
          endpoint: ApiEndpoints.sales_order_cancel,
          confirm: 'Cancel this order? This cannot be undone.'
        }
      ];
    case SO_STATUS.IN_PROGRESS:
      return [
        {
          key: 'complete',
          label: 'Complete Order',
          color: 'green',
          endpoint: ApiEndpoints.sales_order_complete,
          confirm: 'Mark this order as complete?'
        },
        {
          key: 'hold',
          label: 'Hold',
          color: 'orange',
          variant: 'default',
          endpoint: ApiEndpoints.sales_order_hold
        },
        {
          key: 'cancel',
          label: 'Cancel',
          color: 'red',
          variant: 'default',
          endpoint: ApiEndpoints.sales_order_cancel,
          confirm: 'Cancel this order? This cannot be undone.'
        }
      ];
    case SO_STATUS.ON_HOLD:
      return [
        {
          key: 'issue',
          label: 'Resume Order',
          color: 'blue',
          endpoint: ApiEndpoints.sales_order_issue
        },
        {
          key: 'cancel',
          label: 'Cancel',
          color: 'red',
          variant: 'default',
          endpoint: ApiEndpoints.sales_order_cancel,
          confirm: 'Cancel this order? This cannot be undone.'
        }
      ];
    case SO_STATUS.SHIPPED:
      return [
        {
          key: 'complete',
          label: 'Complete Order',
          color: 'green',
          endpoint: ApiEndpoints.sales_order_complete
        }
      ];
    default:
      return [];
  }
}
