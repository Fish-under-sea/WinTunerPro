/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // 主题色通过 CSS 变量驱动，便于切换风格包（见 styles/globals.css）
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        'surface-hover': 'var(--color-surface-hover)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
          contrast: 'var(--color-primary-contrast)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          subtle: 'var(--color-text-subtle)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          soft: 'var(--color-success-soft)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          soft: 'var(--color-danger-soft)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          soft: 'var(--color-info-soft)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        // 统一圆角阶梯：卡片用 xl/2xl，按钮/标签用 lg/md
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        // 轻投影体系：浅色风下点到为止，避免厚重阴影
        xs: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        sm: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 4px 16px -8px rgba(15, 23, 42, 0.08)',
        'card-hover': '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 8px 24px -8px rgba(15, 23, 42, 0.12)',
        lg: '0 10px 30px -10px rgba(15, 23, 42, 0.18)',
        primary: '0 6px 18px -6px rgba(14, 165, 233, 0.45)',
      },
      transitionTimingFunction: {
        // 统一动效曲线
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '220ms',
        slow: '320ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s infinite',
        spin: 'spin 0.8s linear infinite',
      },
    },
  },
  plugins: [],
}
