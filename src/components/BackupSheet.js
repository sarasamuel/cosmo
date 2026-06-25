/* Cloud-backup sign-in — passwordless email code (Supabase OTP). Two steps:
   enter email → enter the 6-digit code we email back. Bottom sheet matching the
   app's other sheets. Local-first: this is opt-in backup, never a gate to use
   the app. On success the store's auth listener picks up the session and we close. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TextInput, Pressable, ScrollView, useWindowDimensions, Keyboard } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Button } from './primitives';
import { sendCode, verifyCode } from '../lib/auth';
import { SPACING } from '../lib/layout';
import { useKeyboardHeight } from '../lib/useKeyboard';
import { serif, sans } from '../theme/fonts';

export default function BackupSheet() {
  const { t } = useTheme();
  const { backupOpen: open, closeBackup: onClose, authConfigured } = useStore();
  const { height } = useWindowDimensions();

  const [stage, setStage] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  const kb = useKeyboardHeight(); // lift the sheet so the email/code inputs clear the keyboard

  useEffect(() => {
    if (open) {
      setStage('email');
      setCode('');
      setError(null);
      setBusy(false);
      setMounted(true);
    }
    Animated.timing(slide, { toValue: open ? 1 : 0, duration: open ? 420 : 300, useNativeDriver: true }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, slide]);

  if (!mounted) return null;

  const sheetMax = height * 0.7;

  const submitEmail = async () => {
    if (busy) return;
    const e = email.trim();
    if (!e || !e.includes('@')) {
      setError('Enter a valid email.');
      return;
    }
    setError(null);
    setBusy(true);
    const res = await sendCode(e);
    setBusy(false);
    if (res.ok) {
      setStage('code');
      Keyboard.dismiss();
    } else {
      setError(res.error === 'not-configured' ? 'Cloud backup isn’t set up on this build yet.' : res.error);
    }
  };

  const submitCode = async () => {
    if (busy) return;
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError(null);
    setBusy(true);
    const res = await verifyCode(email, code);
    setBusy(false);
    if (res.ok) {
      onClose(); // store's auth listener flips `session`
    } else {
      setError(res.error);
    }
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 44 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,16,12,0.4)', opacity: slide }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            marginBottom: kb,
            maxHeight: sheetMax,
            backgroundColor: t.surface,
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            paddingHorizontal: SPACING.sheetPad,
            paddingTop: 16,
            paddingBottom: 44,
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [sheetMax + 60, 0] }) }],
          },
          t.shadow.lg,
        ]}
      >
        <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: t.line, alignSelf: 'center', marginBottom: 22 }} />

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {stage === 'email' ? (
            <View>
              <Text style={{ fontFamily: serif(500), fontSize: 27, color: t.ink, marginBottom: 6 }}>Back up your cosmos</Text>
              <Text style={{ fontSize: 15, color: t.inkSoft, lineHeight: 22, marginBottom: 22 }}>
                Save your progress to the cloud so it follows you to a new phone. No password — we’ll email you a code.
              </Text>
              <Text style={{ fontSize: 12, fontFamily: sans(700), letterSpacing: 1.2, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 10 }}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={t.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={submitEmail}
                style={inputStyle(t)}
              />
              {error && <Text style={errStyle(t)}>{error}</Text>}
              <Button onPress={submitEmail} disabled={busy} style={{ marginTop: 22 }} textStyle={{ color: t.bg }}>
                {busy ? 'Sending…' : 'Send code'}
              </Button>
              <Button variant="ghost" onPress={onClose} style={{ marginTop: 6 }}>
                Not now
              </Button>
            </View>
          ) : (
            <View>
              <Text style={{ fontFamily: serif(500), fontSize: 27, color: t.ink, marginBottom: 6 }}>Enter your code</Text>
              <Text style={{ fontSize: 15, color: t.inkSoft, lineHeight: 22, marginBottom: 22 }}>
                We emailed a 6-digit code to <Text style={{ color: t.ink, fontFamily: sans(700) }}>{email.trim()}</Text>.
              </Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="••••••"
                placeholderTextColor={t.inkFaint}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                returnKeyType="go"
                onSubmitEditing={submitCode}
                style={[inputStyle(t), { fontSize: 26, letterSpacing: 8, textAlign: 'center', fontFamily: serif(500) }]}
              />
              {error && <Text style={errStyle(t)}>{error}</Text>}
              <Button onPress={submitCode} disabled={busy} style={{ marginTop: 22 }} textStyle={{ color: t.bg }}>
                {busy ? 'Verifying…' : 'Verify & back up'}
              </Button>
              <Button variant="ghost" onPress={() => { setStage('email'); setError(null); }} style={{ marginTop: 6 }}>
                Use a different email
              </Button>
            </View>
          )}

          {!authConfigured && (
            <Text style={{ fontSize: 12.5, color: t.inkFaint, fontFamily: sans(500), lineHeight: 18, marginTop: 18, textAlign: 'center' }}>
              Developer note: set EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY in .env to enable backup.
            </Text>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const inputStyle = (t) => ({
  borderWidth: 1.5,
  borderColor: t.line,
  borderRadius: t.radii.md,
  paddingHorizontal: 16,
  paddingVertical: 15,
  fontSize: 16,
  fontFamily: sans(500),
  color: t.ink,
  backgroundColor: t.surface,
});

const errStyle = (t) => ({ fontSize: 13, color: t.warn, fontFamily: sans(600), marginTop: 10 });
