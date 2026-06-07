/* Identity Details — a single identity's full picture: this week's standing,
   a month-at-a-glance dot strip, the recent weeks' plan-vs-lived, recent logged
   moments, and management actions. Self-contained and NOT yet wired into
   navigation: pass an `identity` (and optionally `sessions`); both default to
   the data-model seeds so the screen previews standalone. `onBack` and the
   `onRest`/`onEdit`/`onRetire` handlers are optional hooks for later wiring. */
import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Card, Glyph, Eyebrow, SectionTitle } from '../components/primitives';
import Icon from '../components/Icon';
import DualBar from '../components/DualBar';
import { IDENTITIES, MONTH, WEEKS, fmtMins } from '../data/data';
import { useScreenPad } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

// "resting" / "active" descriptor from how long it's been since a session.
function presence(days) {
  if (days === 0) return 'active today';
  if (days <= 2) return 'active recently';
  if (days <= 5) return 'a little quiet';
  return 'resting lately';
}

// One gentle line on this week's standing, keyed on lived-vs-intention.
function weekNote(actual, desired) {
  if (desired <= 0) return 'No intention set for this week — log freely.';
  if (actual >= desired) return 'Carrying the week — at or above your intention. Nothing to fix.';
  if (actual >= desired * 0.66) return 'Close to your intention. A little more brings it home.';
  return 'A soft presence lately — under your intention, but never gone. No pressure to change that.';
}

/* A row in the "Manage" card: leading icon disc, title + subtitle, chevron. */
function ManageRow({ icon, title, subtitle, color, onPress, last }) {
  const { t } = useTheme();
  const tint = color || t.ink;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.line2,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontFamily: sans(600), color: tint }}>{title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: sans(500), color: t.inkSoft, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Icon name="chevron" size={18} stroke={2} color={t.inkFaint} />
    </Pressable>
  );
}

