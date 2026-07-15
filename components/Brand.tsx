import React from 'react';

// ============ MARCA BOARDPLAN ============
// Logos oficiais (PNG em /public). tone 'dark' = sobre fundo ardósia; 'light' = sobre branco.

// Símbolo isolado (ícone) — usado no cabeçalho colapsado da sidebar.
export function BoardplanMark({ size = 32, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light'; variant?: 'full' | 'mark' }) {
  return <img src={tone === 'dark' ? '/boardplan-symbol-dark.png' : '/boardplan-symbol-light.png'} alt="Boardplan" style={{ height: size, width: size, objectFit: 'contain', display: 'block', flex: 'none' }} />;
}

// Lockup principal: símbolo + wordmark "Boardplan".
export function BoardplanLogo({ height = 32, tone = 'light' }: { height?: number; tone?: 'dark' | 'light' }) {
  return <img src={tone === 'dark' ? '/boardplan-logo-dark.png' : '/boardplan-logo-light.png'} alt="Boardplan" style={{ height, width: 'auto', objectFit: 'contain', display: 'block' }} />;
}
