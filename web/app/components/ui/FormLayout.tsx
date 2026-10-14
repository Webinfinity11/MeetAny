'use client';

import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import s from './form-layout.module.css';

export type FormLayoutProps = {
  children: ReactNode;
  steps?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  asideLabel?: string;
  className?: string;
};

/** The caller owns the main/form landmarks and links footer submits with form="…". */
export function FormLayout({ children, steps, aside, footer, title, subtitle, titleRef, asideLabel = 'ასე გამოჩნდებით', className = '' }: FormLayoutProps) {
  const panel = useRef<HTMLDetailsElement>(null);
  const hasAside = aside != null;
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => { if (panel.current) panel.current.open = media.matches; };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [hasAside]);

  return <div className={`${s.layout} ${className}`} data-steps={steps ? '' : undefined} data-aside={aside ? '' : undefined}>
    {steps && <div className={s.steps}>{steps}</div>}
    <div className={s.form}>
      {(title || subtitle) && <header className={s.heading}>
        {title && <h1 ref={titleRef} tabIndex={-1}>{title}</h1>}
        {subtitle && <p>{subtitle}</p>}
      </header>}
      {children}
    </div>
    {aside && <aside className={s.aside} aria-label={asideLabel}>
      <details ref={panel} className={s.panel}>
        <summary>{asideLabel}</summary>
        <div className={s.panelContent}>{aside}</div>
      </details>
    </aside>}
    {footer && <div className={s.footer} data-form-footer="">{footer}</div>}
  </div>;
}
