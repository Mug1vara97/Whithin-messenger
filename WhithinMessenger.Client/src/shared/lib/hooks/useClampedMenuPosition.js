import { useLayoutEffect, useState } from 'react';
import { clampMenuPosition } from '../utils/clampMenuPosition';

export function useClampedMenuPosition(visible, position, menuRef, options = {}) {
  const [clampedPosition, setClampedPosition] = useState(position);
  const avoidSelector = options.avoidSelector ?? null;
  const maxBottom = options.maxBottom ?? null;

  useLayoutEffect(() => {
    if (!visible || !menuRef.current) {
      setClampedPosition(position);
      return undefined;
    }

    const clampOptions = {
      avoidSelector,
      maxBottom,
    };

    const updatePosition = () => {
      if (!menuRef.current) return;

      const rect = menuRef.current.getBoundingClientRect();
      const width = rect.width || menuRef.current.offsetWidth;
      const height = rect.height || menuRef.current.offsetHeight;

      setClampedPosition(
        clampMenuPosition(position.x, position.y, width, height, undefined, clampOptions),
      );
    };

    updatePosition();
    const rafId = requestAnimationFrame(updatePosition);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible, position.x, position.y, menuRef, avoidSelector, maxBottom]);

  return clampedPosition;
}
