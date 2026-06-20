/* Onboarding step 4 — allocate % across the chosen identities. (Rest is set
   separately in its own step now, so it isn't a row here.) */
import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../store/Store';
import { Card, Eyebrow, Button, dotStyle } from '../components/primitives';
import { serif, sans } from '../theme/fonts';
import { CADENCE, fmtDur, personaColor } from './helpers';

export default function OnbAllocate({ selected, cadence, freeHours, alloc, onSetAlloc, onBack, onContinue }) {
  const { t } = useTheme();
  const cfg = CADENCE[cadence];

  // Allocations live in the parent (keyed by name) so the final cosmos can read
  // them; an unset persona defaults to an even split. Same default the parent's
  // identity builder uses, so the totals shown here match what's committed.
  const base = Math.floor(100 / Math.max(1, selected.length) / 5) * 5;
  const rows = selected.map((n) => ({ name: n, color: personaColor(n, selected.indexOf(n), t), pct: alloc[n] != null ? alloc[n] : base }));
  const total = rows.reduce((s, r) => s + r.pct, 0);
  const set = (name, v) => onSetAlloc({ ...alloc, [name]: v });

  return (
    <View style={{ flex: 1, paddingTop: 50 }}>
      <Eyebrow>Step four</Eyebrow>
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
              <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink, flex: 1 }}>{r.name}</Text>
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
