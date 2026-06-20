import React from 'react';

/** Solid send icon styled like call-log ghost icons (currentColor fill). */
const SendIcon = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M3.4 20.4 21 12 3.4 3.6 4.9 10.3 17 12 4.9 13.7 3.4 20.4z"
    />
  </svg>
);

export default SendIcon;
