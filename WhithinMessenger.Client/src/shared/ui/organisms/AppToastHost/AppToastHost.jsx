import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  MotionAlert,
  MotionAlertClose,
  MotionAlertContent,
  MotionAlertDescription,
  MotionAlertIcon,
  MotionAlertTitle,
} from '../../molecules/MotionAlert';
import { dismissAppToast, subscribeAppToasts } from '../../../lib/utils/appToast';
import { hasElectronTitlebarChrome } from '../../molecules/ElectronTitlebar';
import './AppToastHost.css';

const EASE_OUT = [0.16, 1, 0.3, 1];

export function AppToastHost() {
  const [items, setItems] = useState([]);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => subscribeAppToasts(setItems), []);

  const titlebarClass = hasElectronTitlebarChrome() ? 'app-toast-host--with-titlebar' : '';

  return (
    <div className={`app-toast-host ${titlebarClass}`.trim()} aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((toast) => (
          <motion.div
            key={toast.id}
            layout={!reduce}
            initial={{ opacity: 0, y: reduce ? 0 : -8, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: reduce ? 0 : -6,
              scale: reduce ? 1 : 0.98,
              transition: { duration: 0.14, ease: EASE_OUT },
            }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="app-toast-host__item"
          >
            <MotionAlert
              variant={toast.variant}
              open
              presence={false}
              onOpenChange={(open) => {
                if (!open) dismissAppToast(toast.id);
              }}
            >
              <MotionAlertIcon />
              <MotionAlertContent>
                {toast.title ? <MotionAlertTitle>{toast.title}</MotionAlertTitle> : null}
                {toast.description ? (
                  <MotionAlertDescription>{toast.description}</MotionAlertDescription>
                ) : null}
              </MotionAlertContent>
              <MotionAlertClose />
            </MotionAlert>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default AppToastHost;
