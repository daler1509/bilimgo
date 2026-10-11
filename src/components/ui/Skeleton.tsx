import type { CSSProperties } from 'react';
import s from './Skeleton.module.css';

export function Skeleton({ width, height = 12, radius, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) {
  return <span className={s.skeleton} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}
