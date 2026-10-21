/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./popup.html",
    "./options.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        focus: {
          bg: '#0c0e14',
          card: '#141824',
          cardSubtle: '#1a2030',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(255, 255, 255, 0.16)',
          accent: '#3b82f6',
          accentGlow: 'rgba(59, 130, 246, 0.25)',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          textMuted: '#94a3b8',
          textSecondary: '#cbd5e1',
          textPrimary: '#f8fafc',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.35)',
        'glow-teal': '0 0 20px rgba(20, 184, 166, 0.35)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.35)',
        'glow-orange': '0 0 20px rgba(249, 115, 22, 0.35)',
        'glow-red': '0 0 25px rgba(239, 68, 68, 0.45)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
      },
    },
  },
  plugins: [],
}
