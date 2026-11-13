import React, { useEffect, useRef } from 'react';
import { createPixelSnow } from './pixelSnowEngine';
import './PixelSnow.css';

export default function PixelSnow(options) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    return createPixelSnow(canvasRef.current, options);
    // Options are read once; the overlay is remounted to change them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="pixel-snow" aria-hidden="true" />;
}
