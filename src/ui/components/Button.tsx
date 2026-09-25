import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'quiet' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-page hover:bg-ink/85',
  quiet: 'bg-surface text-ink hover:bg-line',
  ghost: 'text-ink hover:bg-surface',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'quiet', className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-jade focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
