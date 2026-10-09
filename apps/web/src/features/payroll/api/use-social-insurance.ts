import type { SocialInsurance } from '@hr/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSocialInsurance, updateSocialInsurance } from './payroll-api';
import { payrollKeys } from './payroll-keys';

export function useSocialInsurance() {
  return useQuery({ queryKey: payrollKeys.socialInsurance, queryFn: fetchSocialInsurance });
}

export function useUpdateSocialInsurance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SocialInsurance) => updateSocialInsurance(input),
    onSuccess: (saved) => {
      queryClient.setQueryData(payrollKeys.socialInsurance, saved);
      return queryClient.invalidateQueries({ queryKey: payrollKeys.socialInsurance });
    },
  });
}
