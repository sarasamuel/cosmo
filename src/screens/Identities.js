/* You / Identities tab — now shows this week's plan read-only with a Re-plan
   button (allocation is set weekly via the plan sheet, not fixed forever).
   Ported from Identities in screens2.jsx. */
import React from 'react';
import { ScrollView, View, Text, Pressable, Switch } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Card, Glyph, Eyebrow, SectionTitle, Button, Pill } from '../components/primitives';
import Icon from '../components/Icon';
import DualBar from '../components/DualBar';
import { useScreenPad } from '../lib/layout';
import { fmtAgo } from '../data/data';
import { serif, sans } from '../theme/fonts';

// 12-hour clock label from 24-hour parts, e.g. (18, 0) -> "6:00 PM".
const fmtTime = (h, m) => {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const TIME_PRESETS = [
  { h: 20, m: 0 },
  { h: 21, m: 0 },
  { h: 22, m: 0 }
];

export default function Identities() {
  const { t, colorsFor } = useTheme();
  const { identities, week, weekPlanned, openPlan, openAdd, openDetail, restart, theme, setTheme, reminder, setReminderEnabled, setReminderTime, session, syncStatus, lastSyncedAt, openBackup, signOut } = useStore();
  const total = identities.reduce((s, i) => s + i.desired, 0);
  const maxPlan = Math.max(...identities.map((i) => i.desired), 1);
  const pad = useScreenPad();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingTop: 8 }}>
        <Eyebrow>Your identities</Eyebrow>
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

      {/* appearance */}
      <SectionTitle style={{ marginTop: 28, marginBottom: 12 }}>Appearance</SectionTitle>
      <Card style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: theme === 'dark' ? t.id.writer.color : t.id.painter.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} stroke={2} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>Theme</Text>
          <Text style={{ fontSize: 13, color: t.inkSoft, fontFamily: sans(600) }}>{theme === 'dark' ? 'Deep space' : 'Celestial dawn'}</Text>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 999, padding: 5 }}>
          {[
            { v: 'light', icon: 'sun', label: 'Light' },
            { v: 'dark', icon: 'moon', label: 'Dark' },
          ].map((o) => {
            const on = theme === o.v;
            return (
              <Pressable
                key={o.v}
                onPress={() => setTheme(o.v)}
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: on ? t.surface : 'transparent' },
                  on ? t.shadow.sm : null,
                ]}
              >
                <Icon name={o.icon} size={15} stroke={2} color={on ? t.ink : t.inkSoft} />
                <Text style={{ fontSize: 15, fontFamily: sans(600), color: on ? t.ink : t.inkSoft }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>


      {/* nightly reminder — a local notification at a fixed time each day */}
      <Card style={{ marginTop: 12, padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: reminder.enabled ? t.id.relax.color : t.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="bell" size={18} stroke={2} color={reminder.enabled ? '#fff' : t.inkSoft} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>Nightly reminder</Text>
            <Text style={{ fontSize: 13, color: t.inkSoft, fontFamily: sans(600) }}>
              {'A nudge to reflect on your day and log missed sessions'}
            </Text>
          </View>
          <Switch
            value={reminder.enabled}
            onValueChange={setReminderEnabled}
            trackColor={{ false: t.surface3, true: t.id.relax.color }}
            thumbColor="#fff"
          />
        </View>

        {reminder.enabled && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.line2 }}>
            {TIME_PRESETS.map((p) => {
              const on = reminder.hour === p.h && reminder.minute === p.m;
              return (
                <Pressable
                  key={`${p.h}:${p.m}`}
                  onPress={() => setReminderTime(p.h, p.m)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: on ? 'transparent' : t.line,
                    backgroundColor: on ? t.ink : t.surface2,
                  }}
                >
                  <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: on ? t.bg : t.inkSoft }}>{fmtTime(p.h, p.m)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      {/* cloud backup — passwordless email-code sign-in (local-first; opt-in) */}
      {(() => {
        // live sync state → status line + dot color (no signal before; this is #10)
        const failed = session && syncStatus === 'error';
        const syncing = session && syncStatus === 'syncing';
        const dotBg = !session ? t.surface2 : failed ? t.warn : t.good;
        const statusText = !session
          ? 'Save your progress to a new phone'
          : failed
          ? 'Backup failed — will retry'
          : syncing
          ? 'Syncing…'
          : `Backed up${lastSyncedAt ? ` · ${fmtAgo(lastSyncedAt)}` : ''}`;
        return (
      <Card style={{ marginTop: 12, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: dotBg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={!session ? 'sparkle' : failed ? 'clock' : 'check'} size={18} stroke={2.4} color={session ? '#fff' : t.inkSoft} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>Cloud backup</Text>
          <Text numberOfLines={1} style={{ fontSize: 13, color: failed ? t.warn : t.inkSoft, fontFamily: sans(600) }}>
            {statusText}{session && !failed && !syncing && session.user?.email ? ` · ${session.user.email}` : ''}
          </Text>
        </View>
        {session ? (
          <Pill bg={t.surface2} onPress={signOut} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ color: t.inkSoft, fontFamily: sans(700), fontSize: 13 }}>Sign out</Text>
          </Pill>
        ) : (
          <Pill bg={t.ink} onPress={openBackup} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ color: t.bg, fontFamily: sans(700), fontSize: 13 }}>Back up</Text>
          </Pill>
        )}
      </Card>
        );
      })()}

      <Button variant="ghost" onPress={restart} style={{ marginTop: 6 }}>
        <Icon name="sparkle" size={18} color={t.inkSoft} />
        <Text style={{ marginLeft: 10, fontSize: 18, fontFamily: sans(600), color: t.inkSoft }}>Replay the intro</Text>
      </Button>
    </ScrollView>
  );
}
