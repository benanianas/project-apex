import { useState } from 'react';
import { Field, Modal } from './ui';
export default function SkipItemDialog({
  name,
  onClose,
  onSkip,
}: {
  name: string;
  onClose: () => void;
  onSkip: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Skip this item?" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim()) onSkip(reason.trim());
        }}
      >
        <p>
          {name}. Any completed sets stay recorded. Skipping mandatory work leaves essentials
          partially complete; optional work can be skipped freely.
        </p>
        <Field label="Reason for skipping">
          <select
            value={
              reason === 'Time limited' ||
              reason === 'Recovery / fatigue' ||
              reason === 'Pain or concerning symptoms' ||
              reason === 'Equipment unavailable'
                ? reason
                : ''
            }
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">Choose a reason or write below</option>
            {[
              'Time limited',
              'Recovery / fatigue',
              'Pain or concerning symptoms',
              'Equipment unavailable',
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Skip reason / notes">
          <textarea
            required
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <button className="primary" disabled={!reason.trim()}>
          Save skip
        </button>
      </form>
    </Modal>
  );
}
