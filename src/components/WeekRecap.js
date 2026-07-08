/* End-of-week recap modal — shown automatically the first time the app opens in
   a new week (the store stamps it once per week). Summarizes the week just
   completed from real data: alignment ring, delta vs. the week before, the
   deterministic coach note, and "tended in full" wins. A doorway into the full
   Reflect tab, not a replacement for it. */
import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Eyebrow, Button, Pill } from './primitives';
import Icon from './Icon';
import AlignmentRing from './AlignmentRing';
import { pastWeeks } from '../data/data';
import { lastWeekTrend } from '../lib/coach';
import { serif, sans } from '../theme/fonts';

export default function WeekRecap() {
  const { t, colorsFor } = useTheme();
  const { recapOpen, closeRecap, identities, sessions, planHistory, goTo } = useStore();

  // derive the completed week's story (cheap; only while the modal is up)
  const weeks = useMemo(
    () => (recapOpen ? pastWeeks(sessions, identities, planHistory) : []),
    [recapOpen, sessions, identities, planHistory]
  );
  if (!recapOpen) return null;

  const trend = lastWeekTrend(weeks);
  const rows = weeks[0]?.rows || [];
  const byId = Object.fromEntries(identities.map((i) => [i.id, i]));
  // wins: identities that met the intention in force that week, fullest first
  const met = rows
    .filter((r) => r.plan > 0 && r.actual >= r.plan)
    .sort((a, b) => (b.actual - b.plan) - (a.actual - a.plan))
    .map((r) => byId[r.id])
    .filter(Boolean)
    .slice(0, 3);
  const tended = rows.filter((r) => r.actual > 0).length;

  const seeReflection = () => { closeRecap(); goTo('reflect'); };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 55, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
      <Pressable onPress={closeRecap} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,16,12,0.5)' }} />

      <View style={[{ alignSelf: 'stretch', maxWidth: 460, backgroundColor: t.surface, borderRadius: 30, paddingHorizontal: 26, paddingTop: 28, paddingBottom: 24 }, t.shadow.lg]}>
        <Eyebrow style={{ textAlign: 'center', marginBottom: 6 }}>Week complete · {trend.week}</Eyebrow>
        <Text style={{ fontFamily: serif(500), fontSize: 27, lineHeight: 33, color: t.ink, textAlign: 'center', marginBottom: 18 }}>
          How last week <Text style={{ fontFamily: serif(500, true) }}>added up.</Text>
        </Text>

        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <AlignmentRing value={trend.aligned} size={128} />
          {trend.delta !== 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Icon name="arrow" size={14} stroke={2} color={trend.delta >= 0 ? t.good : t.warn} />
              <Text style={{ fontSize: 14, fontFamily: sans(700), color: trend.delta >= 0 ? t.good : t.warn }}>
                {trend.delta >= 0 ? '+' : ''}{trend.delta} from the week before
              </Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 14.5, color: t.inkSoft, lineHeight: 21, textAlign: 'center', marginBottom: 16 }}>{trend.note}</Text>

        {(met.length > 0 || tended > 0) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
            {met.length > 0 ? (
              met.map((i) => {
                const c = colorsFor(i);
                return (
                  <Pill key={i.id} bg={c.soft}>
                    <Icon name="check" size={13} stroke={2.4} color={c.color} />
                    <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: c.color }}>{i.name} tended in full</Text>
                  </Pill>
                );
              })
            ) : (
              <Pill bg={t.surface3}>
                <Icon name="check" size={13} stroke={2.4} color={t.ink} />
                <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: t.ink }}>
                  Showed up for {tended} {tended === 1 ? 'identity' : 'identities'}
                </Text>
              </Pill>
            )}
          </View>
        )}

        <Button onPress={seeReflection}>
          <Text style={{ color: t.bg, fontFamily: sans(600), fontSize: 16 }}>See the full reflection</Text>
          <Icon name="arrow" size={17} stroke={2.2} color={t.bg} />
        </Button>
        <Button variant="ghost" onPress={closeRecap} style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 15, fontFamily: sans(600), color: t.inkSoft }}>Not now</Text>
        </Button>
      </View>
    </View>
  );
}
