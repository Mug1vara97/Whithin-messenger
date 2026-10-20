import React, { useLayoutEffect, useRef, useState } from 'react';

const TRUNK = 14;
const RADIUS = 10;
const END_X = 32;
const LINE_WIDTH = 1.5;
const DRAW_MS = 400;

/**
 * Draws Branched-Menu style trunk + curved branches for channel rows.
 * Measures .channel-item centers so voice-participant rows don't break alignment.
 */
const CategoryBranchTree = ({ children, activeChatId, className = '' }) => {
  const treeRef = useRef(null);
  const [layout, setLayout] = useState({ height: 0, mids: [], activeIndex: -1 });

  useLayoutEffect(() => {
    const root = treeRef.current;
    if (!root) return undefined;

    const measure = () => {
      const items = root.querySelectorAll(':scope .channel-item');
      const rootRect = root.getBoundingClientRect();
      const mids = [];
      let activeIndex = -1;
      let maxBottom = 0;

      items.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const top = rect.top - rootRect.top + root.scrollTop;
        const mid = top + rect.height / 2;
        mids.push(mid);
        maxBottom = Math.max(maxBottom, top + rect.height);

        if (activeChatId != null) {
          const id = el.getAttribute('data-channel-id');
          if (id != null && String(id) === String(activeChatId)) {
            activeIndex = i;
          }
        }
      });

      const height = Math.max(maxBottom + 6, root.scrollHeight, 0);
      setLayout((prev) => {
        const same =
          prev.height === height &&
          prev.activeIndex === activeIndex &&
          prev.mids.length === mids.length &&
          prev.mids.every((y, i) => Math.abs(y - mids[i]) < 0.5);
        return same ? prev : { height, mids, activeIndex };
      });
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const mo = new MutationObserver(measure);
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-channel-id'] });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [activeChatId, children]);

  const r = Math.min(RADIUS, 14);
  const { height, mids, activeIndex } = layout;

  const branch = (y) =>
    `M ${TRUNK} ${y - r} A ${r} ${r} 0 0 0 ${TRUNK + r} ${y} H ${END_X}`;
  const reach = (y) =>
    `M ${TRUNK} 0 V ${y - r} A ${r} ${r} 0 0 0 ${TRUNK + r} ${y} H ${END_X}`;
  const length = (y) => y - r + (Math.PI * r) / 2 + (END_X - TRUNK - r);
  const lastMid = mids.length ? mids[mids.length - 1] : 0;

  return (
    <div
      ref={treeRef}
      className={`category-branch-tree${className ? ` ${className}` : ''}`}
      style={{
        '--cb-indent': `${END_X + 8}px`,
        '--cb-draw': `${DRAW_MS}ms`,
        '--cb-line-w': LINE_WIDTH,
      }}
    >
      {mids.length > 0 && (
        <svg
          className="category-branch-tree__lines"
          width={END_X + 4}
          height={Math.max(height, lastMid + r + 4)}
          aria-hidden="true"
        >
          <path
            className="category-branch-tree__base"
            d={`M ${TRUNK} 0 V ${Math.max(0, lastMid - r)}`}
          />
          {mids.map((y, k) => (
            <path key={`b-${k}`} className="category-branch-tree__base" d={branch(y)} />
          ))}
          {mids.map((y, k) => {
            const len = length(y);
            const on = k === activeIndex;
            return (
              <path
                key={`r-${k}`}
                className="category-branch-tree__reach"
                d={reach(y)}
                style={{
                  strokeDasharray: len,
                  strokeDashoffset: on ? 0 : len,
                }}
              />
            );
          })}
        </svg>
      )}
      {children}
    </div>
  );
};

export default CategoryBranchTree;
