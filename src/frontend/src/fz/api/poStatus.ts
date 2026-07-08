import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import type { SoAction } from './soStatus';

/** Purchase order status codes (order/status_codes.py). */
export const PO_STATUS = {
  PENDING: 10,
  PLACED: 20,
  ON_HOLD: 25,
  COMPLETE: 30,
  CANCELLED: 40,
  LOST: 50,
  RETURNED: 60
} as const;

/** Statuses in which line items may still be edited */
export const PO_EDITABLE_STATUSES: number[] = [
  PO_STATUS.PENDING,
  PO_STATUS.PLACED,
  PO_STATUS.ON_HOLD
];

/** Actions available for a purchase order in its current status. */
export function poActions(order: any): SoAction[] {
  const status: number = order?.status ?? 0;

  switch (status) {
    case PO_STATUS.PENDING:
      return [
        {
          key: 'issue',
          label: 'Place Order',
          color: 'blue',
          endpoint: ApiEndpoints.purchase_order_issue
        },
        {
          key: 'hold',
          label: 'Hold',
          color: 'orange',
          variant: 'default',
          endpoint: ApiEndpoints.purchase_order_hold
        },
        {
          key: 'cancel',
          label: 'Cancel',
          color: 'red',
          variant: 'default',
          endpoint: ApiEndpoints.purchase_order_cancel,
          confirm: 'Cancel this order? This cannot be undone.'
        }
      ];
    case PO_STATUS.PLACED:
      return [
        {
          key: 'complete',
          label: 'Complete Order',
          color: 'green',
          endpoint: ApiEndpoints.purchase_order_complete,
          confirm: 'Mark this order as complete?'
        },
        {
          key: 'hold',
          label: 'Hold',
          color: 'orange',
          variant: 'default',
          endpoint: ApiEndpoints.purchase_order_hold
        },
        {
          key: 'cancel',
          label: 'Cancel',
          color: 'red',
          variant: 'default',
          endpoint: ApiEndpoints.purchase_order_cancel,
          confirm: 'Cancel this order? This cannot be undone.'
        }
      ];
    case PO_STATUS.ON_HOLD:
      return [
        {
          key: 'issue',
          label: 'Place Order',
          color: 'blue',
          endpoint: ApiEndpoints.purchase_order_issue
        },
        {
          key: 'cancel',
          label: 'Cancel',
          color: 'red',
          variant: 'default',
          endpoint: ApiEndpoints.purchase_order_cancel,
          confirm: 'Cancel this order? This cannot be undone.'
        }
      ];
    default:
      return [];
  }
}
