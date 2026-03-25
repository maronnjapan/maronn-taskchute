import type { CapacitorConfig } from '@capacitor/cli';

// Set CAPACITOR_SERVER_URL to your production URL (e.g., https://maronn-taskchute.your-subdomain.workers.dev)
// This is required for the mobile app to connect to the server and for auth to work.
const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.maronn.taskchute',
  appName: 'TaskChute',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    ...(serverUrl ? { url: serverUrl } : {}),
  },
};

export default config;
