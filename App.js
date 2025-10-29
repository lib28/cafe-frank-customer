// File: App.js
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import MenuFullScreen from './src/screens/MenuFullScreen';
import CartScreen from './src/screens/CartScreen';
import TrackScreen from './src/screens/TrackScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import DriverProfile from './src/screens/DriverProfile';
import CheckoutScreen from './src/screens/CheckoutScreen';

// Context (you already had this)
import { CartProvider } from './src/context/CartContext';

// ✅ NEW: runtime API base init
import { initBaseUrl } from './src/api/base';

const PinkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#e83e8c',
    background: '#ffffff',
    card: '#ffffff',
    text: '#0f172a',
    border: '#f3d1de',
    notification: '#e83e8c',
  },
};

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => { initBaseUrl(); }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={PinkTheme}>
        <CartProvider>
          <StatusBar style="dark" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerTitle: 'Café Frank',
              headerTitleStyle: { fontWeight: '900', color: '#e83e8c' },
              headerTintColor: '#e83e8c',
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Café Frank' }} />
            <Stack.Screen name="MenuFull" component={MenuFullScreen} options={{ title: 'Live Menu' }} />
            <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Your Cart' }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
            <Stack.Screen name="Track" component={TrackScreen} options={{ title: 'Track Order' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
            <Stack.Screen name="DriverProfile" component={DriverProfile} options={{ title: 'Drivers' }} />
          </Stack.Navigator>
        </CartProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
