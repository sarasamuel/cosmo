/* Passwordless auth — the first thing a new user sees. Email-only (no password,
   no OAuth). Three stages: enter email → enter the emailed code → choose a name.
   "Continue without an account" is the local-first escape: it just marks auth as
   seen and drops into onboarding (the user can back up later from the You tab).

   On success / skip we set `authSeen` in the store, which routes Root onward. */
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Circle } from 'react-native-svg';
import { useStore, useTheme } from '../store/Store';
import { Eyebrow, Button } from '../components/primitives';
import Icon from '../components/Icon';
import Starfield from '../components/Starfield';
import { sendCode, verifyCode, isConfigured } from '../lib/auth';
import { serif, sans } from '../theme/fonts';

function Mark({ size = 116 }) {
  const { t } = useTheme();
  const nodes = [
    [t.id.writer.color, 58, 26, 13],
    [t.id.reader.color, 86, 50, 10],
    [t.id.engineer.color, 76, 86, 12],
    [t.id.musician.color, 36, 82, 10],
    [t.id.painter.color, 28, 46, 11],
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 116 116">
      {nodes.map(([c, x, y, r], k) => (
        <React.Fragment key={k}>
          <Line x1={58} y1={58} x2={x} y2={y} stroke={t.ink} strokeOpacity={0.18} />
          <Circle cx={x} cy={y} r={r} fill={c} />
        </React.Fragment>
      ))}
      <Circle cx={58} cy={58} r={6} fill={t.ink} />
    </Svg>
  );
}

