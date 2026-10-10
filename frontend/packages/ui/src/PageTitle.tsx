import type { ReactNode } from 'react';
import { Text, Title } from '@mantine/core';

export interface PageTitleProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}

export function PageTitle({ title, subtitle, actions, eyebrow }: PageTitleProps) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <Text className="page-eyebrow">{eyebrow}</Text>}
        <Title order={1}>{title}</Title>
        {subtitle && <Text className="page-subtitle">{subtitle}</Text>}
      </div>
      {actions && <div className="page-title-actions">{actions}</div>}
    </header>
  );
}
