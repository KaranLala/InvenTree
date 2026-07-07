import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import FzPlaceholder from '../../components/FzPlaceholder';

export default function FzSalesOrderList() {
  return (
    <FzPlaceholder
      title='Sales Orders'
      endpoint={ApiEndpoints.sales_order_list}
      countLabel='sales orders'
    />
  );
}
