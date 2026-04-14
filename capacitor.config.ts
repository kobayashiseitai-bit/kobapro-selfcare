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
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#030712',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#030712',
    },
  },
};

export default config;
