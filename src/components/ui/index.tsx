import * as React from 'react';
import { cn } from '@/src/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-[var(--color-accent)] text-white hover:opacity-90 shadow-lg shadow-[var(--color-accent)]/20',
      secondary: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/20',
      outline: 'border border-[var(--color-border-main)] text-[var(--color-text-main)] hover:bg-[var(--color-text-main)]/5',
      ghost: 'text-slate-500 hover:bg-[var(--color-text-main)]/5 hover:text-[var(--color-accent)]',
      danger: 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-[10px]',
      md: 'px-4 py-2 text-xs',
      lg: 'px-8 py-3.5 text-base',
      icon: 'p-2',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded font-bold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 uppercase tracking-widest',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-lg border border-[var(--color-border-main)] bg-[var(--color-bg-main)] px-4 py-2 text-sm text-[var(--color-text-main)] placeholder:text-slate-600 focus-visible:outline-none focus-visible:border-[var(--color-accent)]/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('bg-[var(--color-bg-card)] border border-[var(--color-border-main)] rounded-2xl p-6 shadow-xl transition-colors', className)}
    {...props}
  />
);

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={cn(
          'w-4 h-4 rounded border border-[var(--color-border-main)] bg-[var(--color-bg-main)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]/20 transition-all cursor-pointer accent-[var(--color-accent)]',
          className
        )}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Button, Input, Card, Checkbox };
