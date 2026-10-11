import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'subtle' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  block?: boolean;
}

export const buttonClass = ({ variant = 'secondary', size = 'md', block }: CommonProps, extra?: string) =>
  cn(s.button, s[variant], s[size], block && s.block, extra);

function Content({ leading, trailing, children }: { leading?: ReactNode; trailing?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {leading && <span className={s.icon} aria-hidden="true">{leading}</span>}
      {children != null && <span>{children}</span>}
      {trailing && <span className={s.trailing} aria-hidden="true">{trailing}</span>}
    </>
  );
}

export interface ButtonProps extends CommonProps, ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, leading, trailing, block, loading, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, block }, cn(loading && s.loading, className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content leading={leading} trailing={trailing}>
        {children}
      </Content>
      {loading && <span className={s.spinner} aria-hidden="true" />}
    </button>
  );
});

export interface ButtonLinkProps extends CommonProps, LinkProps {}

export function ButtonLink({ variant, size, leading, trailing, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, block }, className)} {...rest}>
      <Content leading={leading} trailing={trailing}>
        {children as ReactNode}
      </Content>
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  round?: boolean;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', round, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(s.iconButton, s[variant], s[size], round && s.round, className)}
      {...rest}
    >
      {children}
    </button>
  );
});
