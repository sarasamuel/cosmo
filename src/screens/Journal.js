/* Journal tab (replaces Insights) — a cross-identity growth feed: the user's own
   notes + milestones, Cosmo's DERIVED auto-milestones, and the weekly note. Three
   content-routed states (cold / seeded / full). Cosmo only counts and curates —
   it never interprets a note; quotes are verbatim, framing is fixed templates. */
import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Glyph, Eyebrow, Button } from '../components/primitives';
import Icon from '../components/Icon';
import { useScreenPad } from '../lib/layout';
import { fmtWhen } from '../data/data';
import { coachNote, buildInsights } from '../lib/coach';
import { autoMilestones, buildFeed, resurface, journalState } from '../lib/journal';
import { serif, sans } from '../theme/fonts';

const GOLD = '#f6bf5c';
const GOLD_INK = '#1c1708';

function Header({ t }) {
  return (
    <View style={{ paddingTop: 8 }}>
      <Eyebrow>Your becoming</Eyebrow>
      <Text style={{ fontFamily: serif(500), fontSize: 34, color: t.ink, marginTop: 8, marginBottom: 4 }}>Journal</Text>
      <Text style={{ fontSize: 15.5, color: t.inkSoft, lineHeight: 23 }}>
        Milestones and notes, in your own words — across every you.
      </Text>
    </View>
  );
}

