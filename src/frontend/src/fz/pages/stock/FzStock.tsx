import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import FzPlaceholder from '../../components/FzPlaceholder';

export default function FzStock() {
  return (
    <FzPlaceholder
      title='Stock'
      endpoint={ApiEndpoints.stock_location_list}
      countLabel='stock locations'
    />
  );
}
