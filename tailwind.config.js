/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          base: '#0a0a0f',
          panel: '#13131c',
          card: '#1a1a26',
          elevated: '#22222f',
          hover: '#2a2a38',
        },
        line: {
          DEFAULT: '#2a2a3a',
          strong: '#3a3a4f',
        },
        brand: {
          50: '#eef9ff',
          100: '#d8efff',
          200: '#b9e4ff',
          300: '#88d4ff',
          400: '#4fbcff',
          500: '#1f9bff',
          600: '#0a82f0',
          700: '#0a6cc2',
          800: '#0f5c9c',
          900: '#134e7e',
        },
        accent: {
          400: '#34e3b8',
          500: '#10c997',
          600: '#0aa87d',
        },
        warn: {
          400: '#ffb547',
          500: '#ff9a1f',
        },
        danger: {
          400: '#ff6b6b',
          500: '#f23b3b',
        },
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(31,155,255,0.18), 0 10px 40px -10px rgba(31,155,255,0.35)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-fast': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-in-fast': 'fade-in-fast 0.2s ease-out both',
        'scale-in': 'scale-in 0.25s ease-out both',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin-slow 1.2s linear infinite',
      },
    },
  },
  plugins: [],
}
