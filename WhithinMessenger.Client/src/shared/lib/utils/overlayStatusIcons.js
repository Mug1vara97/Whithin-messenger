import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import MicOffIcon from '@mui/icons-material/MicOff';

function iconToSvg(Icon) {
  return renderToStaticMarkup(
    React.createElement(Icon, {
      'aria-hidden': 'true',
      focusable: 'false',
      sx: { fontSize: 16, display: 'block' },
    }),
  );
}

let cachedHeadsetOffSvg = null;
let cachedMicOffSvg = null;

export function getOverlayHeadsetOffSvg() {
  if (!cachedHeadsetOffSvg) {
    cachedHeadsetOffSvg = iconToSvg(HeadsetOffIcon);
  }
  return cachedHeadsetOffSvg;
}

export function getOverlayMicOffSvg() {
  if (!cachedMicOffSvg) {
    cachedMicOffSvg = iconToSvg(MicOffIcon);
  }
  return cachedMicOffSvg;
}

export function getOverlayStatusIcons() {
  return {
    micOff: getOverlayMicOffSvg(),
    headsetOff: getOverlayHeadsetOffSvg(),
  };
}
