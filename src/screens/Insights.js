/* Insights tab — rebalancing observations, ported from Insights in screens.jsx. */
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { INSIGHTS, COACH } from '../data/data';
import { Card, Eyebrow, Pill } from '../components/primitives';
import Icon from '../components/Icon';
import CoachNote from '../components/CoachNote';
import { useScreenPad } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

const TONE = {
  neglect: { palette: 'painter', icon: 'clock' },
  nudge: { palette: 'writer', icon: 'arrow' },
  trade: { palette: 'drift', icon: 'bell' },
  balance: { palette: 'engineer', icon: 'flame' },
};

export default function Insights() {
  const { t } = useTheme();
  const { identities, retired, drift, openLog } = useStore();
  const find = (id) => identities.find((i) => i.id === id) || retired.find((i) => i.id === id) || drift;
  const pad = useScreenPad();

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
        {INSIGHTS.map((ins, k) => {
          const tone = TONE[ins.kind];
          const tColors = t.id[tone.palette];
          return (
            <Card key={k} style={{ flexDirection: 'row', gap: 18, padding: 24, alignItems: 'flex-start' }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: tColors.color, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={tone.icon} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: sans(700), lineHeight: 22, marginBottom: 6, color: t.ink }}>{ins.title}</Text>
                <Text style={{ fontSize: 14.5, color: t.inkSoft, lineHeight: 22 }}>{ins.body}</Text>
                {ins.action && (
                  <Pill
                    bg={tColors.soft}
                    onPress={() => openLog(ins.id === 'drift' ? null : find(ins.id))}
                    style={{ marginTop: 14, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.ink }}>{ins.action}</Text>
                    <Icon name="chevron" size={14} color={t.ink} />
                  </Pill>
                )}
              </View>
            </Card>
          );
        })}
      </View>

      <View style={{ marginTop: 22 }}>
        <CoachNote coach={COACH} />
      </View>
    </ScrollView>
  );
}
