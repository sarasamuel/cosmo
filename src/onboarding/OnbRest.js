/* Onboarding step 3 — the Relaxation allowance, promoted to its own step.
   Rest is a quantity you plan (a share of your free time), not a yes/no toggle.
   0% is an honest, explained state. Ported from the rest-allowance exploration,
   adapted to the no-Drift model: rest beyond the allowance simply caps. */
import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../store/Store';
import { Card, Eyebrow, Button, Glyph } from '../components/primitives';
import Icon from '../components/Icon';
import { serif, sans } from '../theme/fonts';
import { CADENCE, fmtDur } from './helpers';

const REST_MIN = 0;
const REST_MAX = 40;
const REST_STEP = 5;

// adaptive guidance — the line under the readout shifts with the value; 0 is honest
function restGuidance(pct) {
  if (pct <= 0) return { tone: 'zero', title: 'No rest reserved', body: 'Every free hour goes to your identities. You can raise this any week.' };
  if (pct <= 10) return { tone: 'low', title: 'A small, protected margin', body: 'A little guilt-free room to breathe.' };
  if (pct <= 25) return { tone: 'mid', title: 'A healthy allowance', body: 'Enough to truly switch off without it eating into your identities.' };
  return { tone: 'high', title: 'A generous amount of rest', body: 'Plenty of room to recharge — just leaves fewer hours for your identities.' };
}

export default function OnbRest({ cadence = 'week', freeHours = 35, restPct, onSet, onBack, onContinue }) {
  const { t } = useTheme();
  const cfg = CADENCE[cadence];
  const relax = t.id.relax;
  const hours = (freeHours * restPct) / 100;
  const g = restGuidance(restPct);
  const identityShare = 100 - restPct;
  const isZero = restPct <= 0;

  return (
    <View style={{ flex: 1, paddingTop: 50 }}>
      <Eyebrow>Step three</Eyebrow>
      <Text style={{ fontFamily: serif(500), fontSize: 33, color: t.ink, marginTop: 10, marginBottom: 8 }}>How much rest do you want to allow?</Text>
      <Text style={{ fontSize: 16, color: t.inkSoft, marginBottom: 26, lineHeight: 24 }}>
        Rest is something you <Text style={{ fontFamily: serif(400, true) }}>plan</Text>, not something you steal. Set aside guilt-free hours for doing nothing in particular — scrolling, napping, staring out a window.
      </Text>

      {/* the dial */}
      <Card style={{ paddingHorizontal: 26, paddingTop: 28, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <Glyph char="♾" size={46} fontSize={22} color={isZero ? t.surface2 : relax.color} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
              <Text style={{ fontFamily: serif(500), fontSize: 40, lineHeight: 42, color: t.ink }}>{restPct}%</Text>
              <Text style={{ flexShrink: 1, fontSize: 16, fontFamily: sans(600), color: t.inkSoft }}>
                {restPct > 0 ? `· ${fmtDur(hours)} ${cfg.noun}` : 'of your free time'}
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.5, textTransform: 'uppercase', color: relax.color, marginTop: 3 }}>
              Relaxation allowance
            </Text>
          </View>
        </View>

        <Slider
          minimumValue={REST_MIN}
          maximumValue={REST_MAX}
          step={REST_STEP}
          value={restPct}
          onValueChange={onSet}
          minimumTrackTintColor={relax.color}
          maximumTrackTintColor={t.surface3}
          thumbTintColor={relax.color}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>None</Text>
          <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>{REST_MAX}%</Text>
        </View>

        {/* how your free time splits — rest vs. everything else */}
        <View style={{ marginTop: 22, paddingTop: 20, borderTopWidth: 1, borderTopColor: t.line2 }}>
          <View style={{ flexDirection: 'row', height: 12, borderRadius: 999, overflow: 'hidden', backgroundColor: t.surface2 }}>
            <View style={{ width: `${restPct}%`, backgroundColor: relax.color }} />
            <View style={{ flex: 1, backgroundColor: t.ink, opacity: 0.16 }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 }}>
            <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: restPct > 0 ? relax.color : t.inkFaint }}>
              {restPct > 0 ? `Rest · ${restPct}%` : 'No rest'}
            </Text>
            <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkSoft }}>For your identities · {identityShare}%</Text>
          </View>
        </View>
      </Card>

      {/* adaptive guidance */}
      <View
        style={{
          marginTop: 16,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start',
          padding: 16,
          borderRadius: t.radii.sm,
          backgroundColor: isZero ? t.surface : relax.soft,
          borderWidth: 1,
          borderColor: isZero ? t.line2 : relax.color,
        }}
      >
        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isZero ? t.surface2 : relax.color }}>
          {isZero ? (
            <Text style={{ fontSize: 15, fontFamily: sans(700), color: t.inkFaint }}>—</Text>
          ) : (
            <Icon name="moon" size={14} stroke={2} color="#fff" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontFamily: sans(700), color: isZero ? t.ink : relax.color }}>{g.title}</Text>
          <Text style={{ fontSize: 13, color: t.inkSoft, lineHeight: 19, marginTop: 2 }}>{g.body}</Text>
        </View>
      </View>

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
