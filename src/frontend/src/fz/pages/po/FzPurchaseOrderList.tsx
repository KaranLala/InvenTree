import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import FzPlaceholder from '../../components/FzPlaceholder';

export default function FzPurchaseOrderList() {
  return (
    <FzPlaceholder
      title='Purchase Orders'
      endpoint={ApiEndpoints.purchase_order_list}
      countLabel='purchase orders'
    />
  );
}
