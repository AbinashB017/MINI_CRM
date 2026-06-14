/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6C47FF',
          light: '#EEE9FF',
          dark: '#4F2FD4',
          50: '#F5F2FF',
          100: '#EEE9FF',
          200: '#D4C8FF',
          300: '#B09EFF',
          400: '#8B6FFF',
          500: '#6C47FF',
          600: '#5533E8',
          700: '#4F2FD4',
          800: '#3D23A8',
          900: '#2D1A7E',
        },
        surface: '#F8F7FF',
        border: '#E5E3F0',
        text: {
          primary: '#1A1523',
          muted: '#6B6B80',
        },
        status: {
          sent: '#3B82F6',
          delivered: '#10B981',
          opened: '#8B5CF6',
          read: '#6366F1',
          clicked: '#F59E0B',
          failed: '#EF4444',
          pending: '#9CA3AF',
          draft: '#9CA3AF',
          sending: '#F59E0B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(108, 71, 255, 0.08), 0 1px 2px -1px rgba(108, 71, 255, 0.04)',
        'card-hover': '0 4px 12px 0 rgba(108, 71, 255, 0.12), 0 2px 4px -1px rgba(108, 71, 255, 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