export default function IdentityDetail({
  identity: identityProp,
  onBack,
  onRest,
  onEdit,
  onRetire,
}) {
  const { t, colorsFor } = useTheme();
  const { identities, sessions } = useStore();
  const pad = useScreenPad();

  // Resolve the live identity from the store (by id) so the screen reflects
  // logging done while it's open; fall back to the passed object, then to a
  // seed identity so the screen still previews when rendered standalone.
  const base = identityProp || IDENTITIES.find((i) => i.id === 'painter') || IDENTITIES[0];
  const identity = identities.find((i) => i.id === base.id) || base;
  const c = colorsFor(identity);

  const monthDays = MONTH.done[identity.id] || [];
  const moments = sessions.filter((s) => s.id === identity.id);
  // most-recent-first weeks that carry a row for this identity, capped to 4
  const weekRows = WEEKS
    .map((w) => ({ label: w.label.split(' – ')[0], row: w.rows.find((r) => r.id === identity.id) }))
    .filter((w) => w.row)
    .slice(0, 4);

  const intentionFrac = identity.desired > 0 ? Math.min(100, (identity.actual / identity.desired) * 100) : 0;
  const days = Array.from({ length: MONTH.days }, (_, i) => i + 1);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12, marginBottom: 4 }}>
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="chevron" size={22} stroke={2.2} color={t.inkSoft} />
          </View>
        </Pressable>
      )}

      {/* hero — glowing glyph, name, presence line */}
      <View style={{ alignItems: 'center', paddingTop: 18, marginBottom: 26 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          {/* layered halo behind the disc */}
          <View style={{ position: 'absolute', width: 116, height: 116, borderRadius: 58, backgroundColor: c.soft }} />
          <Glyph char={identity.glyph} size={76} fontSize={34} color={c.color} style={t.shadow.md} />
        </View>
        <Text style={{ fontFamily: serif(500), fontSize: 40, lineHeight: 44, color: t.ink, letterSpacing: -0.4 }}>{identity.name}</Text>
        <Text style={{ fontSize: 14.5, fontFamily: sans(600), color: t.inkSoft, marginTop: 6 }}>
          {monthDays.length} {monthDays.length === 1 ? 'moment' : 'moments'} in {MONTH.name} · {presence(identity.lastActiveDays)}
        </Text>
      </View>

      {/* this week */}
      <Card style={{ paddingHorizontal: 22, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <SectionTitle>This week</SectionTitle>
          <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: t.inkFaint }}>
            planned {identity.desired}% · lived {identity.actual}%
          </Text>
        </View>
        <DualBar actual={intentionFrac} color={c.color} height={10} />
        <Text style={{ fontSize: 13.5, fontFamily: sans(500), color: t.inkSoft, lineHeight: 20, marginTop: 14 }}>
          {weekNote(identity.actual, identity.desired)}
        </Text>
      </Card>

      {/* this month — one dot per day, lit on days with a logged session */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 14, paddingHorizontal: 2 }}>
        <Eyebrow>This month</Eyebrow>
        <Eyebrow style={{ color: t.inkSoft }}>{MONTH.name}</Eyebrow>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
        {days.map((d) => {
          const on = monthDays.includes(d);
          const isToday = d === MONTH.todayDay;
          return (
            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={[
                  {
                    width: on ? 9 : 5,
                    height: on ? 9 : 5,
                    borderRadius: 999,
                    backgroundColor: on ? c.color : t.surface3,
                    borderWidth: !on && isToday ? 1 : 0,
                    borderColor: t.inkFaint,
                  },
                  on ? { shadowColor: c.color, shadowOpacity: 0.7, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } } : null,
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* across the weeks — plan vs lived per recent week */}
      <SectionTitle style={{ marginTop: 28, marginBottom: 14, paddingHorizontal: 2 }}>Across the weeks</SectionTitle>
      <Card style={{ paddingHorizontal: 22, paddingVertical: 20 }}>
        <View style={{ gap: 16 }}>
          {weekRows.map(({ label, row }) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Text style={{ width: 58, fontSize: 13.5, fontFamily: sans(600), color: t.inkSoft }}>{label}</Text>
              <View style={{ flex: 1 }}>
                <DualBar actual={row.plan > 0 ? (row.actual / row.plan) * 100 : 0} color={c.color} height={8} />
              </View>
              <Text style={{ width: 52, textAlign: 'right', fontSize: 12.5, fontFamily: sans(700), color: t.inkFaint }}>
                {row.actual}/{row.plan}%
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* recent moments — logged sessions for this identity */}
      <SectionTitle style={{ marginTop: 28, marginBottom: 14, paddingHorizontal: 2 }}>Recent moments</SectionTitle>
      <Card style={{ paddingHorizontal: 22, paddingVertical: 6 }}>
        {moments.length === 0 ? (
          <Text style={{ fontSize: 14, fontFamily: sans(500), color: t.inkFaint, paddingVertical: 18, textAlign: 'center' }}>
            No moments logged yet.
          </Text>
        ) : (
          moments.map((m, k) => (
            <View
              key={k}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 16,
                borderBottomWidth: k === moments.length - 1 ? 0 : 1,
                borderBottomColor: t.line2,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="clock" size={18} stroke={2} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>{m.label}</Text>
                <Text style={{ fontSize: 13, fontFamily: sans(500), color: t.inkSoft, marginTop: 2 }}>{m.when}</Text>
              </View>
              <Text style={{ fontFamily: serif(500), fontSize: 19, color: t.ink }}>{fmtMins(m.mins)}</Text>
            </View>
          ))
        )}
      </Card>

      {/* manage */}
      <SectionTitle style={{ marginTop: 28, marginBottom: 14, paddingHorizontal: 2 }}>Manage</SectionTitle>
      <Card style={{ paddingHorizontal: 22, paddingVertical: 2 }}>
        <ManageRow
          icon={<Icon name="moon" size={18} stroke={2} color={t.inkSoft} />}
          title="Rest this week"
          subtitle="Skip the plan once — bring it back any time"
          onPress={onRest}
        />
        <ManageRow
          icon={<Icon name="sparkle" size={18} color={t.inkSoft} />}
          title="Edit name & color"
          subtitle={`How ${identity.name} appears in your cosmos`}
          onPress={onEdit}
        />
        <ManageRow
          icon={<Icon name="archive" size={18} stroke={1.8} color={t.warn} />}
          title="Retire this identity"
          subtitle="Let it rest for now — kept in your history"
          color={t.warn}
          onPress={onRetire}
          last
        />
      </Card>
    </ScrollView>
  );
}
