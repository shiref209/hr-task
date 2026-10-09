import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadProfileImage } from './employees-api';
import { employeeKeys } from './employee-keys';

export function useUploadProfileImage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadProfileImage(id, file),
    onSuccess: (employee) => {
      queryClient.setQueryData(employeeKeys.detail(id), employee);
      return queryClient.invalidateQueries({ queryKey: employeeKeys.lists });
    },
  });
}
