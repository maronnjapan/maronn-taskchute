import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maronn.taskchute',
  appName: 'TaskChute',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
  },
};

export default config;
