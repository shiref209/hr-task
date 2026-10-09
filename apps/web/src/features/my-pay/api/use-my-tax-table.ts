import { useQuery } from '@tanstack/react-query';
import { fetchMyTaxTable } from '../../auth/api/auth-api';

export function useMyTaxTable() {
  return useQuery({ queryKey: ['my-tax-table'], queryFn: fetchMyTaxTable });
}
