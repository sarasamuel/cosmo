/* Cosmo — app root. Loads fonts, mounts the store, and routes between the
   onboarding flow and the main tabbed shell. */
import React, { useState } from 'react';
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
import BackupSheet from './src/components/BackupSheet';
import CosmosFocusPanel from './src/components/CosmosFocusPanel';
import IntentionMet from './src/components/IntentionMet';
import AllIntentionsMet from './src/components/AllIntentionsMet';
import Toast from './src/components/Toast';
import SplashScreen from './src/components/SplashScreen';

import Dashboard from './src/screens/Dashboard';
import Insights from './src/screens/Insights';
import Reflect from './src/screens/Reflect';
import Identities from './src/screens/Identities';
import IdentityDetail from './src/screens/IdentityDetail';
import EndOfDayReview from './src/screens/EndOfDayReview';
import Onboarding from './src/onboarding/Onboarding';
import AuthFlow from './src/onboarding/AuthFlow';

function AppShell() {
  const { t } = useTheme();
  const { tab, goTo, openLog, toast, detail, closeDetail, review, closeReview, celebrate, clearCelebrate, allMetOpen, closeAllMet, identities, form } = useStore();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Backdrop />
      <Starfield count={72} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <StatusBar />
        <View style={{ flex: 1 }}>
          {/* The end-of-day review (from the reminder tap) and the Detail screen
              both take over the content area; the review also hides the tab bar
              since it's a focused, full-screen task with its own Save/close. */}
          {review ? (
            <EndOfDayReview onClose={closeReview} />
          ) : detail ? (
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
        {!review && <TabBar tab={tab} setTab={goTo} onLog={() => openLog(null)} bottomInset={insets.bottom} />}
      </View>
      <CosmosFocusPanel />
      <Toast toast={toast} bottom={120 + insets.bottom} />
      <LogSheet />
      <WeekPlanSheet />
      <AddIdentitySheet />
      <BackupSheet />
      <IntentionMet idn={celebrate} onClose={clearCelebrate} />
      <AllIntentionsMet open={allMetOpen} form={form} identities={identities} onClose={closeAllMet} onShare={closeAllMet} />
    </View>
  );
}

function Root() {
  const { started, hydrated, theme, authSeen } = useStore();
  if (!hydrated) {
    // the splash overlay covers this gap; keep a deep-space fill behind it
    return <View style={{ flex: 1, backgroundColor: theme === 'light' ? '#ecebf6' : '#0a0a15' }} />;
  }
  return (
    <>
      <ExpoStatusBar style={theme === 'light' ? 'dark' : 'light'} hidden />
      {/* auth entry first (sign in or skip) → onboarding → app */}
      {!authSeen ? <AuthFlow /> : started ? <AppShell /> : <Onboarding />}
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

// Show the full launch intro only on a genuine cold start. This module-level
// flag lives in the JS context, which is fresh on every cold start and reset
// then — so warm resumes within a session don't replay the intro, without any
// persistent storage.
let splashShownThisSession = false;

// The cold-start splash overlay. Sits above the whole app and reveals it once
// fonts are loaded and the store has hydrated (the app-ready signal), then
// unmounts itself completely.
function SplashOverlay({ fontsLoaded }) {
  const { hydrated } = useStore();
  const [visible, setVisible] = useState(!splashShownThisSession);
  if (!visible) return null;
  return (
    <SplashScreen
      appReady={fontsLoaded && hydrated}
      onHidden={() => { splashShownThisSession = true; setVisible(false); }}
    />
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();
  return (
    <ErrorBoundary fallback={(err, reset) => <AppCrash onRetry={reset} />}>
      <SafeAreaProvider>
        <StoreProvider>
          {/* mount the store immediately so hydration runs behind the splash;
              Root renders once fonts are ready, the splash covers the gap */}
          {fontsLoaded ? <Root /> : null}
          <SplashOverlay fontsLoaded={fontsLoaded} />
        </StoreProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
