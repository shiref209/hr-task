import { ErrorView, Skeleton, useToast } from '../../../shared/ui';
import { toApiError } from '../../../shared/http/http-client';
import { apiErrorToForm } from '../../employees/form/api-error-to-form';
import { useSocialInsurance, useUpdateSocialInsurance } from '../api/use-social-insurance';
import { SocialInsuranceForm } from '../components/social-insurance-form';
import '../payroll.scss';

export function SocialInsurancePage() {
  const settings = useSocialInsurance();
  const update = useUpdateSocialInsurance();
  const toast = useToast();

  const renderBody = () => {
    if (settings.isPending) {
      return (
        <div aria-busy="true">
          <Skeleton variant="rect" />
        </div>
      );
    }
    if (settings.isError) return <ErrorView error={settings.error} onRetry={() => void settings.refetch()} />;
    const { rate, cap } = settings.data;
    return (
      <SocialInsuranceForm
        // Remount on a saved change so the form's baseline (and "unchanged") follows the server.
        key={`${rate}|${cap ?? ''}`}
        initial={settings.data}
        isSaving={update.isPending}
        onSubmit={async (input) => {
          try {
            await update.mutateAsync(input);
            toast.show({ variant: 'success', title: 'Social insurance saved' });
            return undefined;
          } catch (cause) {
            const error = toApiError(cause);
            const mapped = apiErrorToForm(error);
            if (Object.keys(mapped.fieldErrors).length === 0 && !mapped.formError) {
              toast.show({
                variant: 'error',
                title: 'Could not save social insurance',
                description: error.problem.detail ?? error.problem.title,
              });
            }
            return mapped;
          }
        }}
      />
    );
  };

  return (
    <div className="payroll-page">
      <h1 className="payroll-page__title">Social insurance</h1>
      {renderBody()}
    </div>
  );
}
