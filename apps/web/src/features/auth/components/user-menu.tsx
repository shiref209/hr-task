import type { AuthUser } from '@hr/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toApiError } from '../../../shared/http/http-client';
import { Button, useToast } from '../../../shared/ui';
import { logout } from '../api/auth-api';
import '../auth.scss';

const ROLE_LABEL: Record<AuthUser['role'], string> = { HR: 'HR', EMPLOYEE: 'Employee' };

export function UserMenu({ user }: { user: AuthUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear(); // nothing of this user may survive for the next one
      navigate('/login');
    },
    onError: (error) =>
      toast.show({ variant: 'error', title: 'Could not sign out', description: toApiError(error).message }),
  });

  return (
    <div className="user-menu">
      <p className="user-menu__identity">
        <span className="user-menu__name">{user.employee.fullName}</span>{' '}
        <span className="user-menu__role">{ROLE_LABEL[user.role]}</span>
      </p>
      <Button variant="secondary" size="sm" isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
        Sign out
      </Button>
    </div>
  );
}
