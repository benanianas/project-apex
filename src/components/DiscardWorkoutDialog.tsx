import { useRef, useState } from 'react';
import { Modal, useData } from './ui';

export default function DiscardWorkoutDialog({
  title,
  onClose,
  onDiscard,
}: {
  title: string;
  onClose: () => void;
  onDiscard: () => Promise<void>;
}) {
  const { report } = useData();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function discard() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await onDiscard();
    } catch (error) {
      report(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Cancel this workout?"
      onClose={() => {
        if (!pending.current) onClose();
      }}
    >
      <p>
        Discard <strong>{title}</strong> and all sets, notes, cardio and jump-rope entries saved in
        this workout?
      </p>
      <p className="muted">
        This cannot be undone. It won’t count as a completed workout. To resume later, keep the
        workout and go back to Today.
      </p>
      <div className="discard-actions">
        <button className="primary" disabled={busy} onClick={onClose}>
          Keep workout
        </button>
        <button className="danger" disabled={busy} onClick={() => void discard()}>
          {busy ? 'Discarding…' : 'Discard workout'}
        </button>
      </div>
    </Modal>
  );
}
