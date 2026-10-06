import React from 'react';
import { View, ActivityIndicator, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts, NotoSansDevanagari_400Regular, NotoSansDevanagari_500Medium, NotoSansDevanagari_600SemiBold, NotoSansDevanagari_700Bold } from '@expo-google-fonts/noto-sans-devanagari';
import { NotoSerifDevanagari_600SemiBold, NotoSerifDevanagari_700Bold } from '@expo-google-fonts/noto-serif-devanagari';
import { colors, sans } from './src/theme';
import { Icon } from './src/components/Icon';
import { AppProvider, useApp } from './src/context/AppContext';
import { AppText } from './src/components/AppText';
import TalkScreen from './src/screens/TalkScreen';
import MedsScreen from './src/screens/MedsScreen';
import VitalsScreen from './src/screens/VitalsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EmergencyScreen from './src/screens/EmergencyScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CaregiverPairingScreen from './src/screens/CaregiverPairingScreen';
import CareHistoryScreen from './src/screens/CareHistoryScreen';
import CaregiverSosScreen from './src/screens/CaregiverSosScreen';
import PrescriptionScannerScreen from './src/screens/PrescriptionScannerScreen';
import DoctorSummaryScreen from './src/screens/DoctorSummaryScreen';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { initSkiaWeb } from './src/services/skiaInit';

// Web: boot the Skia WASM backend early so the nebula orb shader can compile.
if (Platform.OS === 'web') {
  void initSkiaWeb();
}

const Stack = createNativeStackNavigator();

function WebFrameHeader() {
  const { t } = useApp();
  return (
    <View style={s.webFrameHeader}>
      <View style={s.headerPill}>
        <Icon name="heart-pulse" set="mci" size={16} color="#2DD4BF" />
        <AppText variant="small" weight="bold" color="#F1F5F9">
          {t('frame_title')}
        </AppText>
      </View>
    </View>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#000000',
    primary: '#0D9488',
    card: '#121212',
    text: '#F3F4F6',
    border: '#262626',
  },
};

function AppContent() {
  const { languageChosen, ready } = useApp();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
        <ActivityIndicator color="#2DD4BF" />
      </View>
    );
  }

  // Keying the container remounts the stack when the first-launch choice is made,
  // so `initialRouteName` is re-evaluated and we land on Home instead of Onboarding.
  return (
    <NavigationContainer key={languageChosen ? 'app' : 'onboarding'} theme={navTheme}>
      <Stack.Navigator
        initialRouteName={languageChosen ? 'Home' : 'Onboarding'}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home" component={TalkScreen} />
        <Stack.Screen name="Talk" component={TalkScreen} />
        <Stack.Screen name="Meds" component={MedsScreen} />
        <Stack.Screen name="Vitals" component={VitalsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="CareHistory" component={CareHistoryScreen} />
        <Stack.Screen name="CaregiverPairing" component={CaregiverPairingScreen} />
        <Stack.Screen name="PrescriptionScanner" component={PrescriptionScannerScreen} />
        <Stack.Screen name="DoctorSummary" component={DoctorSummaryScreen} />
        <Stack.Screen
          name="Emergency"
          component={EmergencyScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="CaregiverSos"
          component={CaregiverSosScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [loaded] = useFonts({
    NotoSansDevanagari_400Regular, NotoSansDevanagari_500Medium, NotoSansDevanagari_600SemiBold, NotoSansDevanagari_700Bold,
    NotoSerifDevanagari_600SemiBold, NotoSerifDevanagari_700Bold,
  });
  const { width, height } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 520;

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
        <ActivityIndicator color="#2DD4BF" />
      </View>
    );
  }

  return (
    <GluestackUIProvider mode="dark">
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" />
          {isDesktopWeb ? (
            <View style={s.webBackdrop}>
              <WebFrameHeader />
              <View style={[s.webDeviceMockup, { height: Math.min(height - 80, 890) }]}>
                <View style={s.deviceScreen}>
                  <AppContent />
                </View>
              </View>
            </View>
          ) : (
            <AppContent />
          )}
        </AppProvider>
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}

const s = StyleSheet.create({
  webBackdrop: {
    flex: 1,
    backgroundColor: '#090D16',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh' as any,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  webFrameHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  webDeviceMockup: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 44,
    backgroundColor: '#000000',
    borderWidth: 6,
    borderColor: '#1E293B',
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
    overflow: 'hidden',
  },
  deviceScreen: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 36,
    backgroundColor: '#000000',
  },
});

