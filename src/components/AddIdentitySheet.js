/* "Add an identity" bottom sheet — a catalog chip menu (like onboarding step 1)
   plus a field to type your own. Multi-select; confirming adds them all with
   distinct colors. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, ScrollView, TextInput, useWindowDimensions } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { CATALOG, assignHue } from '../data/data';
import { oklch } from '../lib/color';
import { Button, Chip } from './primitives';
import Icon from './Icon';
import { serif, sans } from '../theme/fonts';

const RELAX_NAME = 'Relaxation Time'; // handled separately, never an "identity"

export default function AddIdentitySheet() {
  const { t } = useTheme();
  const { addOpen: open, identities, drift, relax, closeAdd: onClose, addIdentities: onCommit } = useStore();
  const { height } = useWindowDimensions();

  const [selected, setSelected] = useState([]);
  const [custom, setCustom] = useState('');
  const [mounted, setMounted] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setSelected([]);
      setCustom('');
      setMounted(true);
    }
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: open ? 420 : 320,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, slide]);

  if (!mounted) return null;

  const exists = (name) => identities.some((i) => i.name.toLowerCase() === name.toLowerCase());
  const available = CATALOG.filter((n) => n !== RELAX_NAME && !exists(n));
  const customSelected = selected.filter((n) => !CATALOG.includes(n));

  const toggle = (name) => setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
  const addCustom = () => {
    const n = custom.trim();
    if (n && !selected.includes(n) && !exists(n)) setSelected((s) => [...s, n]);
    setCustom('');
  };

  // preview colors: progressively assign the next distinct hue per selected name,
  // mirroring what the store will do on commit (same order → same colors).
  const colorByName = {};
  let acc = [...identities, drift, relax].map((x) => ({ hue: x.hue }));
  selected.forEach((nm) => {
    const h = assignHue(acc);
    acc = [...acc, { hue: h }];
    colorByName[nm] = oklch(0.7, 0.12, h);
  });

  const sheetMax = height * 0.9;

  const renderChip = (name) => {
    const on = selected.includes(name);
    const col = colorByName[name];
    return (
      <Chip key={name} selected={on} onPress={() => toggle(name)} bg={on ? col : undefined}>
        {on && <Icon name="check" size={15} stroke={2.6} color="#fff" />}
        <Text style={{ fontSize: 16, fontFamily: sans(600), color: on ? '#fff' : t.ink }}>{name}</Text>
      </Chip>
    );
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 43 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,16,12,0.4)', opacity: slide }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: sheetMax,
            backgroundColor: t.surface,
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            paddingHorizontal: 40,
            paddingTop: 16,
            paddingBottom: 44,
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [sheetMax + 60, 0] }) }],
          },
          t.shadow.lg,
        ]}
      >
        <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: t.line, alignSelf: 'center', marginBottom: 22 }} />

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: serif(500), fontSize: 27, color: t.ink, marginBottom: 4 }}>Add an identity</Text>
          <Text style={{ fontSize: 15, color: t.inkSoft, lineHeight: 22, marginBottom: 22 }}>
            Choose who else you want to tend to — or name your own.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {available.map(renderChip)}
            {customSelected.map(renderChip)}
          </View>

          {/* add your own */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              onSubmitEditing={addCustom}
              placeholder="Add your own…"
              placeholderTextColor={t.inkFaint}
              returnKeyType="done"
              style={{
                flex: 1,
                paddingVertical: 15,
                paddingHorizontal: 20,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: t.line,
                backgroundColor: t.surface,
                fontSize: 16,
                fontFamily: sans(400),
                color: t.ink,
              }}
            />
            <Button variant="soft" onPress={addCustom} style={{ paddingHorizontal: 24, paddingVertical: 15 }}>
              Add
            </Button>
          </View>

          <Button onPress={() => onCommit(selected)} disabled={selected.length === 0} style={{ marginTop: 24 }} textStyle={{ color: t.bg }}>
            {selected.length ? `Add ${selected.length} ${selected.length > 1 ? 'identities' : 'identity'}` : 'Choose at least one'}
          </Button>
          <Button variant="ghost" onPress={onClose} style={{ marginTop: 6 }}>
            Cancel
          </Button>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
