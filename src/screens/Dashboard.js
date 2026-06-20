/* Portfolio / Dashboard tab, ported from screens.jsx (Dashboard + CosmosHero). */
import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, useTheme } from '../store/Store';
import { pastWeeks, fmtWhen } from '../data/data';
import { coachNote } from '../lib/coach';
import CosmosViz from '../viz/CosmosViz';
import ConstellationViz from '../viz/ConstellationViz';
import { darkTheme } from '../theme/theme';
import { Card, Glyph, Eyebrow, SectionTitle, Pill } from '../components/primitives';
import Icon from '../components/Icon';
import IdentityRow from '../components/IdentityRow';
import DualBar from '../components/DualBar';
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
                { f: 'orbit', label: 'Orbit' },
                { f: 'constellation', label: 'Constellation' },
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
          {identities.length === 0 ? (
            <View style={{ height: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
              <Text style={{ fontFamily: serif(500, true), fontSize: 18, color: dk.inkSoft, textAlign: 'center', lineHeight: 26 }}>
                An empty sky, for now. Add an identity to light the first star.
              </Text>
            </View>
          ) : (
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
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 2 }}>
          <LegendItem filled label={'fill = your time'} dk={dk} />
          <LegendItem filled={false} label="ring = intention" dk={dk} />
        </View>
      </LinearGradient>
    </View>
  );
}

