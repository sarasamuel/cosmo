/* Onboarding flow (5 steps), ported from onboarding.jsx. Rendered while
   onboarding is incomplete. Local state only — completing it just flips the
   persisted `started` flag (matching the prototype). */
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Circle } from 'react-native-svg';
import { useStore, useTheme } from '../store/Store';
import { CATALOG, DRIFT_APPS, IDENTITIES, USER } from '../data/data';
import { Eyebrow, Button, Chip, Glyph, dotStyle } from '../components/primitives';
import Icon from '../components/Icon';
import Starfield from '../components/Starfield';
import StatusBar from '../components/StatusBar';
import CosmosViz from '../viz/CosmosViz';
import OnbCadence from './OnbCadence';
import OnbAllocate from './OnbAllocate';
import { CADENCE, FREE_TIME, personaColor } from './helpers';
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
  const { enter } = useStore();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(['Writer', 'Reader', 'Engineer', 'Musician', 'Painter', FREE_TIME]);
  const [custom, setCustom] = useState('');
  const [cadence] = useState('week'); // time is now fixed to a weekly rhythm
  const [freeHours, setFreeHours] = useState(CADENCE.week.def);
  const [tracked, setTracked] = useState(() => new Set(DRIFT_APPS.filter((a) => a.tracked).map((a) => a.id)));
  const [appDest, setAppDest] = useState('drift'); // where tracked-app time rolls up: 'drift' | 'relax'

  const toggleApp = (id) =>
    setTracked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggle = (name) => setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
  const addCustom = () => {
    const n = custom.trim();
    if (n && !selected.includes(n)) setSelected((s) => [...s, n]);
    setCustom('');
  };
  const next = () => setStep((s) => s + 1);

  const customSelected = selected.filter((n) => !CATALOG.includes(n));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <Starfield count={60} />
      <StatusBar />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 44 }} showsVerticalScrollIndicator={false}>
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
              Cosmo helps you spend your hours on the people you most want to become — not the tasks that happen to be loudest.
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

            {/* relaxation caption — only while Relaxation Time is selected */}
            {selected.includes(FREE_TIME) && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 16 }}>
                <View style={[dotStyle(11, t.id.relax.color), { marginTop: 4 }]} />
                <Text style={{ flex: 1, fontSize: 13.5, color: t.inkFaint, fontFamily: sans(500), lineHeight: 19 }}>
                  <Text style={{ color: t.inkSoft, fontFamily: sans(600) }}>Relaxation Time</Text> reserves guilt-free hours for rest, scrolling, nothing in particular. Deselect it to give every hour to an identity.
                </Text>
              </View>
            )}

            {/* track app usage — always available */}
            <View style={{ marginTop: 16, padding: 20, borderRadius: t.radii.lg, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 14.5, fontFamily: sans(700), color: t.ink }}>Track app usage</Text>
                <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>optional</Text>
              </View>
              <Text style={{ fontSize: 13, color: t.inkSoft, lineHeight: 19, marginBottom: 14 }}>
                Choose which apps to count automatically — their time is measured for you.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
                {DRIFT_APPS.map((a) => {
                  const on = tracked.has(a.id);
                  const relaxOn = selected.includes(FREE_TIME);
                  const destColor = relaxOn && appDest === 'relax' ? t.id.relax.color : t.id.drift.color;
                  return (
                    <Chip
                      key={a.id}
                      selected={on}
                      onPress={() => toggleApp(a.id)}
                      bg={on ? destColor : undefined}
                      style={{ paddingHorizontal: 14, paddingVertical: 9 }}
                    >
                      <Icon name={on ? 'check' : 'plus'} size={14} stroke={on ? 2.6 : 2.4} color={on ? '#fff' : t.ink} />
                      <Text style={{ fontSize: 14, fontFamily: sans(600), color: on ? '#fff' : t.ink }}>{a.name}</Text>
                    </Chip>
                  );
                })}
              </View>

              {tracked.size > 0 &&
                (selected.includes(FREE_TIME) ? (
                  <View style={{ marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: t.line2 }}>
                    <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: t.ink, marginBottom: 4 }}>Where should this time count?</Text>
                    <Text style={{ fontSize: 12.5, color: t.inkSoft, lineHeight: 18, marginBottom: 14 }}>
                      Time on these apps can be rest you planned for, or time that quietly slips away.
                    </Text>
                    <View style={{ gap: 10 }}>
                      {[
                        { key: 'relax', color: t.id.relax.color, soft: t.id.relax.soft, glyph: '♾', title: 'Relaxation Time Allowance', desc: 'Counts as the guilt-free rest you allotted. Once you pass your weekly Relaxation allowance, any extra app time spills into Drift.' },
                        { key: 'drift', color: t.id.drift.color, soft: t.id.drift.soft, glyph: '∞', title: 'Drift', desc: 'Counts as unplanned time from the start — the hours you’d like to see, and slowly reclaim.' },
                      ].map((o) => {
                        const sel = appDest === o.key;
                        return (
                          <Pressable
                            key={o.key}
                            onPress={() => setAppDest(o.key)}
                            style={{ flexDirection: 'row', gap: 13, padding: 15, paddingVertical: 14, borderRadius: t.radii.sm, backgroundColor: sel ? o.soft : t.surface, borderWidth: 1.5, borderColor: sel ? o.color : t.line2 }}
                          >
                            <Glyph char={o.glyph} size={30} fontSize={15} color={o.color} />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{ fontSize: 14.5, fontFamily: sans(700), color: o.color }}>{o.title}</Text>
                                {sel && <Icon name="check" size={15} stroke={2.6} color={o.color} />}
                              </View>
                              <Text style={{ fontSize: 12.5, color: t.inkSoft, lineHeight: 18, marginTop: 4 }}>{o.desc}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.line2, flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
                    <Glyph char="∞" size={26} fontSize={13} color={t.id.drift.color} />
                    <Text style={{ flex: 1, fontSize: 12.5, color: t.inkSoft, lineHeight: 19 }}>
                      This time counts as <Text style={{ color: t.ink, fontFamily: sans(700) }}>Drift</Text> — the hours you’d like to see and reclaim. Add{' '}
                      <Text style={{ color: t.id.relax.color, fontFamily: sans(700) }}>Relaxation Time</Text> above to budget some of it as guilt-free rest instead.
                    </Text>
                  </View>
                ))}
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

        {/* STEP 3 — allocate */}
        {step === 3 && (
          <OnbAllocate selected={selected} cadence={cadence} freeHours={freeHours} onBack={() => setStep(2)} onContinue={next} />
        )}

        {/* STEP 4 — reveal */}
        {step === 4 && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Eyebrow style={{ marginBottom: 18 }}>Your cosmos</Eyebrow>
            <Text style={{ fontFamily: serif(500), fontSize: 32, color: t.ink, marginBottom: 10, textAlign: 'center' }}>Here is the shape of you.</Text>
            <Text style={{ fontSize: 16, color: t.inkSoft, marginBottom: 10, lineHeight: 24, textAlign: 'center', maxWidth: 440 }}>
              These identities now orbit together. Cosmo will help you keep them in balance.
            </Text>
            <View style={{ width: '100%', marginVertical: 12 }}>
              <CosmosViz identities={IDENTITIES} allowLog={false} name={USER.name} />
            </View>
            <Button onPress={enter} style={{ paddingHorizontal: 48 }}>
              Enter Cosmos
            </Button>
          </View>
        )}
      </ScrollView>

      {/* progress dots */}
      <View style={{ paddingTop: 14, paddingBottom: 20 + insets.bottom, flexDirection: 'row', gap: 7, justifyContent: 'center' }}>
        {[0, 1, 2, 3, 4].map((i) => (
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
    </View>
  );
}
