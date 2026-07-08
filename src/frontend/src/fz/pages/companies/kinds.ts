import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';

/**
 * Customers and suppliers are both global Company records; the pages are
 * shared components parameterized by this config. Company/contact/address
 * writes are gated by the order role that owns them in the backend ruleset.
 */
export interface CompanyKind {
  key: 'customers' | 'suppliers';
  label: string;
  singular: string;
  flagParam: 'is_customer' | 'is_supplier';
  listPath: string;
  role: UserRoles;
  classicPath: (id: number | string) => string;
  ordersEndpoint: ApiEndpoints;
  orderFilterParam: 'customer' | 'supplier';
  orderRoute: string;
  orderModelType: ModelType;
  orderTotalField: 'total_with_tax' | 'total_price';
}

export const COMPANY_KINDS: Record<'customer' | 'supplier', CompanyKind> = {
  customer: {
    key: 'customers',
    label: 'Customers',
    singular: 'customer',
    flagParam: 'is_customer',
    listPath: '/b/customers/',
    role: UserRoles.sales_order,
    classicPath: (id) => `/sales/customer/${id}`,
    ordersEndpoint: ApiEndpoints.sales_order_list,
    orderFilterParam: 'customer',
    orderRoute: '/b/so/',
    orderModelType: ModelType.salesorder,
    orderTotalField: 'total_with_tax'
  },
  supplier: {
    key: 'suppliers',
    label: 'Suppliers',
    singular: 'supplier',
    flagParam: 'is_supplier',
    listPath: '/b/suppliers/',
    role: UserRoles.purchase_order,
    classicPath: (id) => `/purchasing/supplier/${id}`,
    ordersEndpoint: ApiEndpoints.purchase_order_list,
    orderFilterParam: 'supplier',
    orderRoute: '/b/po/',
    orderModelType: ModelType.purchaseorder,
    orderTotalField: 'total_price'
  }
};
