module.exports = {
  content: [
    './src/**/*.{html,js,jsx,ts,tsx}', // Update with your actual source file paths
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1D4ED8', // Blue
        secondary: '#F59E0B', // Amber
        accent: '#9333EA', // Purple
        background: '#F3F4F6', // Light Gray
        card: '#FFFFFF', // White
      },
      boxShadow: {
        'card': '0px 4px 6px rgba(0, 0, 0, 0.1)',
        'button': '0px 2px 5px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
};
