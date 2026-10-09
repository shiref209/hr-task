import { useState } from 'react';
import { initialsOf } from './initials-of';
import './avatar.scss';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const className = `avatar avatar--${size}`;

  if (src && failedSrc !== src) {
    return (
      <img
        className={className}
        src={src}
        alt={name}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  const initials = initialsOf(name);
  return (
    <span
      className={className}
      role="img"
      aria-label={initials ? name : 'Unknown user'}
    >
      {initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <svg
          className="avatar__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="currentColor"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
        </svg>
      )}
    </span>
  );
}
