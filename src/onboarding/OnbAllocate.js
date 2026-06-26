/* Onboarding step 4 — allocate % across the chosen identities plus Relaxation,
   all sharing one 100% pie (the rest step seeds the relaxation value). */
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../store/Store';
import { Card, Eyebrow, Button, dotStyle } from '../components/primitives';
import { serif, sans } from '../theme/fonts';
import { CADENCE, fmtDur, personaColor } from './helpers';

export default function OnbAllocate({ selected, cadence, freeHours, alloc, onSetAlloc, restPct, onSetRest, onBack, onContinue }) {
  const { t } = useTheme();
  const cfg = CADENCE[cadence];
  const [unit, setUnit] = useState('percent'); // 'percent' | 'hours' — view/edit units; alloc is always stored as %
  const hoursMode = unit === 'hours';

  // Allocations live in the parent (keyed by name) so the final cosmos can read
  // them; an unset persona defaults to an even split of whatever isn't reserved
  // for rest. Same default the parent's identity builder uses, so the totals
  // shown here match what's committed. Relaxation rides in the same 100% pie.
  const base = Math.floor(Math.max(0, 100 - restPct) / Math.max(1, selected.length) / 5) * 5;
  const rows = selected.map((n) => ({
    key: n,
    name: n,
    color: personaColor(n, selected.indexOf(n), t),
    pct: alloc[n] != null ? alloc[n] : base,
    set: (v) => onSetAlloc({ ...alloc, [n]: v }),
  }));
  const allRows = [...rows, { key: '__relax', name: 'Relaxation', color: t.id.relax.color, pct: restPct, set: onSetRest }];
  const total = allRows.reduce((s, r) => s + r.pct, 0);

  // alloc stays canonically a %; Hours mode just edits the same value in hour
  // units, converting against the period's free hours.
  const MAX_PCT = 50; // a single identity can't take more than half via the slider
  const pctToHours = (pct) => (freeHours * pct) / 100;
  const hoursToPct = (h) => (freeHours > 0 ? (h / freeHours) * 100 : 0);
  const hourStep = freeHours <= 10 ? 0.5 : freeHours <= 60 ? 1 : 5;
  const balanced = Math.round(total) === 100;

  return (
    <View style={{ flex: 1, paddingTop: 50 }}>
      <Eyebrow>Step four</Eyebrow>
      <Text style={{ fontFamily: serif(500), fontSize: 33, color: t.ink, marginTop: 10, marginBottom: 8 }}>Your first week</Text>
      <Text style={{ fontSize: 16, color: t.inkSoft, marginBottom: 12, lineHeight: 24 }}>
        Divide this week’s {fmtDur(freeHours)} {cfg.noun} between them. You’ll choose again next week — nothing here is permanent.
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <Text style={{ fontSize: 15, fontFamily: sans(700), color: balanced ? t.good : t.warn }}>
          {hoursMode ? `${fmtDur(pctToHours(total))} of ${fmtDur(freeHours)}` : `${Math.round(total)}% allocated`}
          {balanced ? ' · balanced' : ''}
        </Text>
        {/* Percent / Hours unit toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 999, padding: 4 }}>
          {[['percent', 'Percent'], ['hours', 'Hours']].map(([key, label]) => {
            const on = unit === key;
            return (
              <Pressable key={key} onPress={() => setUnit(key)} style={[{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? t.surface : 'transparent' }, on ? t.shadow.sm : null]}>
                <Text style={{ fontSize: 13, fontFamily: sans(700), color: on ? t.ink : t.inkFaint }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Card style={{ paddingHorizontal: 22, paddingVertical: 6 }}>
        {allRows.map((r, k) => (
          <View key={r.key} style={{ paddingVertical: 16, borderTopWidth: k ? 1 : 0, borderTopColor: t.line2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={dotStyle(18, r.color)} />
              <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink, flex: 1 }}>{r.name}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: serif(500), fontSize: 20, color: t.ink }}>
                  {hoursMode ? fmtDur(pctToHours(r.pct)) : `${Math.round(r.pct)}%`}
                </Text>
                <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint, marginTop: 1 }}>
                  {hoursMode ? `${Math.round(r.pct)}%` : `${fmtDur(pctToHours(r.pct))}${cfg.per}`}
                </Text>
              </View>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={hoursMode ? pctToHours(MAX_PCT) : MAX_PCT}
              step={hoursMode ? hourStep : 5}
              value={hoursMode ? pctToHours(r.pct) : r.pct}
              onValueChange={(v) => r.set(hoursMode ? Math.round(Math.min(MAX_PCT, hoursToPct(v))) : v)}
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
