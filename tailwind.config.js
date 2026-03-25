/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'background':               '#0e0e10',
        'surface':                  '#131316',
        'surface-bright':           '#25252b',
        'surface-container':        '#1a1a1e',
        'surface-container-low':    '#131316',
        'surface-container-high':   '#25252b',
        'surface-container-highest':'#2b2b31',
        'on-surface':               '#e6e4ec',
        'on-surface-variant':       '#abaab1',
        'primary':                  '#bc80f8',
        'primary-container':        '#2e1e4a',
        'on-primary-container':     '#cebdff',
        'secondary':                '#a78bfa',
        'outline':                  '#3f3f46',
        'outline-variant':          '#27272a',
        'error':                    '#f87171',
        'error-container':          '#450a0a',
        'tertiary':                 '#abaab1',
      },
      fontFamily: {
        headline: ['Space Grotesk', 'sans-serif'],
        body:     ['Inter', 'sans-serif'],
        label:    ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        md:      '0.375rem',
        lg:      '0.25rem',
        xl:      '0.5rem',
        full:    '9999px',
      },
    },
  },
  plugins: [],
}
