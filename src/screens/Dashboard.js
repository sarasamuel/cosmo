/* Portfolio / Dashboard tab, ported from screens.jsx (Dashboard + CosmosHero).
   Includes the expandable Drift breakdown (aggregate of tracked apps). */
import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, useTheme } from '../store/Store';
import { USER, COACH, fmtMins } from '../data/data';
import CosmosViz from '../viz/CosmosViz';
import ConstellationViz from '../viz/ConstellationViz';
import { darkTheme } from '../theme/theme';
import { Card, Glyph, Eyebrow, SectionTitle, Pill, Chip } from '../components/primitives';
import Icon from '../components/Icon';
import IdentityRow from '../components/IdentityRow';
import DualBar from '../components/DualBar';
import AlignmentRing from '../components/AlignmentRing';
import CoachNote from '../components/CoachNote';
import WeekPlanBanner from '../weekly/WeekPlanBanner';
import ErrorBoundary from '../components/ErrorBoundary';
import { useScreenPad, useBreakpoints, SPACING, bleed } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

function LegendItem({ filled, label, dk }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: filled ? dk.inkSoft : 'transparent',
          borderWidth: filled ? 0 : 1.5,
          borderColor: dk.inkSoft,
        }}
      />
      <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: dk.inkFaint }}>{label}</Text>
    </View>
  );
}

/* The cosmos card is always a deep-space "night sky", in both light and dark
   app themes — so it forces the dark palette (dk) for its own chrome and passes
   it down to the viz via themeObj. */
function CosmosHero({ identities, onTap, name }) {
  const dk = darkTheme;
  // `form` is shared via the store so the onboarding reveal and the Portfolio
  // agree on which visualization is the default (persisted to AsyncStorage there).
  const { form, setForm, cosmosFocus, focusCosmos, clearCosmos } = useStore();
  const { showHint } = useBreakpoints(); // hide the interaction hint when there isn't room
  const pick = (f) => {
    setForm(f);
    clearCosmos(); // release focus when swapping the mounted viz
  };
  const isConst = form === 'constellation';
  const focusProps = { focusedId: cosmosFocus?.id, onFocus: focusCosmos, onRelease: clearCosmos };

  return (
    <View style={{ borderRadius: dk.radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(160,160,230,0.14)' }}>
      <LinearGradient colors={['#1b1838', '#0c0b1c', '#07060f']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ paddingHorizontal: SPACING.cosmosCardPad, paddingTop: 18, paddingBottom: 16 }}>
        {/* header wraps: on narrow screens the toggle drops below the eyebrow
            (right-aligned) and the hint is hidden, so nothing clips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 10, columnGap: 10 }}>
          <Text style={{ fontSize: 13, fontFamily: sans(600), letterSpacing: 2.1, textTransform: 'uppercase', color: dk.inkFaint }}>Your cosmos</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <View style={{ flexDirection: 'row', backgroundColor: dk.surface3, borderRadius: 999, padding: 2, gap: 2, borderWidth: 1, borderColor: dk.line2 }}>
              {[
                { f: 'constellation', label: 'Constellation' },
                { f: 'orbit', label: 'Orbit' },
              ].map((o) => {
                const on = form === o.f;
                return (
                  <Pressable key={o.f} onPress={() => pick(o.f)} style={[{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: on ? dk.surface : 'transparent' }, on ? dk.shadow.sm : null]}>
                    <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: on ? dk.ink : dk.inkFaint }}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {showHint && (
              <Text style={{ fontSize: 12, fontFamily: sans(600), color: dk.inkFaint }}>✦ {isConst ? 'tap a star' : 'drag to rotate'}</Text>
            )}
          </View>
        </View>
        {/* let the viz use the full card width (header + legend stay padded) so
            it isn't cramped on narrow phones. A boundary keeps a viz render error
            contained to this card instead of white-screening the app. */}
        <View style={bleed(SPACING.cosmosCardPad)}>
          <ErrorBoundary
            fallback={
              <View style={{ height: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}>
                <Text style={{ fontFamily: sans(600), fontSize: 14, color: dk.inkFaint, textAlign: 'center' }}>
                  Couldn’t render your cosmos right now.
                </Text>
              </View>
            }
          >
            {isConst ? (
              <ConstellationViz identities={identities} onLog={onTap} name={name} themeObj={dk} {...focusProps} />
            ) : (
              <CosmosViz identities={identities} onLog={onTap} name={name} themeObj={dk} {...focusProps} />
            )}
          </ErrorBoundary>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 2 }}>
          <LegendItem filled label={isConst ? 'bright = your time' : 'filled = your time'} dk={dk} />
          <LegendItem filled={false} label="ring = intention" dk={dk} />
        </View>
      </LinearGradient>
    </View>
  );
}

