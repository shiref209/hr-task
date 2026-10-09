import { loginSchema, type LoginInput } from '@hr/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toApiError } from '../../../shared/http/http-client';
import { Button, Card, FormAlert, TextInput } from '../../../shared/ui';
import { login } from '../api/auth-api';
import { sessionKey, useSession } from '../api/use-session';
import { safeNextPath } from '../safe-next';
import '../auth.scss';

type LoginFormValues = { email: string; password: string };

function failureMessage(error: unknown): string {
  const { status, message } = toApiError(error);
  if (status === 401) return 'Invalid email or password';
  if (status === 429) return 'Too many sign-in attempts. Try again in a minute.';
  return message;
}

export function LoginPage() {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const { register, handleSubmit, resetField, formState: { errors } } = useForm<LoginFormValues, unknown, LoginInput>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(loginSchema),
  });
  const signIn = useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (signedIn) => queryClient.setQueryData(sessionKey, signedIn),
    onError: () => resetField('password'),
  });

  // Covers both a visitor who is already signed in and the moment sign-in succeeds.
  if (user) return <Navigate to={safeNextPath(params.get('next'))} replace />;

  return (
    <main className="login-page">
      <h1 className="login-page__brand">HR Payroll</h1>
      <div className="login-page__card">
        <Card title="Sign in">
          <form
            className="login-page__form"
            noValidate
            onSubmit={handleSubmit((values) => signIn.mutate(values))}
          >
            <TextInput
              label="Email"
              type="email"
              autoComplete="username"
              error={errors.email?.message}
              {...register('email')}
            />
            <TextInput
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <FormAlert message={signIn.isError ? failureMessage(signIn.error) : undefined} />
            <Button type="submit" isLoading={signIn.isPending} fullWidth>
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