export default function Dashboard() {
  const { t, colorsFor } = useTheme();
  const { identities, retired, relax, sessions, planHistory, openLog, openAdd, focusCosmos, week, weekPlanned, openPlan, userName } = useStore();
  const relaxC = colorsFor(relax);
  const pad = useScreenPad();

  const hasIdentities = identities.length > 0;
  // nothing lived yet this week → don't claim hours are "leaning" anywhere; show
  // an inviting prompt instead (the lead/lag ranking is meaningless at all-zero).
  const livedAny = identities.some((i) => i.actual > 0) || (relax.tracked && relax.actual > 0);
  // undefined when every identity has been retired — guard all reads below
  const lead = hasIdentities ? [...identities].sort((a, b) => b.actual - b.desired - (a.actual - a.desired))[0] : null;
  const lag = hasIdentities ? [...identities].sort((a, b) => a.actual - a.desired - (b.actual - b.desired))[0] : null;
  const single = lead && lag && lead.id === lag.id; // only one identity → no lead/lag contrast

  // gentle "vs last week" for the lagging identity. Three honest states: it has
  // no history (brand new), it was behind last week too, or it kept pace. Last
  // week's rows are derived from real sessions (empty until a week accrues).
  const lastWeekRows = pastWeeks(sessions, identities, planHistory, 1)[0]?.rows || [];
  const lagLast = lag ? lastWeekRows.find((r) => r.id === lag.id) : null;
  const lagWeekNote = !lag
    ? null
    : !lagLast
    ? `${lag.name} is new to your cosmos — a first session would bring it to life.`
    : lagLast.actual < lagLast.plan
    ? `${lag.name} was quiet last week too — a short session would turn it around.`
    : `${lag.name} kept pace last week — an evening would bring it back in step.`;

  // "A note from Cosmo" + the date header, generated from this week's data
  const coach = coachNote(identities, lastWeekRows);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingTop: 8 }}>
        <Eyebrow>{coach.date}</Eyebrow>
        <Text style={{ fontFamily: serif(500), fontSize: 38, lineHeight: 40, color: t.ink, marginTop: 8, marginBottom: 6, letterSpacing: -0.4 }}>
          Good morning{userName ? `, ${userName}` : ''}
        </Text>
        <Text style={{ fontFamily: serif(400, true), fontSize: 19, color: t.inkSoft }}>
          Am I spending my time becoming the person I want to be?
        </Text>
      </View>

      <View style={{ marginTop: 18 }}>
        <WeekPlanBanner week={week} planned={weekPlanned} onPlan={openPlan} />
      </View>

      <View style={{ marginTop: 18 }}>
        <CosmosHero identities={identities} onTap={openLog} name={userName} />
      </View>

      {/* this week's balance — a gentle observation, no score (the cosmos above
          carries the per-identity picture). Empty state once all are retired. */}
      {hasIdentities ? (
        <Card style={{ marginTop: 18, padding: 24 }}>
          <SectionTitle style={{ marginBottom: 10 }}>This week’s balance</SectionTitle>
          {!livedAny ? (
            <Text style={{ fontSize: 16.5, lineHeight: 25, color: t.ink }}>
              A fresh week. You haven’t logged any time yet — tap a star to tend to an identity, and your balance will take shape here.
            </Text>
          ) : single ? (
            <Text style={{ fontSize: 16.5, lineHeight: 25, color: t.ink }}>
              You’re giving <Text style={{ fontFamily: sans(700), color: colorsFor(lead).color }}>{lead.name}</Text> steady attention this week.
            </Text>
          ) : (
            <Text style={{ fontSize: 16.5, lineHeight: 25, color: t.ink }}>
              Your hours are leaning toward <Text style={{ fontFamily: sans(700), color: colorsFor(lead).color }}>{lead.name}</Text>, while{' '}
              <Text style={{ fontFamily: sans(700), color: colorsFor(lag).color }}>{lag.name}</Text> has had the least of you.
            </Text>
          )}
          {!single && livedAny && (
            <Text style={{ fontSize: 13.5, lineHeight: 20, color: t.inkSoft, fontFamily: sans(500), marginTop: 10 }}>
              {lagWeekNote}
            </Text>
          )}
          {!single && livedAny && (
            <Pill bg={t.ink} onPress={() => openLog(lag)} style={{ marginTop: 16, alignSelf: 'flex-start' }}>
              <Icon name="plus" size={15} color={t.bg} />
              <Text style={{ color: t.bg, fontFamily: sans(700), fontSize: 13 }}>Tend to {lag.name}</Text>
            </Pill>
          )}
        </Card>
      ) : (
        <Card style={{ marginTop: 18, padding: 26, alignItems: 'center' }}>
          <Text style={{ fontFamily: serif(500), fontSize: 22, color: t.ink, textAlign: 'center', marginBottom: 8 }}>Your cosmos is empty</Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: t.inkSoft, textAlign: 'center', marginBottom: 18 }}>
            You’ve retired every identity. Add one to begin tending your time again.
          </Text>
          <Pill bg={t.ink} onPress={openAdd} style={{ paddingHorizontal: 20, paddingVertical: 11 }}>
            <Icon name="plus" size={15} color={t.bg} />
            <Text style={{ color: t.bg, fontFamily: sans(700), fontSize: 13.5 }}>Add an identity</Text>
          </Pill>
        </Card>
      )}

      {/* breakdown */}
      <Card style={{ marginTop: 18, paddingHorizontal: 24, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <SectionTitle>Desired vs. actual</SectionTitle>
          <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>past 7 days</Text>
        </View>
        {/* tap surfaces the focus panel (Log / Open Detail), same as the cosmos */}
        {identities.map((i, k) => (
          <IdentityRow key={i.id} idn={i} onTap={focusCosmos} topBorder={k > 0} />
        ))}

        {/* relaxation — a planned allowance of guilt-free rest */}
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
                    ? 'Allowance full — rest freely, you’ve earned it'
                    : `${relax.desired - relax.actual}% of your rest allowance left this week`}
                </Text>
              </View>
            </Pressable>
          </View>
        )}

      </Card>

      {/* coach */}
      <View style={{ marginTop: 18 }}>
        <CoachNote coach={coach} compact />
      </View>

      {/* recent */}
      <View style={{ marginTop: 26 }}>
        <SectionTitle style={{ marginBottom: 12 }}>Recent sessions</SectionTitle>
        <View style={{ gap: 10 }}>
          {sessions.slice(0, 4).map((s, k) => {
            // resolve retired identities + relaxation too, so past sessions keep their glyph/name
            const idn = identities.find((i) => i.id === s.id) || retired.find((i) => i.id === s.id) || (s.id === relax.id ? relax : null);
            if (!idn) return null;
            const c = colorsFor(idn);
            return (
              <Card key={k} style={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Glyph char={idn.glyph} size={32} fontSize={15} color={c.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontFamily: sans(600), color: t.ink }}>{s.label}</Text>
                  <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>{fmtWhen(s.ts) || s.when}</Text>
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
