import forms from '@tailwindcss/forms';

// Colours are CSS variables (see src/index.css) so light and dark themes swap in one place.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // dark: follows the system unless the operator picked a theme (data-theme on <html>)
  darkMode: ['variant', ['@media (prefers-color-scheme: dark) { &:not([data-theme="light"] *) }', '&:is([data-theme="dark"] *)']],
  theme: {
    extend: {
      colors: {
        paper: v('paper'),
        surface: v('surface'),
        sunken: v('sunken'),
        ink: v('ink'),
        muted: v('muted'),
        faint: v('faint'),
        line: v('line'),
        canopy: v('canopy'),
        'canopy-ink': v('canopy-ink'),
        cng: v('cng'),
        'cng-deep': v('cng-deep'),
        signal: v('signal'),
        'signal-strong': v('signal-strong'),
        'signal-soft': v('signal-soft'),
        caution: v('caution'),
        'caution-soft': v('caution-soft'),
        ok: v('ok'),
        'ok-soft': v('ok-soft'),
        hire: v('mode-hire'),
        single: v('mode-single'),
        sharing: v('mode-sharing'),
        idle: v('mode-offline'),
        viz: v('viz'),
      },
      fontFamily: {
        sans: ['Barlow', 'Mukta', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'Mukta', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // 1.2 ratio scale anchored at 15px body
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.4rem' }],
        lg: ['1.125rem', { lineHeight: '1.6rem' }],
        xl: ['1.35rem', { lineHeight: '1.8rem' }],
        '2xl': ['1.62rem', { lineHeight: '2rem' }],
        '3xl': ['1.94rem', { lineHeight: '2.2rem' }],
        '4xl': ['2.8rem', { lineHeight: '1' }],
        '5xl': ['3.6rem', { lineHeight: '1' }],
      },
      borderRadius: {
        plate: '4px',
        ctl: '7px',
        panel: '12px',
      },
      boxShadow: {
        float: '0 12px 32px -12px rgb(var(--shadow) / 0.35), 0 2px 6px rgb(var(--shadow) / 0.12)',
      },
    },
  },
  plugins: [forms({ strategy: 'class' })],
};
