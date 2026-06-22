/* Onboarding step 2 — cadence + free time, ported from OnbCadence. */
import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../store/Store';
import { Card, Eyebrow, Button } from '../components/primitives';
import Icon from '../components/Icon';
import { serif, sans } from '../theme/fonts';
import { CADENCE, fmtDur, clock } from './helpers';

export default function OnbCadence({ cadence, freeHours, onSetHours, onBack, onContinue }) {
  const { t } = useTheme();
  const cfg = CADENCE[cadence];
  const startH = 24 - freeHours;

  return (
    <View style={{ flex: 1, paddingTop: 50 }}>
      <Eyebrow>Step two</Eyebrow>
      <Text style={{ fontFamily: serif(500), fontSize: 33, color: t.ink, marginTop: 10, marginBottom: 8 }}>How much time is yours?</Text>
      <Text style={{ fontSize: 16, color: t.inkSoft, marginBottom: 26, lineHeight: 24 }}>
        Each week you’ll plan how to spend your free hours across your identities. First, how many free hours does a typical week hold for you?
      </Text>

      <Card style={{ paddingHorizontal: 26, paddingTop: 30, paddingBottom: 26 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <Text style={{ flexShrink: 1, fontSize: 15, fontFamily: sans(600), color: t.inkSoft }}>Free time {cfg.noun}</Text>
          <Text style={{ fontFamily: serif(500), fontSize: 34, color: t.ink }}>{fmtDur(freeHours)}</Text>
        </View>
        <Text style={{ fontSize: 13.5, color: t.inkFaint, fontFamily: sans(500), marginBottom: 22, lineHeight: 19 }}>
          The hours that are truly yours to spend — after work, sleep, and obligations.
        </Text>
        <Slider
          minimumValue={cfg.min}
          maximumValue={cfg.max}
          step={cfg.step}
          value={freeHours}
          onValueChange={onSetHours}
          minimumTrackTintColor={t.ink}
          maximumTrackTintColor={t.surface3}
          thumbTintColor={t.ink}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>{fmtDur(cfg.min)}</Text>
          <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>{fmtDur(cfg.max)}</Text>
        </View>

        {cfg.window && (
          <View style={{ marginTop: 22, paddingTop: 20, borderTopWidth: 1, borderTopColor: t.line2, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="moon" size={15} stroke={2} color={t.inkSoft} />
            </View>
            <View>
              <Text style={{ fontSize: 12, fontFamily: sans(700), letterSpacing: 0.5, textTransform: 'uppercase', color: t.inkFaint }}>Your evening</Text>
              <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>
                {clock(startH)} – {clock(24)}
              </Text>
            </View>
          </View>
        )}
      </Card>

      <Text style={{ fontSize: 13.5, color: t.inkFaint, fontFamily: sans(500), marginTop: 18, lineHeight: 20, textAlign: 'center' }}>
        Every identity’s share is scaled to this — so a percentage always means real hours.
      </Text>

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
