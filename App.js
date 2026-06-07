/* Cosmo — app root. Loads fonts, mounts the store, and routes between the
   onboarding flow and the main tabbed shell. */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoreProvider, useStore, useTheme } from './src/store/Store';
import { useAppFonts, serif, sans } from './src/theme/fonts';
import ErrorBoundary from './src/components/ErrorBoundary';

import Backdrop from './src/components/Backdrop';
import Starfield from './src/components/Starfield';
import StatusBar from './src/components/StatusBar';
import TabBar from './src/components/TabBar';
import LogSheet from './src/components/LogSheet';
import WeekPlanSheet from './src/weekly/WeekPlanSheet';
import AddIdentitySheet from './src/components/AddIdentitySheet';
import CosmosFocusPanel from './src/components/CosmosFocusPanel';
import Toast from './src/components/Toast';

import Dashboard from './src/screens/Dashboard';
import Insights from './src/screens/Insights';
import Reflect from './src/screens/Reflect';
import Identities from './src/screens/Identities';
import IdentityDetail from './src/screens/IdentityDetail';
import Onboarding from './src/onboarding/Onboarding';

function AppShell() {
  const { t } = useTheme();
  const { tab, goTo, openLog, toast, detail, closeDetail } = useStore();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Backdrop />
      <Starfield count={72} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <StatusBar />
        <View style={{ flex: 1 }}>
          {/* The Detail screen takes over the content area (backdrop, status bar
              and tab bar stay) so its own Back returns to the active tab. */}
          {detail ? (
            <IdentityDetail identity={detail} onBack={closeDetail} />
          ) : (
            <>
              {tab === 'home' && <Dashboard />}
              {tab === 'insights' && <Insights />}
              {tab === 'reflect' && <Reflect />}
              {tab === 'identities' && <Identities />}
            </>
          )}
        </View>
        <TabBar tab={tab} setTab={goTo} onLog={() => openLog(null)} bottomInset={insets.bottom} />
      </View>
      <CosmosFocusPanel />
      <Toast toast={toast} bottom={120 + insets.bottom} />
      <LogSheet />
      <WeekPlanSheet />
      <AddIdentitySheet />
    </View>
  );
}

function Root() {
  const { started, hydrated, theme } = useStore();
  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: theme === 'light' ? '#ecebf6' : '#0a0a15' }} />;
  }
  return (
    <>
      <ExpoStatusBar style={theme === 'light' ? 'dark' : 'light'} hidden />
      {started ? <AppShell /> : <Onboarding />}
    </>
  );
}

/* Full-screen crash fallback — deliberately self-contained (no store/theme,
   which may be the thing that threw). Fonts are already loaded by this point. */
function AppCrash({ onRetry }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a15', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Text style={{ fontFamily: serif(500), fontSize: 26, color: '#eef0fb', textAlign: 'center', marginBottom: 10 }}>
        Something went off course
      </Text>
      <Text style={{ fontFamily: sans(500), fontSize: 15, color: '#a9a8c6', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
        The app hit an unexpected error. Your data is saved — try again.
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => ({ backgroundColor: '#eef0fb', borderRadius: 999, paddingVertical: 16, paddingHorizontal: 40, opacity: pressed ? 0.85 : 1 })}
      >
        <Text style={{ fontFamily: sans(600), fontSize: 16, color: '#0a0a15' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0a0a15' }} />;
  }
  return (
    <ErrorBoundary fallback={(err, reset) => <AppCrash onRetry={reset} />}>
      <SafeAreaProvider>
        <StoreProvider>
          <Root />
        </StoreProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
