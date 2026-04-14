import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kobayashiseitai.zeropain',
  appName: 'ZERO-PAIN',
  webDir: 'public',
  server: {
    url: 'https://posture-app-steel.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#030712',
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
