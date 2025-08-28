import React from 'react';
import { FiLoader } from 'react-icons/fi';

export type SubmitButtonContentProps = {
  submitting: boolean;
  label: string;
};

/**
 * Displays submit button content with a spinner when submitting.
 */
export function SubmitButtonContent({
  submitting,
  label,
}: SubmitButtonContentProps) {
  if (submitting) {
    return (
      <span className='inline-flex items-center gap-2'>
        <FiLoader className='animate-spin' />
        <span>Submitting…</span>
      </span>
    );
  }
  return <span>{label}</span>;
}

export default SubmitButtonContent;






