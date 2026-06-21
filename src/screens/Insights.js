/* Insights tab — rebalancing observations, ported from Insights in screens.jsx. */
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { pastWeeks } from '../data/data';
import { Card, Eyebrow } from '../components/primitives';
import Icon from '../components/Icon';
import CoachNote from '../components/CoachNote';
import { coachNote, buildInsights } from '../lib/coach';
import { useScreenPad } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

// `kind` now drives only the icon; each card takes its color from its identity.
const TONE = { neglect: 'clock', nudge: 'arrow', balance: 'flame' };

export default function Insights() {
  const { t, colorsFor } = useTheme();
  const { identities, retired, sessions, planHistory } = useStore();
  const find = (id) => identities.find((i) => i.id === id) || retired.find((i) => i.id === id);
  const pad = useScreenPad();
  // real insights + last-week reference, derived from the live data (no demo)
  const insights = buildInsights(identities);
  const coach = coachNote(identities, pastWeeks(sessions, identities, planHistory, 1)[0]?.rows);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingTop: 8 }}>
        <Eyebrow>Rebalancing</Eyebrow>
        <Text style={{ fontFamily: serif(500), fontSize: 34, color: t.ink, marginTop: 8, marginBottom: 4 }}>Insights</Text>
        <Text style={{ fontSize: 15.5, color: t.inkSoft, lineHeight: 23 }}>
          Gentle observations from the gap between intention and action. Nothing here is a verdict.
        </Text>
      </View>

      <View style={{ marginTop: 22, gap: 14 }}>
        {insights.length === 0 ? (
          <Card style={{ padding: 24 }}>
            <Text style={{ fontSize: 14.5, color: t.inkSoft, lineHeight: 22, textAlign: 'center' }}>
              No observations yet — log a little time across your identities and Cosmo will start noticing where your week leans.
            </Text>
          </Card>
        ) : (
          insights.map((ins, k) => {
            const idn = find(ins.id);
            const c = idn ? colorsFor(idn) : { color: t.ink, soft: t.surface3 };
            return (
              <Card key={k} style={{ flexDirection: 'row', gap: 18, padding: 24, alignItems: 'flex-start' }}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={TONE[ins.kind]} size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontFamily: sans(700), lineHeight: 22, marginBottom: 6, color: t.ink }}>{ins.title}</Text>
                  <Text style={{ fontSize: 14.5, color: t.inkSoft, lineHeight: 22 }}>{ins.body}</Text>
                  {/* the "log time" call-to-action now lives on the Home screen
                      ("A gentle nudge"); Insights stays a place for observations. */}
                </View>
              </Card>
            );
          })
        )}
      </View>

      <View style={{ marginTop: 22 }}>
        <CoachNote coach={coach} />
      </View>
    </ScrollView>
  );
}
