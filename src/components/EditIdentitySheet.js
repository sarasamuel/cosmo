/* "Edit name & color" bottom sheet, opened from an identity's Detail screen.
   Renames the identity and/or recolors it by picking a hue (a custom hue
   overrides the canonical palette). Mirrors the slide-up chrome of LogSheet /
   AddIdentitySheet. A local `subject` copy is retained through the close
   animation so the sheet doesn't blank out when `editing` clears. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useStore, useTheme } from '../store/Store';
import { oklch } from '../lib/color';
import { Glyph, Button } from './primitives';
import Icon from './Icon';
import { SPACING } from '../lib/layout';
import { serif, sans } from '../theme/fonts';

// a spread of distinct, well-separated hues to recolor with
const HUES = [12, 40, 68, 100, 135, 168, 200, 232, 262, 292, 320, 348];

export default function EditIdentitySheet() {
  const { t, colorsFor } = useTheme();
  const { editing, closeEditIdentity: onClose, editIdentity } = useStore();
  const open = !!editing;

  const [subject, setSubject] = useState(null); // retained during the close animation
  const [name, setName] = useState('');
  const [pickedHue, setPickedHue] = useState(null); // null = keep the current color
  const [mounted, setMounted] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setSubject(editing);
      setName(editing.name);
      setPickedHue(null);
      setMounted(true);
    }
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: open ? 420 : 320,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, slide]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !subject) return null;

  const current = colorsFor(subject);
  const previewColor = pickedHue == null ? current.color : oklch(0.7, 0.12, pickedHue);
  const canSave = name.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    editIdentity(subject.id, pickedHue == null ? { name } : { name, hue: pickedHue });
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 44 }}>
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
            maxHeight: '90%',
            backgroundColor: t.surface,
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            paddingHorizontal: SPACING.sheetPad,
            paddingTop: 16,
            paddingBottom: 44,
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }],
          },
          t.shadow.lg,
        ]}
      >
        <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: t.line, alignSelf: 'center', marginBottom: 22 }} />

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* live preview — glyph in the chosen color */}
          <View style={{ alignItems: 'center', marginBottom: 22 }}>
            <Glyph char={subject.glyph} size={64} fontSize={29} color={previewColor} />
          </View>

          <Text style={{ fontFamily: serif(500), fontSize: 27, color: t.ink, marginBottom: 4 }}>Edit identity</Text>
          <Text style={{ fontSize: 15, color: t.inkSoft, lineHeight: 22, marginBottom: 22 }}>
            How it appears in your cosmos. Your history stays the same.
          </Text>

          {/* name */}
          <Text style={{ fontSize: 12, fontFamily: sans(700), letterSpacing: 1.2, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 10 }}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={t.inkFaint}
            maxLength={28}
            returnKeyType="done"
            onSubmitEditing={save}
            style={{
              borderWidth: 1.5,
              borderColor: t.line,
              borderRadius: t.radii.md,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16.5,
              fontFamily: sans(600),
              color: t.ink,
              backgroundColor: t.surface,
              marginBottom: 24,
            }}
          />

          {/* color */}
          <Text style={{ fontSize: 12, fontFamily: sans(700), letterSpacing: 1.2, textTransform: 'uppercase', color: t.inkFaint, marginBottom: 12 }}>Color</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
            {HUES.map((h) => {
              const col = oklch(0.7, 0.12, h);
              const on = pickedHue === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => setPickedHue(h)}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: col, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 3 : 0, borderColor: t.ink }}
                >
                  {on && <Icon name="check" size={18} stroke={2.8} color="#fff" />}
                </Pressable>
              );
            })}
          </View>

          <Button onPress={save} disabled={!canSave} style={{ backgroundColor: previewColor }} textStyle={{ color: '#fff' }}>
            Save changes
          </Button>
          <Button variant="ghost" onPress={onClose} style={{ marginTop: 6 }}>
            Cancel
          </Button>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
