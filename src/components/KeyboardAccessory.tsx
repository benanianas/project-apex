import { useEffect, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
export default function KeyboardAccessory() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const active = document.activeElement;
      const editing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      const inset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      const visible = editing && inset > 120;
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
      document.documentElement.style.setProperty(
        '--visible-height',
        `${viewport?.height ?? window.innerHeight}px`,
      );
      document.documentElement.classList.toggle('keyboard-open', visible);
      setOpen(visible);
    };
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    update();
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      document.documentElement.classList.remove('keyboard-open');
    };
  }, []);
  function next() {
    const active = document.activeElement;
    const scope = active?.closest('dialog, .exercise-log, form') ?? document.querySelector('main');
    const inputs = [
      ...(scope?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="checkbox"]):not([type="file"]), textarea',
      ) ?? []),
    ].filter((el) => !el.disabled && el.getClientRects().length > 0);
    const index = inputs.indexOf(active as HTMLInputElement);
    const target = inputs[index + 1];
    if (target) {
      target.focus();
      target.select();
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (active instanceof HTMLElement) active.blur();
  }
  if (!open) return null;
  return (
    <div className="keyboard-accessory" onPointerDown={(e) => e.preventDefault()}>
      <button onClick={next}>
        <ChevronDown size={19} />
        Next field
      </button>
      <button
        onClick={() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        }}
      >
        <Check size={18} />
        Done
      </button>
    </div>
  );
}
