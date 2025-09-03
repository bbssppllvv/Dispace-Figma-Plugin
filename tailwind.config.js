/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/ui/**/*.{html,js,ts}"
  ],
  theme: {
    extend: {
      colors: {
        'ui-bg': 'var(--color-bg)',
        'ui-bg-secondary': 'var(--color-bg-secondary)',
        'ui-bg-preview': 'var(--color-bg-preview)',
        'ui-text': 'var(--color-text)',
        'ui-text-secondary': 'var(--color-text-secondary)',
      },
    },
  },
  plugins: []
} 