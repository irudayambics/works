import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        priority: {
          high: '#ef4444',
          medium: '#f97316',
          low: '#64748b'
        }
      }
    }
  },
  plugins: []
};

export default config;
