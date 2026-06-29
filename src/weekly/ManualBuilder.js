/* "Build it myself" — the manual fork of the scheduler. A blank week: tap a day
   to add a session (identity + time + length) via a bottom sheet, toggle a rest
   day, remove sessions. Commits a plan in the EXACT shape scheduleWeek returns,
   so it flows through the same commitSchedule path as the arranged week — no
   engine call. Reached from ForkGate's "Build it myself" card. */
import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Glyph, Button } from '../components/primitives';
import Icon from '../components/Icon';
import { useScreenPad } from '../lib/layout';
import { fmtMins, weekStartMs } from '../data/data';
import { blankWeek, makeSession, sortDay } from '../lib/schedule';
import TimePicker from './TimePicker';
import { serif, sans } from '../theme/fonts';

const LENGTHS = [15, 30, 45, 60, 90];

export default function ManualBuilder({ onBack }) {
  const { t, colorsFor } = useTheme();
  const { identities, commitSchedule } = useStore();
  const pad = useScreenPad();
  const byId = Object.fromEntries(identities.map((i) => [i.id, i]));

  const [week, setWeek] = useState(() => blankWeek(weekStartMs()));
  const [sheet, setSheet] = useState(null); // { dayIdx, id, time, mins }

  const allSessions = week.flatMap((d) => (d.rest ? [] : d.sessions));
  const total = allSessions.reduce((s, x) => s + x.mins, 0);
  const usedIds = [...new Set(allSessions.map((s) => s.identityId))];

  const toggleRest = (di) => setWeek((w) => w.map((d, i) => (i !== di ? d : { ...d, rest: !d.rest, sessions: d.rest ? d.sessions : [] })));
  const removeSess = (di, si) => setWeek((w) => w.map((d, i) => (i !== di ? d : { ...d, sessions: d.sessions.filter((_, k) => k !== si) })));
  const openSheet = (di) => setSheet({ dayIdx: di, id: null, time: 420, mins: 30 });
  const addSession = () => {
    const idn = byId[sheet.id]; if (!idn) return;
    setWeek((w) => w.map((d, i) => (i !== sheet.dayIdx ? d : { ...d, rest: false, sessions: sortDay([...d.sessions, makeSession(idn, sheet.time, sheet.mins)]) })));
    setSheet(null);
  };

  const sheetColor = sheet && sheet.id ? colorsFor(byId[sheet.id]).color : t.ink;

  return (
    <View style={{ flex: 1 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 6, paddingBottom: 10 }}>
        <Pressable onPress={onBack} hitSlop={10} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevron" size={20} stroke={2.2} color={t.inkSoft} /></View>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontFamily: sans(700), color: t.ink, marginRight: 42 }}>Build your week</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 15.5, lineHeight: 23, color: t.inkSoft, marginBottom: 8 }}>
          Start from a blank week. Tap a day to add a session — identity, time, and length. Place every session yourself.
        </Text>

        {week.map((d, di) => (
          <View key={d.day} style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.ink }}>{d.day}</Text>
              <Text style={{ fontSize: 12, fontFamily: sans(600), color: t.inkFaint, marginLeft: 6 }}>{d.date.split(' ')[1]}</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => toggleRest(di)} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: d.rest ? t.inkFaint : t.line, backgroundColor: d.rest ? t.surface3 : t.surface }}>
                <Icon name="moon" size={16} stroke={2} color={d.rest ? t.inkSoft : t.inkFaint} />
              </Pressable>
            </View>

            {d.rest ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: t.radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line }}>
                <Icon name="moon" size={16} stroke={2} color={t.inkFaint} />
                <Text style={{ fontSize: 14, fontFamily: sans(600), color: t.inkFaint }}>Rest day — tap the moon to undo</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {d.sessions.map((s, si) => {
                  const idn = byId[s.identityId]; const c = idn ? colorsFor(idn) : { color: t.ink, soft: t.surface2 };
                  return (
                    <View key={si} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: t.radii.md, backgroundColor: c.soft }}>
                      {idn && <Glyph char={idn.glyph} size={30} fontSize={14} color={c.color} />}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14.5, fontFamily: sans(700), color: t.ink }}>{idn ? idn.name : 'Session'}</Text>
                        <Text style={{ fontSize: 12, fontFamily: sans(600), color: t.inkSoft }}>{s.time} · {fmtMins(s.mins)}</Text>
                      </View>
                      <Pressable onPress={() => removeSess(di, si)} hitSlop={8} style={({ pressed }) => ({ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
                        <Icon name="archive" size={15} stroke={1.8} color={t.inkFaint} />
                      </Pressable>
                    </View>
                  );
                })}
                <Pressable onPress={() => openSheet(di)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: t.radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
                  <Icon name="plus" size={16} stroke={2.2} color={t.inkSoft} />
                  <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: t.inkSoft }}>Add session</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* footer: live summary + commit */}
      <View style={{ paddingHorizontal: pad, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: t.line2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row' }}>
            {usedIds.length ? usedIds.map((id) => <View key={id} style={{ width: 9, height: 9, borderRadius: 5, marginRight: -3, backgroundColor: colorsFor(byId[id]).color, borderWidth: 1, borderColor: t.surface }} />)
              : <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.surface3 }} />}
          </View>
          <Text style={{ fontSize: 13, fontFamily: sans(600), color: t.inkSoft, marginLeft: 6 }}>
            {allSessions.length ? `${allSessions.length} session${allSessions.length > 1 ? 's' : ''} · ~${fmtMins(total)} this week` : 'Nothing scheduled yet'}
          </Text>
        </View>
        <Button onPress={() => commitSchedule(week, { manual: true })} disabled={!allSessions.length}>
          <Icon name="check" size={18} stroke={2.4} color={t.bg} />
          <Text style={{ marginLeft: 8, color: t.bg, fontFamily: sans(600), fontSize: 17 }}>Add to my week</Text>
        </Button>
      </View>

      {/* add-session sheet */}
      {sheet && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,16,12,0.4)' }} onPress={() => setSheet(null)} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.surface, borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40 }}>
            <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: t.line, alignSelf: 'center', marginBottom: 18 }} />
            <Text style={{ fontFamily: serif(500), fontSize: 22, color: t.ink, marginBottom: 16 }}>Add to {week[sheet.dayIdx].day} {week[sheet.dayIdx].date.split(' ')[1]}</Text>

            <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.4, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 8 }}>Identity</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {identities.map((idn) => {
                const on = sheet.id === idn.id; const c = colorsFor(idn);
                return (
                  <Pressable key={idn.id} onPress={() => setSheet((s) => ({ ...s, id: idn.id }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: on ? c.color : t.line, backgroundColor: on ? c.soft : t.surface }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.color }} />
                    <Text style={{ fontSize: 14, fontFamily: sans(600), color: on ? c.color : t.ink }}>{idn.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.4, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 8 }}>Time</Text>
            <View style={{ marginBottom: 18 }}>
              <TimePicker initialHour={Math.floor(sheet.time / 60)} initialMin={sheet.time % 60} tint={sheetColor} onChange={(h, m) => setSheet((s) => ({ ...s, time: h * 60 + m }))} />
            </View>

            <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.4, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 8 }}>Length</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22 }}>
              {LENGTHS.map((l) => {
                const on = sheet.mins === l;
                return (
                  <Pressable key={l} onPress={() => setSheet((s) => ({ ...s, mins: l }))} style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: t.radii.sm, borderWidth: 1, borderColor: on ? sheetColor : t.line, backgroundColor: on ? t.surface2 : t.surface }}>
                    <Text style={{ fontSize: 14, fontFamily: sans(on ? 700 : 600), color: on ? sheetColor : t.inkSoft }}>{l}m</Text>
                  </Pressable>
                );
              })}
            </View>

            <Button onPress={addSession} disabled={!sheet.id} style={sheet.id ? { backgroundColor: sheetColor } : undefined}>
              <Icon name="check" size={18} stroke={2.4} color={t.bg} />
              <Text style={{ marginLeft: 8, color: t.bg, fontFamily: sans(600), fontSize: 16 }}>Add session</Text>
            </Button>
            <Pressable onPress={() => setSheet(null)} hitSlop={8} style={({ pressed }) => ({ alignSelf: 'center', marginTop: 12, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 14.5, fontFamily: sans(600), color: t.inkFaint }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
