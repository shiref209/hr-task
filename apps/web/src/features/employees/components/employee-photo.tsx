import type { Employee } from '@hr/types';
import { useRef, useState, type ChangeEvent } from 'react';
import { resolveAssetUrl, toApiError } from '../../../shared/http/http-client';
import { Avatar, Button } from '../../../shared/ui';
import { useUploadProfileImage } from '../api/use-upload-profile-image';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

export function EmployeePhoto({ employee }: { employee: Employee }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const upload = useUploadProfileImage(employee.id);

  const onFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // lets the same file be chosen again after an error
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return setError('Use a JPEG, PNG or WebP image.');
    if (file.size > MAX_BYTES) return setError('The image must be 2 MB or smaller.');
    setError(undefined);
    upload.mutate(file, {
      onError: (cause) => {
        const { problem } = toApiError(cause);
        setError(problem.detail ?? problem.title);
      },
    });
  };

  return (
    <div className="employee-photo">
      <Avatar name={employee.fullName} src={resolveAssetUrl(employee.profileImageUrl)} size="lg" />
      <div className="employee-photo__actions">
        <Button
          variant="secondary"
          size="sm"
          isLoading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          Change photo
        </Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={ACCEPTED_TYPES.join(',')}
          onChange={onFileChosen}
        />
        {error ? (
          <p className="employee-photo__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