export default function AuthFlow() {
  const { t } = useTheme();
  const { setUserName, markAuthSeen } = useStore();
  const insets = useSafeAreaInsets();

  // TEMPORARY: email/code sign-in is bypassed for now — the flow opens straight
  // on the name step so the user only enters their name. To restore sign-in,
  // change the initial stage back to 'email'. (The 'email'/'code' stages below are
  // left intact, just unreachable.)
  const [stage, setStage] = useState('name'); // 'email' | 'code' | 'name'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [signedIn, setSignedIn] = useState(false); // reached the name step via sign-in (vs skip)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submitEmail = async () => {
    if (busy) return;
    const e = email.trim();
    if (!e.includes('@')) return setError('Enter a valid email.');
    setError(null);
    setBusy(true);
    const res = await sendCode(e);
    setBusy(false);
    if (res.ok) {
      setStage('code');
      Keyboard.dismiss();
    } else {
      setError(res.error === 'not-configured' ? 'Cloud sign-in isn’t set up on this build yet — you can continue without an account.' : res.error);
    }
  };

  const submitCode = async () => {
    if (busy) return;
    if (code.trim().length < 6) return setError('Enter the code we emailed you.');
    setError(null);
    setBusy(true);
    const res = await verifyCode(email, code);
    setBusy(false);
    if (res.ok) {
      setError(null);
      setSignedIn(true);
      setStage('name');
      Keyboard.dismiss();
    } else {
      setError(res.error);
    }
  };

  // a name is required — every path lands on the name step and can't pass it empty
  const finishName = () => {
    if (!name.trim()) return;
    setUserName(name);
    markAuthSeen();
  };

  // "continue without an account" still collects a name (just no sign-in)
  const skip = () => {
    setSignedIn(false);
    setStage('name');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <Starfield count={50} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {stage === 'email' && (
          <View style={{ alignItems: 'stretch' }}>
            <View style={{ alignItems: 'center', marginBottom: 30 }}>
              <Mark />
              <Text style={{ fontFamily: serif(500), fontSize: 30, color: t.ink, marginTop: 14 }}>Cosmo</Text>
              {/* <Text style={{ fontFamily: sans(600), fontSize: 13, letterSpacing: 0.4, color: t.inkFaint, marginTop: 4 }}>time, by who you’re becoming</Text> */}
            </View>

            <Text style={{ fontFamily: serif(500), fontSize: 30, lineHeight: 36, color: t.ink, textAlign: 'center', marginBottom: 8 }}>
              Begin with your <Text style={{ fontFamily: serif(500, true) }}>email.</Text>
            </Text>
            <Text style={{ fontSize: 15, color: t.inkSoft, lineHeight: 22, textAlign: 'center', marginBottom: 26 }}>
              No password to remember. We’ll email you a code.
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
              style={input(t)}
            />
            {error && <Text style={err(t)}>{error}</Text>}
            <Button onPress={submitEmail} disabled={busy} style={{ marginTop: 18 }}>
              {busy ? 'Sending…' : 'Continue with email'}
            </Button>
            <Pressable onPress={skip} hitSlop={8} style={({ pressed }) => ({ marginTop: 22, alignSelf: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 14.5, fontFamily: sans(600), color: t.inkFaint }}>Continue without an account</Text>
            </Pressable>
            {!isConfigured && (
              <Text style={{ fontSize: 12, color: t.inkFaint, fontFamily: sans(500), textAlign: 'center', marginTop: 16, lineHeight: 17 }}>
                Dev note: set EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY in .env to enable sign-in.
              </Text>
            )}
          </View>
        )}

        {stage === 'code' && (
          <View style={{ alignItems: 'stretch' }}>
            <Text style={{ fontFamily: serif(500), fontSize: 30, lineHeight: 36, color: t.ink, textAlign: 'center', marginBottom: 8 }}>
              Enter your <Text style={{ fontFamily: serif(500, true) }}>code.</Text>
            </Text>
            <Text style={{ fontSize: 15, color: t.inkSoft, lineHeight: 22, textAlign: 'center', marginBottom: 26 }}>
              We sent a code to <Text style={{ color: t.ink, fontFamily: sans(700) }}>{email.trim()}</Text>.
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
              style={[input(t), { fontSize: 26, letterSpacing: 8, textAlign: 'center', fontFamily: serif(500) }]}
            />
            {error && <Text style={err(t)}>{error}</Text>}
            <Button onPress={submitCode} disabled={busy} style={{ marginTop: 18 }}>
              {busy ? 'Verifying…' : 'Verify'}
            </Button>
            <Pressable onPress={() => { setStage('email'); setError(null); }} hitSlop={8} style={({ pressed }) => ({ marginTop: 22, alignSelf: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 14.5, fontFamily: sans(600), color: t.inkFaint }}>Use a different email</Text>
            </Pressable>
          </View>
        )}

        {stage === 'name' && (
          <View style={{ alignItems: 'stretch' }}>
            <View style={{ alignItems: 'center', marginBottom: 26 }}>
              <Mark size={132} />
            </View>
            <Eyebrow style={{ textAlign: 'center', marginBottom: 14, color: t.core1 }}>Welcome to Cosmo</Eyebrow>
            <Text style={{ fontFamily: serif(500), fontSize: 32, lineHeight: 38, color: t.ink, textAlign: 'center', marginBottom: 8 }}>
              {signedIn ? (
                <>You’re <Text style={{ fontFamily: serif(500, true) }}>in.</Text></>
              ) : (
                <>What should Cosmo call you?</>
              )}
            </Text>
            <Text style={{ fontSize: 15, color: t.inkSoft, lineHeight: 22, textAlign: 'center', marginBottom: 26 }}>
              {signedIn ? 'Your email is your key from now on. What should Cosmo call you?' : 'Please enter your name.'}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={t.inkFaint}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="go"
              onSubmitEditing={finishName}
              autoFocus
              style={input(t)}
            />
            <Button onPress={finishName} disabled={!name.trim()} style={{ marginTop: 18 }}>
              <Text style={{ color: t.bg, fontFamily: sans(600), fontSize: 18 }}>Enter Cosmos</Text>
              <Icon name="arrow" size={18} stroke={2.2} color={t.bg} />
            </Button>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const input = (t) => ({
  borderWidth: 1.5,
  borderColor: t.line,
  borderRadius: t.radii.md,
  paddingHorizontal: 18,
  paddingVertical: 16,
  fontSize: 16,
  fontFamily: sans(500),
  color: t.ink,
  backgroundColor: t.surface,
});

const err = (t) => ({ fontSize: 13, color: t.warn, fontFamily: sans(600), marginTop: 10, textAlign: 'center' });
