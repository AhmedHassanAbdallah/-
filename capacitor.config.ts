import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kitchenstudio.app',
  appName: 'Kitchen Studio',
  webDir: 'dist',
  android: {
    backgroundColor: '#0f172a',
  },
  plugins: {
    // edge-to-edge: Capacitor exposes the system bar insets as --safe-area-inset-* CSS variables
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
    },
  },
};

export default config;
