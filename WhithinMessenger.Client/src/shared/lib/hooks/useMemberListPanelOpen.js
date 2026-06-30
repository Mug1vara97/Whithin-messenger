import { useCallback, useState } from 'react';

import { memberListPanelOpenStorage } from '../utils/memberListPanelOpenStorage';

export const useMemberListPanelOpen = () => {
  const [open, setOpenState] = useState(() => memberListPanelOpenStorage.get());

  const setOpen = useCallback((value) => {
    setOpenState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      memberListPanelOpenStorage.set(next);
      return next;
    });
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, [setOpen]);

  return { open, setOpen, toggle };
};
