import type { CapacitorConfig } from '@capacitor/cli';

// Set CAPACITOR_SERVER_URL to override the server URL (e.g., for local dev: http://192.168.x.x:5173).
// Defaults to the production URL so the APK works out of the box without this env var.
const serverUrl = process.env.CAPACITOR_SERVER_URL ?? 'https://maronn-taskchute.maronn.workers.dev';

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
