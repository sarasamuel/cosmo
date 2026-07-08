/* Settings — pushed from the You-tab gear. Holds account (name + cloud backup),
   appearance, notifications, and data controls that used to live inline on the
   You tab. Everything here is wired to the real store. */
import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, Switch, TextInput, Alert, Keyboard } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { Card, SectionTitle, Pill } from '../components/primitives';
import Icon from '../components/Icon';
import { useScreenPad } from '../lib/layout';
import { fmtAgo } from '../data/data';
import { serif, sans } from '../theme/fonts';

const APP_VERSION = 'v1.0.0';

const fmtTime = (h, m) => {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const TIME_PRESETS = [{ h: 20, m: 0 }, { h: 21, m: 0 }, { h: 22, m: 0 }];

export default function Settings({ onBack }) {
  const { t } = useTheme();
  const {
    userName, setUserName, theme, setTheme, reminder, setReminderEnabled, setReminderTime, remindersOn, setRemindersOn, coachStyle, setCoachStyle,
    session, syncStatus, lastSyncedAt, openBackup, signOut, exportData, deleteAccount, restart,
  } = useStore();
  const pad = useScreenPad();
  const [nameInput, setNameInput] = useState(userName || '');
  const nameDirty = nameInput.trim() !== (userName || '').trim();
  const saveName = () => { setUserName(nameInput); Keyboard.dismiss(); };

  const onExport = async () => {
    const res = await exportData();
    if (!res.ok && res.error) Alert.alert('Couldn’t export', res.error);
  };
  const onDelete = () => {
    Alert.alert(
      'Delete account & data?',
      session
        ? 'This permanently deletes your cloud account and erases all Cosmo data on this device. This cannot be undone.'
        : 'This erases all Cosmo data on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteAccount();
            if (!res.ok) Alert.alert('Couldn’t delete', res.error || 'Please try again.');
          },
        },
      ],
    );
  };

  // cloud-backup status line + dot color
  const failed = session && syncStatus === 'error';
  const syncing = session && syncStatus === 'syncing';
  const dotBg = !session ? t.surface2 : failed ? t.warn : t.good;
  const backupStatus = !session
    ? 'Save your progress to a new phone'
    : failed ? 'Backup failed — will retry'
    : syncing ? 'Syncing…'
    : `Backed up${lastSyncedAt ? ` · ${fmtAgo(lastSyncedAt)}` : ''}`;

  return (
    <View style={{ flex: 1 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 6, paddingBottom: 10 }}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="chevron" size={20} stroke={2.2} color={t.inkSoft} />
          </View>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontFamily: sans(700), color: t.ink, marginRight: 42 }}>Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 6, paddingBottom: 44 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* account */}
        <SectionTitle style={{ marginBottom: 12 }}>Account</SectionTitle>
        <Text style={{ fontSize: 12.5, fontFamily: sans(700), letterSpacing: 0.4, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 8, marginLeft: 2 }}>Name</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            onSubmitEditing={saveName}
            returnKeyType="done"
            placeholder="Your name"
            placeholderTextColor={t.inkFaint}
            style={{ flex: 1, borderWidth: 1, borderColor: nameDirty ? t.ink : t.line, borderRadius: t.radii.md, paddingHorizontal: 18, paddingVertical: 15, fontSize: 16, fontFamily: sans(500), color: t.ink, backgroundColor: t.surface }}
          />
          {nameDirty && (
            <Pill bg={t.ink} onPress={saveName} style={{ paddingHorizontal: 20, paddingVertical: 15 }}>
              <Text style={{ color: t.bg, fontFamily: sans(700), fontSize: 14.5 }}>Save</Text>
            </Pill>
          )}
        </View>

        {/* Cloud backup — temporarily disabled. To restore, un-comment this Card.
        <Card style={{ marginTop: 14, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: dotBg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={!session ? 'sparkle' : failed ? 'clock' : 'check'} size={18} stroke={2.4} color={session ? '#fff' : t.inkSoft} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>Cloud backup</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, color: failed ? t.warn : t.inkSoft, fontFamily: sans(600) }}>
              {backupStatus}{session && !failed && !syncing && session.user?.email ? ' · ' + session.user.email : ''}
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
        */}

        {/* appearance */}
        <SectionTitle style={{ marginTop: 26, marginBottom: 12 }}>Appearance</SectionTitle>
        <Card style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme === 'dark' ? t.id.writer.color : t.id.painter.color, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} stroke={2} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>Theme</Text>
            <Text style={{ fontSize: 13, color: t.inkSoft, fontFamily: sans(600) }}>{theme === 'dark' ? 'Deep space' : 'Celestial dawn'}</Text>
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 999, padding: 5 }}>
            {[{ v: 'light', icon: 'sun', label: 'Light' }, { v: 'dark', icon: 'moon', label: 'Dark' }].map((o) => {
              const on = theme === o.v;
              return (
                <Pressable
                  key={o.v}
                  onPress={() => setTheme(o.v)}
                  style={[{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: on ? t.surface : 'transparent' }, on ? t.shadow.sm : null]}
                >
                  <Icon name={o.icon} size={15} stroke={2} color={on ? t.ink : t.inkSoft} />
                  <Text style={{ fontSize: 15, fontFamily: sans(600), color: on ? t.ink : t.inkSoft }}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* notifications */}
        <SectionTitle style={{ marginTop: 26, marginBottom: 12 }}>Notifications</SectionTitle>

        {/* one master switch governs ALL notifications; the nightly check-in is a
            time choice underneath it (with "Off"), not a second on/off toggle */}
        <Card style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: remindersOn ? t.id.relax.color : t.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bell" size={18} stroke={2} color={remindersOn ? '#fff' : t.inkSoft} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.ink }}>Reminders</Text>
              <Text style={{ fontSize: 13, color: t.inkSoft, fontFamily: sans(600) }}>Nudges 30 min before scheduled sessions, plus an optional nightly check-in</Text>
            </View>
            <Switch value={remindersOn} onValueChange={setRemindersOn} trackColor={{ false: t.surface3, true: t.id.relax.color }} thumbColor="#fff" />
          </View>
          {remindersOn && (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.line2 }}>
              <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.inkSoft, marginBottom: 12 }}>Nightly check-in</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {/* "Off" disables just the nightly; session reminders stay on */}
                <Pressable
                  onPress={() => setReminderEnabled(false)}
                  style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: !reminder.enabled ? 'transparent' : t.line, backgroundColor: !reminder.enabled ? t.ink : t.surface2 }}
                >
                  <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: !reminder.enabled ? t.bg : t.inkSoft }}>Off</Text>
                </Pressable>
                {TIME_PRESETS.map((p) => {
                  const on = reminder.enabled && reminder.hour === p.h && reminder.minute === p.m;
                  return (
                    <Pressable
                      key={`${p.h}:${p.m}`}
                      onPress={() => setReminderTime(p.h, p.m)}
                      style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: on ? 'transparent' : t.line, backgroundColor: on ? t.ink : t.surface2 }}
                    >
                      <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: on ? t.bg : t.inkSoft }}>{fmtTime(p.h, p.m)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* coaching style — how the notifications speak, and how often */}
              <Text style={{ fontSize: 13, fontFamily: sans(700), color: t.inkSoft, marginTop: 18, marginBottom: 12 }}>Coaching style</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[['gentle', 'Gentle'], ['drill', 'Drill Sergeant']].map(([key, label]) => {
                  const on = coachStyle === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setCoachStyle(key)}
                      style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: on ? 'transparent' : t.line, backgroundColor: on ? t.ink : t.surface2 }}
                    >
                      <Text style={{ fontSize: 13.5, fontFamily: sans(700), color: on ? t.bg : t.inkSoft }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 12.5, color: t.inkFaint, fontFamily: sans(600), marginTop: 10, lineHeight: 18 }}>
                {coachStyle === 'drill'
                  ? 'Firmer voice, more often: nudges when an identity goes 3 days untended, a second ping when sessions start, and a nightly that only fires on days with nothing logged.'
                  : 'Soft nudges on your schedule. Nothing chases you.'}
              </Text>
            </View>
          )}
        </Card>

        {/* data & privacy */}
        <SectionTitle style={{ marginTop: 26, marginBottom: 12 }}>Data</SectionTitle>
        <Pressable onPress={onExport} style={({ pressed }) => ({ paddingVertical: 14, alignItems: 'center', borderRadius: t.radii.md, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 15.5, fontFamily: sans(600), color: t.ink }}>Export my data</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={({ pressed }) => ({ marginTop: 10, paddingVertical: 14, alignItems: 'center', borderRadius: t.radii.md, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 15.5, fontFamily: sans(700), color: t.warn }}>Delete account &amp; data</Text>
        </Pressable>

        {/* general */}
        <Pressable onPress={() => { onBack(); restart(); }} style={({ pressed }) => ({ marginTop: 26, paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.6 : 1, flexDirection: 'row', justifyContent: 'center', gap: 10 })}>
          <Icon name="sparkle" size={18} color={t.inkSoft} />
          <Text style={{ fontSize: 16, fontFamily: sans(600), color: t.inkSoft }}>Replay the intro</Text>
        </Pressable>

        <Text style={{ textAlign: 'center', fontSize: 12.5, fontFamily: sans(600), color: t.inkFaint, marginTop: 18 }}>Cosmo · {APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}
