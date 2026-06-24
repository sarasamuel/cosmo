/* Onboarding flow (7 steps): welcome → choose identities → cadence → rest
   allowance → allocate → reveal → notification opt-in. Rendered while onboarding
   is incomplete. On completion it carries free hours + rest allowance into the
   store, optionally enables the nightly reminder, and flips the persisted
   `started` flag. */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Circle } from 'react-native-svg';
import { useStore, useTheme } from '../store/Store';
import { CATALOG, IDENTITIES, RELAX, assignHue } from '../data/data';
import { Eyebrow, Button, Chip } from '../components/primitives';
import Icon from '../components/Icon';
import Starfield from '../components/Starfield';
import StatusBar from '../components/StatusBar';
import CosmosViz from '../viz/CosmosViz';
import ConstellationViz from '../viz/ConstellationViz';
import OnbCadence from './OnbCadence';
import OnbRest from './OnbRest';
import OnbAllocate from './OnbAllocate';
import TourContent from './OnboardingTour';
import { CADENCE, personaColor } from './helpers';
import { SPACING, bleed } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

function WelcomeConstellation() {
  const { t } = useTheme();
  const nodes = [
    [t.id.writer.color, 70, 30, 16],
    [t.id.reader.color, 104, 60, 13],
    [t.id.engineer.color, 92, 104, 15],
    [t.id.musician.color, 44, 100, 12],
    [t.id.painter.color, 34, 54, 14],
  ];
  return (
    <Svg width={140} height={140} viewBox="0 0 140 140">
      {nodes.map(([c, x, y, r], k) => (
        <React.Fragment key={k}>
          <Line x1={70} y1={70} x2={x} y2={y} stroke={t.ink} strokeOpacity={0.18} />
          <Circle cx={x} cy={y} r={r} fill={c} />
        </React.Fragment>
      ))}
      <Circle cx={70} cy={70} r={7} fill={t.ink} />
    </Svg>
  );
}

