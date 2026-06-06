/* Cosmo — app root. Loads fonts, mounts the store, and routes between the
   onboarding flow and the main tabbed shell. */
import React from 'react';
import { View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoreProvider, useStore, useTheme } from './src/store/Store';
import { useAppFonts } from './src/theme/fonts';

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
import Onboarding from './src/onboarding/Onboarding';

function AppShell() {
  const { t } = useTheme();
  const { tab, goTo, openLog, toast } = useStore();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Backdrop />
      <Starfield count={72} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <StatusBar />
        <View style={{ flex: 1 }}>
          {tab === 'home' && <Dashboard />}
          {tab === 'insights' && <Insights />}
          {tab === 'reflect' && <Reflect />}
          {tab === 'identities' && <Identities />}
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

export default function App() {
  const [fontsLoaded] = useAppFonts();
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0a0a15' }} />;
  }
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
