import React from 'react';
import PATH from './logo-path';

/** PureHealth wordmark, as in the Chronic Care Studio design header. */
export default function Logo({ width = 150 }) {
  return <svg viewBox="0 0 197 43" width={width} height={Math.round(width * 43 / 197)} fill="currentColor" style={{ color: '#194F90' }} aria-label="PureHealth" role="img"><path d={PATH} /></svg>;
}
