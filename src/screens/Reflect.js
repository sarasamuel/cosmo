/* Reflect tab — weekly reflection, reworked per CHANGES.md to surface weekly
   alignment: last-week hero, alignment-over-time trend, plan-vs-lived per week,
   and a monthly activity tracker. Ported from Reflect in screens2.jsx. */
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { REFLECTION, WEEKS, MONTH } from '../data/data';
import { Card, Glyph, Eyebrow, SectionTitle, Pill } from '../components/primitives';
import Icon from '../components/Icon';
import AlignmentRing from '../components/AlignmentRing';
import PastWeeks from '../weekly/PastWeeks';
import ActivityTracker from '../weekly/ActivityTracker';
import { useScreenPad } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

function StackedBar({ items, field, label, colorsFor }) {
  const { t } = useTheme();
  const total = items.reduce((s, i) => s + i[field], 0) || 1;
  return (
    <View>
      <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.inkSoft, marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', height: 26, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
        {items.map((i) => {
          const frac = i[field] / total;
          const c = colorsFor(i);
          return (
            <View
              key={i.id}
              style={{ flex: i[field] > 0 ? i[field] : 0.0001, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center', minWidth: i[field] > 0 ? 2 : 0 }}
            >
              {frac > 0.1 && <Text style={{ color: '#fff', fontSize: 11, fontFamily: sans(700) }}>{i.glyph}</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function Reflect() {
  const { t, colorsFor } = useTheme();
  const { identities, drift } = useStore();
  const delta = REFLECTION.aligned - REFLECTION.alignedLast;
  const lived = [...identities, drift];
  const pad = useScreenPad();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingTop: 8 }}>
        <Eyebrow>Weekly reflection</Eyebrow>
        <Text style={{ fontFamily: serif(500), fontSize: 34, color: t.ink, marginTop: 8, marginBottom: 2 }}>How the weeks add up</Text>
        <Text style={{ fontSize: 15.5, color: t.inkSoft }}>Each week you set a plan. Here is how closely you lived it.</Text>
      </View>

      {/* hero — most recent completed week */}
      <Card style={{ marginTop: 20, padding: 28, flexDirection: 'row', gap: 24, alignItems: 'center' }}>
        <AlignmentRing value={REFLECTION.aligned} size={140} />
        <View style={{ flex: 1 }}>
          <SectionTitle style={{ marginBottom: 4 }}>Last week · {REFLECTION.week}</SectionTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="arrow" size={16} stroke={2} color={delta >= 0 ? t.good : t.warn} />
            <Text style={{ fontSize: 15, fontFamily: sans(700), color: delta >= 0 ? t.good : t.warn }}>
              {delta >= 0 ? '+' : ''}{delta} from the week before
            </Text>
          </View>
          <Text style={{ fontSize: 14.5, color: t.inkSoft, lineHeight: 22, marginTop: 12 }}>
            Closer than last week, though still drifting. Your intention and your hours are slowly converging.
          </Text>
        </View>
      </Card>

      {/* per-week breakdown — plan vs lived */}
      <View style={{ marginTop: 26 }}>
        <SectionTitle style={{ marginBottom: 14 }}>Last week, plan vs. lived</SectionTitle>
        <PastWeeks weeks={WEEKS} year={MONTH.year} />
      </View>

      {/* monthly activity tracker */}
      <View style={{ marginTop: 26 }}>
        <ActivityTracker month={MONTH} />
      </View>

      {/* portfolio balance */}
      <Card style={{ marginTop: 26, padding: 24 }}>
        <SectionTitle style={{ marginBottom: 18 }}>Portfolio balance</SectionTitle>
        <View style={{ gap: 18 }}>
          <StackedBar items={identities} field="desired" label="Intended" colorsFor={colorsFor} />
          <StackedBar items={lived} field="actual" label="Lived" colorsFor={colorsFor} />
        </View>
      </Card>

      {/* summary */}
      <Card style={{ marginTop: 26, padding: 30 }}>
        <SectionTitle style={{ marginBottom: 14 }}>In a sentence</SectionTitle>
        <Text style={{ fontFamily: serif(400), fontSize: 22, lineHeight: 33, color: t.ink }}>{REFLECTION.summary}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          {REFLECTION.wins.map((w, k) => (
            <Pill key={k} bg={t.surface3}>
              <Icon name="check" size={14} stroke={2.4} color={t.ink} />
              <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.ink }}>{w}</Text>
            </Pill>
          ))}
        </View>
      </Card>

      {/* focus */}
      <View style={{ marginTop: 26 }}>
        <SectionTitle style={{ marginBottom: 14 }}>Where to lean next week</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {REFLECTION.focus.map((fid) => {
            const i = identities.find((x) => x.id === fid);
            if (!i) return null;
            const c = colorsFor(i);
            return (
              <Card key={fid} style={{ flex: 1, padding: 22, alignItems: 'center', overflow: 'hidden' }}>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.soft, opacity: 0.5 }} />
                <Glyph char={i.glyph} size={46} fontSize={22} color={c.color} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 17, fontFamily: sans(700), color: t.ink }}>{i.name}</Text>
                <Text style={{ fontSize: 13, color: t.inkSoft, fontFamily: sans(600), marginTop: 2 }}>{i.desired - i.actual}pts below intention</Text>
              </Card>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
