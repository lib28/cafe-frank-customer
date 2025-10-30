export default {
  expo: {
    name: "Cafe Frank",
    slug: "cafe-frank-customer",
    owner: "nrb2224",
    scheme: "caff",
    orientation: "portrait",
    icon: "./assets/icon.png",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#0f172a"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.nrb2224.cafefrank",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0f172a"
      }
    },
    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png"
    },
    plugins: ["expo-web-browser"],
    extra: {
      EXPO_PUBLIC_API_BASE_URL: "https://cafe-frank-customer.onrender.com",
      eas: {
        projectId: "c10d07a9-a70f-4a77-8a76-81cf2632b963"
      }
    }
  }
};
