/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FFFDF9',
          100: '#FFF8EE',
          200: '#F5E6D3',
        },
        sun: {
          500: '#F97316',
          600: '#EA580C',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 14px rgba(180, 120, 60, 0.08)',
        lift: '0 8px 24px rgba(180, 120, 60, 0.12)',
      },
    },
  },
  plugins: [],
}