export default function Dashboard() {
  const { t, colorsFor } = useTheme();
  const { identities, drift, relax, sessions, align, openLog, toggleDriftApp, week, weekPlanned, openPlan } = useStore();
  const [driftOpen, setDriftOpen] = useState(false);
  const relaxC = colorsFor(relax);
  const pad = useScreenPad();

  const lead = [...identities].sort((a, b) => b.actual - b.desired - (a.actual - a.desired))[0];
  const lag = [...identities].sort((a, b) => a.actual - a.desired - (b.actual - b.desired))[0];
  const tracked = drift.apps.filter((a) => a.tracked);
  const untracked = drift.apps.filter((a) => !a.tracked);
  const maxApp = Math.max(...tracked.map((a) => a.pct), 1);
  const driftC = colorsFor(drift);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingTop: 8 }}>
        <Eyebrow>{COACH.date}</Eyebrow>
        <Text style={{ fontFamily: serif(500), fontSize: 38, lineHeight: 40, color: t.ink, marginTop: 8, marginBottom: 6, letterSpacing: -0.4 }}>
          Good morning, {USER.name}
        </Text>
        <Text style={{ fontFamily: serif(400, true), fontSize: 19, color: t.inkSoft }}>
          Am I spending my time becoming the person I want to be?
        </Text>
      </View>

      <View style={{ marginTop: 18 }}>
        <WeekPlanBanner week={week} planned={weekPlanned} onPlan={openPlan} />
      </View>

      <View style={{ marginTop: 18 }}>
        <CosmosHero identities={identities} onTap={openLog} name={USER.name} />
      </View>

      {/* alignment summary */}
      <Card style={{ marginTop: 18, padding: 26, flexDirection: 'row', gap: 24, alignItems: 'center' }}>
        <AlignmentRing value={align} />
        <View style={{ flex: 1 }}>
          <SectionTitle style={{ marginBottom: 8 }}>This week’s balance</SectionTitle>
          <Text style={{ fontSize: 15.5, lineHeight: 23, color: t.inkSoft }}>
            Your hours leaned toward <Text style={{ color: t.ink, fontFamily: sans(700) }}>{lead.name}</Text>, while{' '}
            <Text style={{ color: t.ink, fontFamily: sans(700) }}>{lag.name}</Text> sits furthest below your intention.
          </Text>
          <Pill bg={t.ink} onPress={() => openLog(lag)} style={{ marginTop: 14, alignSelf: 'flex-start' }}>
            <Icon name="plus" size={15} color={t.bg} />
            <Text style={{ color: t.bg, fontFamily: sans(700), fontSize: 13 }}>Tend to {lag.name}</Text>
          </Pill>
        </View>
      </Card>

      {/* breakdown */}
      <Card style={{ marginTop: 18, paddingHorizontal: 24, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <SectionTitle>Desired vs. actual</SectionTitle>
          <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>past 7 days</Text>
        </View>
        {identities.map((i, k) => (
          <IdentityRow key={i.id} idn={i} onTap={openLog} topBorder={k > 0} />
        ))}

        {/* relaxation — a planned allowance; overflow becomes drift */}
        {relax.tracked && (
          <View style={{ marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.line }}>
            <Pressable onPress={() => openLog(relax)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Glyph char={relax.glyph} size={38} fontSize={19} color={relaxC.color} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
                  <Text style={{ fontSize: 16.5, fontFamily: sans(600), color: t.ink }}>
                    {relax.name} <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: relaxC.color }}>  ALLOWANCE</Text>
                  </Text>
                  <Text style={{ fontSize: 14, fontFamily: sans(600), color: t.inkSoft }}>
                    {relax.actual}
                    <Text style={{ color: t.inkFaint }}> / {relax.desired}%</Text>
                  </Text>
                </View>
                <DualBar actual={relax.actual} desired={relax.desired} color={relaxC.color} />
                <Text style={{ fontSize: 12.5, color: t.inkFaint, fontFamily: sans(600), marginTop: 8 }}>
                  {relax.actual >= relax.desired
                    ? 'Allowance full — more rest now counts as Drift'
                    : `${relax.desired - relax.actual}% of your rest allowance left this week`}
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* drift — aggregate of tracked apps */}
        <View style={{ marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Glyph char={drift.glyph} size={38} fontSize={20} color={driftC.color} />
            <Pill
              bg="transparent"
              onPress={() => setDriftOpen((o) => !o)}
              style={{ flex: 1, paddingHorizontal: 0, paddingVertical: 0, alignItems: 'stretch' }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
                  <Text style={{ fontSize: 16.5, fontFamily: sans(600), color: t.ink }}>
                    {drift.name} <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: t.warn }}>  DRIFT</Text>
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 14, fontFamily: sans(600), color: t.inkSoft }}>
                      {Math.round(drift.actual)}
                      <Text style={{ color: t.inkFaint }}> / 0%</Text>
                    </Text>
                    <View style={{ transform: [{ rotate: driftOpen ? '-90deg' : '90deg' }] }}>
                      <Icon name="chevron" size={16} color={t.inkFaint} />
                    </View>
                  </View>
                </View>
                <DualBar actual={drift.actual} color={driftC.color} />
                <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint, marginTop: 8 }}>
                  {tracked.length
                    ? `Tracking ${tracked.length} app${tracked.length > 1 ? 's' : ''} · ${fmtMins(tracked.reduce((s, a) => s + a.mins, 0))} this week`
                    : 'No apps tracked'}
                </Text>
              </View>
            </Pill>
          </View>

          {driftOpen && (
            <View style={{ marginTop: 14, paddingLeft: 54 }}>
              {tracked.map((a) => (
                <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }}>
                  <Glyph char={a.glyph} size={28} fontSize={13} color={driftC.color} opacity={0.85} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 14.5, fontFamily: sans(600), color: t.ink }}>{a.name}</Text>
                      <Text style={{ fontSize: 13, fontFamily: sans(600), color: t.inkSoft }}>{fmtMins(a.mins)}</Text>
                    </View>
                    <DualBar actual={(a.pct / maxApp) * 100} color={driftC.color} height={6} fillOpacity={0.7} />
                  </View>
                  <Pill bg={t.surface2} onPress={() => toggleDriftApp(a.id)} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 12, fontFamily: sans(700), color: t.ink }}>Stop</Text>
                  </Pill>
                </View>
              ))}

              {untracked.length > 0 && (
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: t.line2 }}>
                  <Text style={{ fontSize: 12, fontFamily: sans(700), letterSpacing: 0.5, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 12 }}>
                    Also track
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
                    {untracked.map((a) => (
                      <Chip key={a.id} onPress={() => toggleDriftApp(a.id)} style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
                        <Icon name="plus" size={14} stroke={2.4} color={t.ink} />
                        <Text style={{ fontSize: 14, fontFamily: sans(600), color: t.ink }}>{a.name}</Text>
                      </Chip>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </Card>

      {/* coach */}
      <View style={{ marginTop: 18 }}>
        <CoachNote coach={COACH} compact />
      </View>

      {/* recent */}
      <View style={{ marginTop: 26 }}>
        <SectionTitle style={{ marginBottom: 12 }}>Recent sessions</SectionTitle>
        <View style={{ gap: 10 }}>
          {sessions.slice(0, 4).map((s, k) => {
            const idn = identities.find((i) => i.id === s.id) || drift;
            const c = colorsFor(idn);
            return (
              <Card key={k} style={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Glyph char={idn.glyph} size={32} fontSize={15} color={c.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontFamily: sans(600), color: t.ink }}>{s.label}</Text>
                  <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>{s.when}</Text>
                </View>
                <Text style={{ fontSize: 15, fontFamily: sans(700), color: t.inkSoft }}>{s.mins}m</Text>
              </Card>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
