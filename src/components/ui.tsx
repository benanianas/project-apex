import {
  Component,
  cloneElement,
  isValidElement,
  createContext,
  useContext,
  useEffect,
  useRef,
  useId,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import type { Cardio, Exercise, Program, Rope, Session, Settings } from '../domain/model';
export interface AppData {
  exercises: Exercise[];
  programs: Program[];
  sessions: Session[];
  cardio: Cardio[];
  rope: Rope[];
  settings: Settings;
  program: Program;
  notify: (s: string) => void;
  report: (e: unknown) => void;
}
export const DataContext = createContext<AppData | null>(null);
export function useData() {
  const d = useContext(DataContext);
  if (!d) throw new Error('App data unavailable');
  return d;
}
export const go = (route: string) => {
  window.location.hash = route;
  window.scrollTo({ top: 0, behavior: 'instant' });
};
export const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : 'Could not save. Your device storage may be unavailable or full. Please export a backup and retry.';
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-mark">↗</span>
      <h3>{title}</h3>
      <p className="muted">{children}</p>
    </div>
  );
}
export function Back({ to = 'exercises', label = 'Back' }: { to?: string; label?: string }) {
  return (
    <button className="text-button back" onClick={() => go(to)}>
      <ArrowLeft size={17} />
      {label}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {isValidElement(children) && typeof children.type === 'string'
        ? cloneElement(children as ReactElement<{ 'aria-label'?: string }>, { 'aria-label': label })
        : children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function NumberInput({
  value,
  onChange,
  label,
  unit,
  max = 100000,
  min = 0,
  step = 'any',
  disabled = false,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  label: string;
  unit?: string;
  max?: number;
  min?: number;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <div className="number-input">
      <input
        aria-label={label}
        inputMode={step === '1' ? 'numeric' : 'decimal'}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        placeholder="—"
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') onChange(null);
          else {
            const n = Number(raw);
            if (Number.isFinite(n) && n >= min && n <= max && (step !== '1' || Number.isInteger(n)))
              onChange(n);
          }
        }}
      />
      {unit && <span>{unit}</span>}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const gesture = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    el?.showModal();
    return () => {
      el?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="sheet-handle"
        aria-hidden="true"
        onPointerDown={(e) => {
          gesture.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (gesture.current !== null && e.clientY - gesture.current > 70) onClose();
          gesture.current = null;
        }}
      >
        <span />
      </div>
      <div className="section-heading">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="Close dialog" className="icon-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function CheckRow({
  label,
  checked,
  onChange,
  guide,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  guide?: () => void;
}) {
  return (
    <div className="check-row">
      <button
        className={`check-control ${checked ? 'checked' : ''}`}
        aria-label={`${checked ? 'Uncheck' : 'Complete'} ${label}`}
        aria-pressed={checked}
        onClick={onChange}
      >
        {checked && <Check size={16} />}
      </button>
      <span>{label}</span>
      {guide && (
        <button className="text-button small" onClick={guide}>
          Guide ↗
        </button>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: string | number;
  unit?: string;
  detail?: string;
}) {
  return (
    <div className="stat">
      <p>{label}</p>
      <strong>
        {value}
        <span>{unit}</span>
      </strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('APEX view error', error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Let’s get you back.</h1>
        <p>The screen could not load. Saved IndexedDB records have not been erased.</p>
        <p>{this.state.error}</p>
        <button onClick={() => location.reload()}>Reload APEX</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
