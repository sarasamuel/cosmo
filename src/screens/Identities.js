/* You / Identities tab — now shows this week's plan read-only with a Re-plan
   button (allocation is set weekly via the plan sheet, not fixed forever).
   Ported from Identities in screens2.jsx. */
import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Card, Glyph, Eyebrow, SectionTitle, Button, Pill } from '../components/primitives';
import Icon from '../components/Icon';
import DualBar from '../components/DualBar';
import { useScreenPad } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

export default function Identities() {
  const { t, colorsFor } = useTheme();
  const { identities, week, weekPlanned, openPlan, openAdd, openDetail, openSettings } = useStore();
  const total = identities.reduce((s, i) => s + i.desired, 0);
  const maxPlan = Math.max(...identities.map((i) => i.desired), 1);
  const pad = useScreenPad();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow>Your identities</Eyebrow>
          <Pressable
            onPress={openSettings}
            hitSlop={10}
            accessibilityLabel="Settings"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name="gear" size={20} stroke={1.9} color={t.inkSoft} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: serif(500), fontSize: 34, color: t.ink, marginTop: 8, marginBottom: 4 }}>The person you’re becoming</Text>
        <Text style={{ fontSize: 15.5, color: t.inkSoft, lineHeight: 23 }}>
          You don't fix one balance forever. Each week, you choose anew how much of yourself each identity deserves.
        </Text>
      </View>

      {/* this week's plan */}
      <Card style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <SectionTitle>This week’s plan</SectionTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {weekPlanned && <Icon name="check" size={14} stroke={2.6} color={t.good} />}
            <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: weekPlanned ? t.good : t.warn }}>{weekPlanned ? 'Set' : 'Not set yet'}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, color: t.inkFaint, fontFamily: sans(600), marginBottom: 18 }}>{week.label}</Text>

        <View style={{ gap: 16 }}>
          {identities.map((i) => {
            const c = colorsFor(i);
            return (
              <Pressable
                key={i.id}
                onPress={() => openDetail(i)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.6 : 1 })}
              >
                <Glyph char={i.glyph} size={32} fontSize={15} color={c.color} />
                <Text style={{ width: 86, fontSize: 15.5, fontFamily: sans(600), color: t.ink }}>{i.name}</Text>
                <View style={{ flex: 1 }}>
                  <DualBar actual={(i.desired / maxPlan) * 100} color={c.color} height={8} />
                </View>
                <Text style={{ width: 44, textAlign: 'right', fontFamily: serif(500), fontSize: 18, color: t.ink }}>
                  {i.desired}
                  <Text style={{ fontSize: 12, color: t.inkFaint }}>%</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.line2 }}>
          <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: total === 100 ? t.good : t.inkSoft }}>
            {total}% allocated{total === 100 ? ' · balanced' : ''}
          </Text>
          <Pill bg={t.ink} onPress={openPlan} style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
            <Icon name="sparkle" size={14} color={t.bg} />
            <Text style={{ color: t.bg, fontFamily: sans(700), fontSize: 13.5 }}>{weekPlanned ? 'Re-plan week' : 'Plan this week'}</Text>
          </Pill>
        </View>
      </Card>

      <Text style={{ fontSize: 13, color: t.inkFaint, fontFamily: sans(500), lineHeight: 19, marginTop: 14, paddingHorizontal: 4 }}>
        Your plan resets every week. Look back at <Text style={{ color: t.inkSoft, fontFamily: sans(700) }}>Reflect</Text> to see how each week’s hours measured up.
      </Text>

      <Button variant="soft" onPress={openAdd} style={{ marginTop: 24 }}>
        <Icon name="plus" size={20} color={t.ink} />
        <Text style={{ marginLeft: 10, fontSize: 18, fontFamily: sans(600), color: t.ink }}>Add an identity</Text>
      </Button>
    </ScrollView>
  );
}
