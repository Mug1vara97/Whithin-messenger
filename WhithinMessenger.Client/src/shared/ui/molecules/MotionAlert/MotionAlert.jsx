import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react';
import './MotionAlert.css';

const EASE_OUT = [0.16, 1, 0.3, 1];
const SPRING_PRESS = { type: 'spring', stiffness: 500, damping: 30, mass: 0.6 };

const VARIANT_ICON = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
};

const AlertContext = createContext(null);

function useAlertContext(name) {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error(`${name} must be used within <MotionAlert>`);
  return ctx;
}

export function useMotionAlert() {
  return useAlertContext('useMotionAlert');
}

/**
 * Animated alert inspired by beUI Motion Alert.
 * https://beui.dev/components/motion/alert
 */
export function MotionAlert({
  variant = 'default',
  open: controlledOpen,
  defaultOpen = true,
  onOpenChange,
  /** When false, parent owns enter/exit (e.g. toast stack AnimatePresence). */
  presence = true,
  className = '',
  contentClassName = '',
  role,
  children,
  ...props
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const reduce = useReducedMotion() ?? false;
  const titleId = useId();

  const setOpen = useCallback(
    (next) => {
      if (next === open) return;
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange, open]
  );

  const dismiss = useCallback(() => setOpen(false), [setOpen]);

  const context = useMemo(
    () => ({ open, variant, reduce, setOpen, dismiss, titleId }),
    [open, variant, reduce, setOpen, dismiss, titleId]
  );

  const alertRole =
    role || (variant === 'warning' || variant === 'destructive' ? 'alert' : 'status');

  const surface = (
    <motion.div
      {...props}
      role={alertRole}
      data-slot="alert"
      data-variant={variant}
      data-state={open ? 'open' : 'closed'}
      initial={presence ? { opacity: 0, y: reduce ? 0 : -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={
        presence
          ? {
              opacity: 0,
              y: reduce ? 0 : -6,
              transition: { duration: 0.12, ease: EASE_OUT },
            }
          : undefined
      }
      transition={{
        opacity: { duration: 0.18, ease: EASE_OUT },
        y: { duration: 0.2, ease: EASE_OUT },
      }}
      className={`motion-alert motion-alert--${variant} ${className}`.trim()}
    >
      <div className={`motion-alert__row ${contentClassName}`.trim()}>{children}</div>
    </motion.div>
  );

  return (
    <AlertContext.Provider value={context}>
      {presence ? (
        <AnimatePresence initial={false}>{open ? surface : null}</AnimatePresence>
      ) : open ? (
        surface
      ) : null}
    </AlertContext.Provider>
  );
}

export function MotionAlertIcon({ className = '', children, ...props }) {
  const { variant, reduce } = useAlertContext('MotionAlertIcon');
  const Icon = VARIANT_ICON[variant] || Info;
  return (
    <span
      {...props}
      aria-hidden="true"
      data-slot="alert-icon"
      className={`motion-alert__icon ${className}`.trim()}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={variant}
          initial={{
            opacity: 0,
            y: reduce ? 0 : 4,
            scale: reduce ? 1 : 0.9,
          }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: reduce ? 0 : -4,
            scale: reduce ? 1 : 0.9,
            transition: { duration: 0.1, ease: EASE_OUT },
          }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="motion-alert__icon-swap"
        >
          {children ?? <Icon size={16} strokeWidth={2.25} />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function MotionAlertContent({ className = '', ...props }) {
  return (
    <div
      {...props}
      data-slot="alert-content"
      className={`motion-alert__content ${className}`.trim()}
    />
  );
}

export function MotionAlertTitle({ className = '', id, ...props }) {
  const { titleId } = useAlertContext('MotionAlertTitle');
  return (
    <div
      {...props}
      id={id || titleId}
      data-slot="alert-title"
      className={`motion-alert__title ${className}`.trim()}
    />
  );
}

export function MotionAlertDescription({ className = '', ...props }) {
  return (
    <div
      {...props}
      data-slot="alert-description"
      className={`motion-alert__description ${className}`.trim()}
    />
  );
}

export function MotionAlertClose({ className = '', children, onClick, ...props }) {
  const { dismiss, reduce } = useAlertContext('MotionAlertClose');
  return (
    <motion.button
      type="button"
      aria-label="Закрыть"
      {...props}
      data-slot="alert-close"
      whileTap={reduce ? undefined : { scale: 0.94 }}
      transition={SPRING_PRESS}
      className={`motion-alert__close ${className}`.trim()}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) dismiss();
      }}
    >
      {children ?? <X size={16} strokeWidth={2.25} aria-hidden="true" />}
    </motion.button>
  );
}

export default MotionAlert;
