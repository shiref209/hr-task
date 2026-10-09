import { ErrorView, Skeleton, useToast } from '../../../shared/ui';
import { saveOrMapErrors } from '../../../shared/forms/api-error-to-form';
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
        onSubmit={(input) =>
          saveOrMapErrors(
            async () => {
              await update.mutateAsync(input);
              toast.show({ variant: 'success', title: 'Social insurance saved' });
            },
            { toast, failureTitle: 'Could not save social insurance' },
          )
        }
      />
    );
  };

  return (
    <div className="page">
      <h1 className="page__title">Social insurance</h1>
      {renderBody()}
    </div>
  );
}
