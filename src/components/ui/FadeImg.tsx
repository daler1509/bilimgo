import { useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import s from './FadeImg.module.css';

/**
 * An image that fades in once it has loaded instead of popping onto the page.
 * A picture that is already cached (or fails) shows at once.
 */
export function FadeImg({ className, onLoad, onError, alt, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (ref.current?.complete) setReady(true);
  }, []);

  return (
    <img
      ref={ref}
      alt={alt}
      className={cn(ready ? s.ready : s.pending, className)}
      onLoad={(e) => {
        setReady(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        setReady(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
}
