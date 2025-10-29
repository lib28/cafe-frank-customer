// app.config.js
export default ({ config }) => ({
  ...config,
  name: "cafe-frank-customer",
  slug: "cafe-frank-customer",
  extra: {
    apiBase: process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.149:3000",
  },
  ios: { supportsTablet: false },
  android: {
    package: "com.cafefrank.customer",
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
    ],
  },
  plugins: [
    // react-native-maps defaults work with Expo managed; no extra keys required for basic usage
  ],
});