export default function Onboarding() {
  const { t } = useTheme();
  const { enter, form, setForm, setFreeHours: persistFreeHours, setRelaxAllowance, seedOnboarding, setReminderTime, tourSeen, markTourSeen, userName } = useStore();
  const insets = useSafeAreaInsets();

  // the feature tour plays once before setup; returning users (tourSeen) skip
  // straight to the setup steps. tourSeen is hydrated before this mounts → no flash.
  const [phase, setPhase] = useState(tourSeen ? 'setup' : 'tour');
  const [step, setStep] = useState(0);
  // the first reachable setup step: tour-users hand off to STEP 1 (the tour
  // covered the welcome), skip-tour users start at STEP 0. Captured once at mount
  // so the progress dots show only the steps this user actually traverses.
  const [firstStep] = useState(tourSeen ? 0 : 1);
  // the tour already opened with a welcome, so hand off to STEP 1 (choose
  // identities), skipping the redundant setup welcome. Returning users who skip
  // the tour still land on STEP 0 as their entry point.
  const finishTour = () => { markTourSeen(); setStep(1); setPhase('setup'); };
  const [selected, setSelected] = useState(['Writer', 'Reader', 'Engineer', 'Musician', 'Painter']);
  const [custom, setCustom] = useState('');
  const [cadence] = useState('week'); // time is now fixed to a weekly rhythm
  const [freeHours, setFreeHours] = useState(CADENCE.week.def);
  const [restPct, setRestPct] = useState(15); // Relaxation allowance (its own step)
  const [alloc, setAlloc] = useState({}); // name -> % of the week (set in the allocate step)

  // The user's real cosmos: each chosen identity carries its first-week % as
  // `desired`. Canonical names reuse the seed persona's id/glyph/palette so
  // colors stay on-brand; typed-in ones get a fresh, well-separated hue. Fed to
  // both the reveal preview and `seedOnboarding`, so what you see is what you get.
  const builtIdentities = useMemo(() => {
    const base = Math.floor(100 / Math.max(1, selected.length) / 5) * 5;
    const pctFor = (n) => (alloc[n] != null ? alloc[n] : base);
    const acc = [];
    selected.forEach((name) => {
      const canon = IDENTITIES.find((i) => i.name.toLowerCase() === name.toLowerCase());
      if (canon) {
        acc.push({ id: canon.id, name: canon.name, glyph: canon.glyph, palette: canon.palette, hue: canon.hue, desired: pctFor(name), actual: 0, lastActiveDays: 99, streak: 0 });
      } else {
        const hue = assignHue([...acc, RELAX]);
        acc.push({ id: name.toLowerCase().replace(/\s+/g, '-'), name, glyph: name[0].toUpperCase(), hue, desired: pctFor(name), actual: 0, lastActiveDays: 99, streak: 0 });
      }
    });
    return acc;
  }, [selected, alloc]);

  const toggle = (name) => setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
  const addCustom = () => {
    const n = custom.trim();
    if (n && !selected.includes(n)) setSelected((s) => [...s, n]);
    setCustom('');
  };
  const next = () => setStep((s) => s + 1);

  // carry the chosen identities, free hours + rest allowance into the app,
  // starting with no logged time (seedOnboarding clears the demo sessions) so
  // nothing reads as already-lived, then flip the persisted `started` flag.
  const finalize = () => {
    seedOnboarding(builtIdentities);
    persistFreeHours(freeHours);
    setRelaxAllowance(restPct);
    enter();
  };

  const customSelected = selected.filter((n) => !CATALOG.includes(n));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <Starfield count={60} />
      <StatusBar />

      {phase === 'tour' ? (
        <TourContent onDone={finishTour} />
      ) : (
        <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: SPACING.onboardingPad }} showsVerticalScrollIndicator={false}>
        {/* STEP 0 — welcome */}
        {step === 0 && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ marginBottom: 40 }}>
              <WelcomeConstellation />
            </View>
            <Eyebrow style={{ marginBottom: 16 }}>Cosmo</Eyebrow>
            <Text style={{ fontFamily: serif(500), fontSize: 44, lineHeight: 48, color: t.ink, textAlign: 'center', marginBottom: 20 }}>
              You are not your{'\n'}
              <Text style={{ fontFamily: serif(500, true) }}>to-do list.</Text>
            </Text>
            <Text style={{ fontSize: 18, lineHeight: 28, color: t.inkSoft, textAlign: 'center', maxWidth: 460 }}>
              Cosmo helps you spend your hours on the person you most want to become, not the tasks that happen to be loudest.
            </Text>
            <Button onPress={next} style={{ marginTop: 44, paddingHorizontal: 48 }}>
              Begin
            </Button>
          </View>
        )}

        {/* STEP 1 — choose */}
        {step === 1 && (
          <View style={{ flex: 1, paddingTop: 50 }}>
            <Eyebrow>Step one</Eyebrow>
            <Text style={{ fontFamily: serif(500), fontSize: 33, color: t.ink, marginTop: 10, marginBottom: 8 }}>Who do you want to be?</Text>
            <Text style={{ fontSize: 16, color: t.inkSoft, marginBottom: 28, lineHeight: 24 }}>
              Choose a few identities to tend to. Pick from these, or name your own.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {CATALOG.map((name) => {
                const on = selected.includes(name);
                const col = personaColor(name, selected.indexOf(name), t);
                return (
                  <Chip key={name} selected={on} onPress={() => toggle(name)} bg={on ? col : undefined}>
                    {on && <Icon name="check" size={15} stroke={2.6} color="#fff" />}
                    <Text style={{ fontSize: 16, fontFamily: sans(600), color: on ? '#fff' : t.ink }}>{name}</Text>
                  </Chip>
                );
              })}
              {customSelected.map((name) => {
                const col = personaColor(name, selected.indexOf(name), t);
                return (
                  <Chip key={name} selected onPress={() => toggle(name)} bg={col}>
                    <Icon name="check" size={15} stroke={2.6} color="#fff" />
                    <Text style={{ fontSize: 16, fontFamily: sans(600), color: '#fff' }}>{name}</Text>
                  </Chip>
                );
              })}
            </View>

            {/* add your own — directly below the identity chips */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
              <TextInput
                value={custom}
                onChangeText={setCustom}
                onSubmitEditing={addCustom}
                placeholder="Add your own…"
                placeholderTextColor={t.inkFaint}
                style={{
                  flex: 1,
                  paddingVertical: 15,
                  paddingHorizontal: 20,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: t.line,
                  backgroundColor: t.surface,
                  fontSize: 16,
                  fontFamily: sans(400),
                  color: t.ink,
                }}
              />
              <Button variant="soft" onPress={addCustom} style={{ paddingHorizontal: 24, paddingVertical: 15 }}>
                Add
              </Button>
            </View>

            <View style={{ marginTop: 'auto', paddingTop: 24, paddingBottom: 30 }}>
              <Text style={{ fontSize: 14, color: t.inkFaint, fontFamily: sans(600), textAlign: 'center', marginBottom: 14 }}>{selected.length} chosen</Text>
              <Button onPress={next} disabled={selected.length < 2}>
                Continue
              </Button>
            </View>
          </View>
        )}

        {/* STEP 2 — cadence */}
        {step === 2 && (
          <OnbCadence cadence={cadence} freeHours={freeHours} onSetHours={setFreeHours} onBack={() => setStep(1)} onContinue={next} />
        )}

        {/* STEP 3 — rest allowance */}
        {step === 3 && (
          <OnbRest cadence={cadence} freeHours={freeHours} restPct={restPct} onSet={setRestPct} onBack={() => setStep(2)} onContinue={next} />
        )}

        {/* STEP 4 — allocate */}
        {step === 4 && (
          <OnbAllocate selected={selected} cadence={cadence} freeHours={freeHours} alloc={alloc} onSetAlloc={setAlloc} onBack={() => setStep(3)} onContinue={next} />
        )}

        {/* STEP 5 — reveal */}
        {step === 5 && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Eyebrow style={{ marginBottom: 18 }}>Your cosmos</Eyebrow>
            <Text style={{ fontFamily: serif(500), fontSize: 32, color: t.ink, marginBottom: 10, textAlign: 'center' }}>A map of who you want to be.</Text>
            <Text style={{ fontSize: 16, color: t.inkSoft, marginBottom: 14, lineHeight: 24, textAlign: 'center', maxWidth: 440 }}>
              These identities move together. Pick the view that speaks to you — you can switch any time.
            </Text>

            {/* Constellation / Orbit toggle — the choice becomes the Portfolio default */}
            <View style={{ flexDirection: 'row', backgroundColor: t.surface2, borderRadius: 999, padding: 4, gap: 2, borderWidth: 1, borderColor: t.line }}>
              {[
                { f: 'orbit', label: 'Orbit' },
                { f: 'constellation', label: 'Constellation' },
              ].map((o) => {
                const on = form === o.f;
                return (
                  <Pressable
                    key={o.f}
                    onPress={() => setForm(o.f)}
                    style={[
                      { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: on ? t.surface : 'transparent' },
                      on ? t.shadow.sm : null,
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontFamily: sans(700), color: on ? t.ink : t.inkFaint }}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* full-bleed: cancel the screen's 44px padding so the viz spans the
                whole width (it measures its own container, so it stays responsive) */}
            <View style={{ alignSelf: 'stretch', ...bleed(SPACING.onboardingPad), marginVertical: 12 }}>
              {form === 'constellation' ? (
                <ConstellationViz identities={builtIdentities} allowLog={false} interactive={false} name={userName} />
              ) : (
                <CosmosViz identities={builtIdentities} allowLog={false} interactive={false} name={userName} />
              )}
            </View>
            <Button onPress={next} style={{ paddingHorizontal: 48 }}>
              Continue
            </Button>
          </View>
        )}

        {/* STEP 6 — gentle notification opt-in (the daily return nudge) */}
        {step === 6 && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: t.id.relax.color, alignItems: 'center', justifyContent: 'center', marginBottom: 30 }}>
              <Icon name="bell" size={34} stroke={1.8} color="#fff" />
            </View>
            <Eyebrow style={{ marginBottom: 16 }}>One last thing</Eyebrow>
            <Text style={{ fontFamily: serif(500), fontSize: 32, color: t.ink, marginBottom: 14, textAlign: 'center' }}>A gentle nudge each evening?</Text>
            <Text style={{ fontSize: 16.5, lineHeight: 26, color: t.inkSoft, textAlign: 'center', maxWidth: 440 }}>
              Cosmo can send one quiet check-in a day — a moment to log what you tended to. No streaks to break, no guilt if you miss it. You can change the time or turn it off any time in Settings.
            </Text>
            <View style={{ alignSelf: 'stretch', paddingHorizontal: 8, marginTop: 32 }}>
              {/* setReminderTime requests OS permission and schedules the 8pm nightly;
                  it reverts to off on its own if permission is denied. Either way we
                  finalize and enter the app. */}
              <Button onPress={() => { setReminderTime(20, 0); finalize(); }} style={{ paddingHorizontal: 48 }}>
                Enable evening reminders
              </Button>
              <Button variant="ghost" onPress={finalize} style={{ marginTop: 8 }}>
                Not now
              </Button>
            </View>
          </View>
        )}
      </ScrollView>

      {/* progress dots */}
      <View style={{ paddingTop: 14, paddingBottom: 20 + insets.bottom, flexDirection: 'row', gap: 7, justifyContent: 'center' }}>
        {Array.from({ length: 7 - firstStep }, (_, k) => k + firstStep).map((i) => (
          <View
            key={i}
            style={{
              width: i === step ? 22 : 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: i === step ? t.ink : t.line,
            }}
          />
        ))}
      </View>
        </>
      )}
    </View>
  );
}
