import { useLayoutEffect, useState } from 'react';
import { clampMenuPosition } from '../utils/clampMenuPosition';

export function useClampedMenuPosition(visible, position, menuRef) {
  const [clampedPosition, setClampedPosition] = useState(position);

  useLayoutEffect(() => {
    if (!visible || !menuRef.current) {
      setClampedPosition(position);
      return undefined;
    }

    const updatePosition = () => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      setClampedPosition(
        clampMenuPosition(position.x, position.y, rect.width, rect.height)
      );
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible, position.x, position.y, menuRef]);

  return clampedPosition;
}
