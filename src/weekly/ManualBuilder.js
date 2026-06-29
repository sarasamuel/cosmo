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
import { blankWeek, makeSession, sortDay, placeSession, clockLabelHM } from '../lib/schedule';
import TimePicker from './TimePicker';
import AddSessionSheet from './AddSessionSheet';
import { serif, sans } from '../theme/fonts';

export default function ManualBuilder({ onBack }) {
  const { t, colorsFor } = useTheme();
  const { identities, commitSchedule } = useStore();
  const pad = useScreenPad();
  const byId = Object.fromEntries(identities.map((i) => [i.id, i]));

  const [week, setWeek] = useState(() => blankWeek(weekStartMs()));
  const [addDay, setAddDay] = useState(null); // day index a new session is being added to
  const [editing, setEditing] = useState(null); // `${dayIdx}:${sessIdx}` being edited
  const [pending, setPending] = useState(null); // { toDay, hour, min } staged until "Enter"
  const openEdit = (key, di, s) => { setEditing(key); setPending({ toDay: di, hour: s.hour, min: s.min || 0 }); };
  const closeEdit = () => { setEditing(null); setPending(null); };

  const allSessions = week.flatMap((d) => (d.rest ? [] : d.sessions));
  const total = allSessions.reduce((s, x) => s + x.mins, 0);
  const usedIds = [...new Set(allSessions.map((s) => s.identityId))];

  const toggleRest = (di) => setWeek((w) => w.map((d, i) => (i !== di ? d : { ...d, rest: !d.rest, sessions: d.rest ? d.sessions : [] })));
  const removeSess = (di, si) => setWeek((w) => w.map((d, i) => (i !== di ? d : { ...d, sessions: d.sessions.filter((_, k) => k !== si) })));
  const addSessionToDay = (di, idn, time, mins) => setWeek((w) => w.map((d, i) => (i !== di ? d : { ...d, rest: false, sessions: sortDay([...d.sessions, makeSession(idn, time, mins)]) })));

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
                  const key = `${di}:${si}`; const open = editing === key;
                  return (
                    <View key={si}>
                      <Pressable
                        onPress={() => (open ? closeEdit() : openEdit(key, di, s))}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: t.radii.md, backgroundColor: c.soft, borderWidth: 1, borderColor: open ? c.color : 'transparent' }}
                      >
                        {idn && <Glyph char={idn.glyph} size={30} fontSize={14} color={c.color} />}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontSize: 14.5, fontFamily: sans(700), color: t.ink }}>{idn ? idn.name : 'Session'}</Text>
                          <Text style={{ fontSize: 12, fontFamily: sans(600), color: t.inkSoft }}>{s.time} · {fmtMins(s.mins)}</Text>
                        </View>
                        <Icon name="clock" size={15} stroke={2} color={c.color} />
                      </Pressable>
                      {open && pending && (
                        <View style={{ marginTop: 10, marginLeft: 4, gap: 10 }}>
                          {/* move to a different day */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={{ width: 34, fontSize: 12, fontFamily: sans(700), color: t.inkFaint }}>Day</Text>
                            {week.map((dd, dj) => {
                              const sel = pending.toDay === dj;
                              return (
                                <Pressable key={dj} disabled={dd.rest} onPress={() => setPending((p) => ({ ...p, toDay: dj }))} style={{ width: 34, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: sel ? c.color : t.line, backgroundColor: sel ? c.soft : t.surface2, opacity: dd.rest ? 0.35 : 1 }}>
                                  <Text style={{ fontSize: 12, fontFamily: sans(700), color: sel ? c.color : t.inkSoft }}>{dd.day.slice(0, 2)}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          {/* pick an exact time */}
                          <TimePicker initialHour={s.hour} initialMin={s.min || 0} tint={c.color} onChange={(h, m) => setPending((p) => ({ ...p, hour: h, min: m }))} />
                          {/* commit day + time together */}
                          <Pressable
                            onPress={() => { setWeek((w) => placeSession(w, di, si, pending.toDay, pending.hour, pending.min, {})); closeEdit(); }}
                            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999, backgroundColor: c.color, opacity: pressed ? 0.85 : 1 })}
                          >
                            <Icon name="check" size={15} stroke={2.4} color={t.bg} />
                            <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: t.bg }}>Enter</Text>
                            <Text style={{ fontSize: 13.5, fontFamily: serif(500), color: t.bg }}>{week[pending.toDay].day.slice(0, 3)} · {clockLabelHM(pending.hour, pending.min)}</Text>
                          </Pressable>
                          {/* remove from the week */}
                          <Pressable onPress={() => { removeSess(di, si); closeEdit(); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
                            <Icon name="archive" size={14} stroke={1.8} color={t.warn} />
                            <Text style={{ fontSize: 12.5, fontFamily: sans(700), color: t.warn }}>Remove from week</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
                <Pressable onPress={() => setAddDay(di)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: t.radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
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
      {addDay != null && (
        <AddSessionSheet
          dayLabel={`${week[addDay].day} ${week[addDay].date.split(' ')[1]}`}
          identities={identities}
          onAdd={(idn, time, mins) => { addSessionToDay(addDay, idn, time, mins); setAddDay(null); }}
          onClose={() => setAddDay(null)}
        />
      )}
    </View>
  );
}