// one timeline row: a left rail (marker + connecting line) and a card
function Row({ row, t, idn, c, sessionMins, last }) {
  const gold = row.kind === 'milestone' || row.kind === 'auto';
  const cosmo = row.kind === 'cosmo';
  const date = row.date || fmtWhen(row.ts);
  // user milestone uses its text as the headline; auto uses title/sub
  const title = row.kind === 'auto' ? row.title : row.kind === 'milestone' ? row.text : null;
  const body = row.kind === 'auto' ? row.sub : row.kind === 'note' || row.kind === 'cosmo' ? row.text : null;

  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      {/* rail */}
      <View style={{ width: 28, alignItems: 'center' }}>
        {gold ? (
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="star" size={13} color={GOLD_INK} />
          </View>
        ) : cosmo ? (
          <View style={{ width: 22, height: 22, borderRadius: 11, marginTop: 2, backgroundColor: t.surface3, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={12} color={t.inkSoft} />
          </View>
        ) : (
          <View style={{ width: 14, height: 14, borderRadius: 7, marginTop: 4, backgroundColor: c ? c.color : t.inkSoft }} />
        )}
        {!last && <View style={{ width: 2, flex: 1, marginTop: 6, backgroundColor: t.line }} />}
      </View>

      {/* card */}
      <View style={{ flex: 1, minWidth: 0, paddingBottom: 26 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 7 }}>
          {row.kind === 'auto' && (
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: t.surface3 }}>
              <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: t.inkSoft }}>Cosmo noticed</Text>
            </View>
          )}
          {cosmo && (
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: t.surface3 }}>
              <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: t.inkSoft }}>Cosmo</Text>
            </View>
          )}
          {idn && (
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: c.soft }}>
              <Text style={{ fontSize: 11.5, fontFamily: sans(700), color: c.color }}>{idn.name}</Text>
            </View>
          )}
          {row.kind === 'milestone' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="check" size={12} stroke={2.6} color={GOLD} />
              <Text style={{ fontSize: 11.5, fontFamily: sans(800), color: GOLD, letterSpacing: 0.3 }}>Milestone</Text>
            </View>
          )}
          {row.kind === 'note' && sessionMins != null && (
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line2 }}>
              <Text style={{ fontSize: 11.5, fontFamily: sans(600), color: t.inkFaint }}>{sessionMins}m</Text>
            </View>
          )}
          <Text style={{ marginLeft: 'auto', fontSize: 13, fontFamily: sans(700), color: t.inkSoft }}>{date}</Text>
        </View>
        {title ? <Text style={{ fontFamily: serif(500), fontSize: 19, color: t.ink, lineHeight: 24, marginBottom: 5 }}>{title}</Text> : null}
        {body ? (
          <Text style={{ fontFamily: serif(400), fontSize: 16.5, lineHeight: 25, color: row.kind === 'cosmo' || gold ? t.ink : t.inkSoft }}>
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function Journal() {
  const { t, colorsFor } = useTheme();
  const { identities, retired, sessions, journal, joinedAt, openLog } = useStore();
  const pad = useScreenPad();
  const [filter, setFilter] = useState('all');

  const find = (id) => identities.find((i) => i.id === id) || retired.find((i) => i.id === id);
  const sessionById = useMemo(() => {
    const m = {};
    (sessions || []).forEach((s) => { if (s && s.sid) m[s.sid] = s; });
    return m;
  }, [sessions]);

  const autoMs = useMemo(() => autoMilestones(identities, sessions, { joinedAt }), [identities, sessions, joinedAt]);
  const state = journalState(journal, autoMs);
  const coach = useMemo(() => coachNote(identities, []), [identities]);
  const look = useMemo(() => resurface(journal, sessions), [journal, sessions]);
  // one occasional observation (not the toward-intention nudge — that's on Home)
  // so a sparse feed still carries a "Cosmo noticed" moment beyond the milestones.
  const insights = useMemo(() => buildInsights(identities).filter((i) => i.kind !== 'nudge').slice(0, 1), [identities]);

  const feed = useMemo(
    () => buildFeed({ entries: journal, autoMs, coachNote: coach && coach.note, insights, now: Date.now() }),
    [journal, autoMs, coach, insights],
  );
  const shown = filter === 'all' ? feed : feed.filter((r) => r.identityId === filter);

  // ---------- COLD START — no notes and no auto-milestones ----------
  // A clean empty state: just the invitation. No example/placeholder entries.
  if (state === 'cold') {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Header t={t} />
        <View style={{ marginTop: 22, alignItems: 'center', padding: 28, borderRadius: t.radii.lg, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="star" size={26} color={GOLD_INK} />
          </View>
          <Text style={{ fontFamily: serif(500), fontSize: 26, color: t.ink, marginTop: 18, textAlign: 'center' }}>Your story starts here.</Text>
          <Text style={{ fontSize: 15.5, lineHeight: 24, color: t.inkSoft, textAlign: 'center', marginTop: 12, maxWidth: 320 }}>
            As you tend your identities, Cosmo marks the milestones for you. Add your own notes any time — a line about what happened, or what got better.
          </Text>
          <Button onPress={() => openLog(null)} style={{ marginTop: 22, paddingHorizontal: 26 }}>
            <Text style={{ color: t.bg, fontFamily: sans(600), fontSize: 16 }}>Write your first note</Text>
            <Icon name="plus" size={17} stroke={2.3} color={t.bg} />
          </Button>
          <Text style={{ fontSize: 13, fontFamily: sans(600), color: t.inkFaint, marginTop: 14, textAlign: 'center' }}>
            or just start logging — milestones appear on their own
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ---------- SEEDED — auto-milestones, but no written notes ----------
  // ---------- FULL — blended feed ----------
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Header t={t} />

      {/* gentle invite to add the first note (seeded state) */}
      {state === 'seeded' && (
        <Pressable
          onPress={() => openLog(null)}
          style={({ pressed }) => ({ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: t.radii.md, backgroundColor: t.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line, opacity: pressed ? 0.7 : 1 })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={18} stroke={2.3} color={GOLD_INK} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15.5, fontFamily: sans(700), color: t.ink }}>Add your first note</Text>
            <Text style={{ fontSize: 13, color: t.inkSoft, fontFamily: sans(600), marginTop: 2 }}>A line about what got better — Cosmo keeps the rest.</Text>
          </View>
          <Icon name="chevron" size={18} color={t.inkFaint} />
        </Pressable>
      )}

      {/* featured look-back — only when a milestone has an earlier note to contrast */}
      {state === 'full' && look && (() => {
        const idn = find(look.identityId);
        const c = idn ? colorsFor(idn) : { color: t.inkSoft, soft: t.surface3 };
        return (
          <View style={{ marginTop: 20, padding: 20, borderRadius: t.radii.lg, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <Icon name="calendar" size={15} color={c.color} />
              <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.4, textTransform: 'uppercase', color: t.inkFaint }}>A look back · {idn ? idn.name : 'You'}</Text>
            </View>
            <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: t.inkFaint, marginBottom: 4 }}>
              {look.spanWeeks === 1 ? 'a week ago' : `${look.spanWeeks} weeks ago`}
            </Text>
            <Text style={{ fontFamily: serif(400, true), fontSize: 18, lineHeight: 26, color: t.inkSoft }}>“{look.then.text}”</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 }}>
              <Icon name="arrow" size={16} stroke={2} color={t.inkFaint} />
              <Text style={{ fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint }}>{look.sessionCount} sessions between</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Icon name="star" size={12} color={GOLD} />
              <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: GOLD }}>now</Text>
            </View>
            <Text style={{ fontFamily: serif(500), fontSize: 19, lineHeight: 26, color: t.ink }}>“{look.now.text}”</Text>
          </View>
        );
      })()}

      {/* identity filter */}
      <View style={{ marginTop: 22 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {[{ id: 'all', name: 'All' }, ...identities].map((i) => {
            const on = filter === i.id;
            const c = i.id === 'all' ? null : colorsFor(i);
            return (
              <Pressable
                key={i.id}
                onPress={() => setFilter(i.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: on ? (c ? c.color : t.ink) : t.line, backgroundColor: on && !c ? t.ink : 'transparent' }}
              >
                {c && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />}
                <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: on ? (c ? c.color : t.bg) : t.inkSoft }}>{i.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* the unified timeline */}
      {state === 'seeded' && (
        <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.7, textTransform: 'uppercase', color: t.inkFaint, marginTop: 26, marginBottom: 16, marginLeft: 4 }}>
          Cosmo has been keeping track
        </Text>
      )}
      <View style={{ marginTop: state === 'seeded' ? 0 : 22 }}>
        {shown.map((row, i) => {
          const idn = row.identityId ? find(row.identityId) : null;
          const c = idn ? colorsFor(idn) : null;
          const linked = row.sessionId ? sessionById[row.sessionId] : null;
          return (
            <Row
              key={row.id || row.key || i}
              row={row}
              t={t}
              idn={idn}
              c={c}
              sessionMins={linked ? linked.mins : null}
              last={i === shown.length - 1}
            />
          );
        })}
        {shown.length === 0 && (
          <Text style={{ fontSize: 14.5, color: t.inkFaint, fontFamily: sans(500), textAlign: 'center', paddingVertical: 24 }}>
            Nothing here for this identity yet.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
