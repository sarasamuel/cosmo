/* Onboarding step 3 — allocate %, ported from OnbAllocate. */
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../store/Store';
import { Card, Eyebrow, Button, dotStyle } from '../components/primitives';
import { serif, sans } from '../theme/fonts';
import { CADENCE, fmtDur, personaColor, FREE_TIME } from './helpers';

export default function OnbAllocate({ selected, cadence, freeHours, onBack, onContinue }) {
  const { t } = useTheme();
  const cfg = CADENCE[cadence];

  const [rows, setRows] = useState(() => {
    const base = Math.floor(100 / selected.length / 5) * 5;
    // keep identities in pick order, but always float Relaxation Time to the end
    const ordered = [...selected].sort((a, b) => (a === FREE_TIME ? 1 : 0) - (b === FREE_TIME ? 1 : 0));
    return ordered.map((n) => ({ name: n, color: personaColor(n, selected.indexOf(n), t), pct: base }));
  });
  const total = rows.reduce((s, r) => s + r.pct, 0);
  const set = (name, v) => setRows((rs) => rs.map((r) => (r.name === name ? { ...r, pct: v } : r)));

  return (
    <View style={{ flex: 1, paddingTop: 50 }}>
      <Eyebrow>Step three</Eyebrow>
      <Text style={{ fontFamily: serif(500), fontSize: 33, color: t.ink, marginTop: 10, marginBottom: 8 }}>Your first week</Text>
      <Text style={{ fontSize: 16, color: t.inkSoft, marginBottom: 8, lineHeight: 24 }}>
        Divide this week’s {fmtDur(freeHours)} {cfg.noun} between them. You’ll choose again next week — nothing here is permanent.
      </Text>
      <Text style={{ fontSize: 15, fontFamily: sans(700), color: total === 100 ? t.good : t.warn, marginBottom: 18 }}>
        {total}% allocated {total === 100 ? '· balanced' : ''}
      </Text>

      <Card style={{ paddingHorizontal: 22, paddingVertical: 6 }}>
        {rows.map((r, k) => (
          <View key={r.name} style={{ paddingVertical: 16, borderTopWidth: k ? 1 : 0, borderTopColor: t.line2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={dotStyle(18, r.color)} />
              <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink, flex: 1 }}>
                {r.name}
                {r.name === FREE_TIME && <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: t.id.relax.color }}>  ALLOWANCE</Text>}
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: serif(500), fontSize: 20, color: t.ink }}>{r.pct}%</Text>
                <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint, marginTop: 1 }}>
                  {fmtDur((freeHours * r.pct) / 100)}
                  {cfg.per}
                </Text>
              </View>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={50}
              step={5}
              value={r.pct}
              onValueChange={(v) => set(r.name, v)}
              minimumTrackTintColor={r.color}
              maximumTrackTintColor={t.surface3}
              thumbTintColor={r.color}
            />
          </View>
        ))}
      </Card>

      <View style={{ marginTop: 'auto', paddingTop: 30, paddingBottom: 30, flexDirection: 'row', gap: 12 }}>
        <Button variant="soft" onPress={onBack} style={{ paddingHorizontal: 28 }}>
          Back
        </Button>
        <Button onPress={onContinue} style={{ flex: 1 }}>
          Continue
        </Button>
      </View>
    </View>
  );
}
