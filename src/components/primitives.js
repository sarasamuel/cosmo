/* Shared styled primitives (Card, Button, Pill, Chip, Glyph, Eyebrow, etc.)
   ported from the CSS component classes in styles.css. Each reads the active
   theme for colors. */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../store/Store';
import { serif, sans } from '../theme/fonts';

// True when children are renderable as plain text (a string/number, or an array
// of only strings/numbers) — i.e. they must be wrapped in <Text>. JSX turns
// `Log {mins} minutes` into the array ['Log ', 30, ' minutes'], which would
// otherwise render bare strings inside a Pressable/View and crash.
const isTextNode = (c) => typeof c === 'string' || typeof c === 'number';
function allText(children) {
  return isTextNode(children) || (Array.isArray(children) && children.every(isTextNode));
}

export function Card({ style, children, glow, ...rest }) {
  const { t } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: t.radii.lg,
        },
        t.shadow.sm,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

/* Primary / soft / ghost buttons. */
export function Button({ variant = 'primary', style, textStyle, children, disabled, onPress, ...rest }) {
  const { t } = useTheme();
  const palette = {
    primary: { bg: t.ink, fg: t.bg, border: 'transparent', shadow: t.shadow.md },
    soft: { bg: t.surface2, fg: t.ink, border: t.line, shadow: null },
    ghost: { bg: 'transparent', fg: t.inkSoft, border: 'transparent', shadow: null },
  }[variant];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'soft' ? 1 : 0,
          borderRadius: 999,
          paddingVertical: 18,
          paddingHorizontal: 30,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        palette.shadow,
        style,
      ]}
      {...rest}
    >
      {allText(children) ? (
        <Text style={[{ color: palette.fg, fontFamily: sans(600), fontSize: 18 }, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

/* Small pill button/tag. */
export function Pill({ style, textStyle, children, onPress, bg, color, ...rest }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: bg || t.surface2,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
        style,
      ]}
      {...rest}
    >
      {allText(children) ? (
        <Text style={[{ color: color || t.ink, fontFamily: sans(700), fontSize: 13 }, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

/* Rounded selectable chip. */
export function Chip({ style, textStyle, children, onPress, selected, bg, color, ...rest }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: selected ? 'transparent' : t.line,
          backgroundColor: bg || t.surface,
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 18,
          transform: [{ scale: pressed ? 0.97 : selected ? 1.08 : 1 }],
        },
        selected ? t.shadow.md : null,
        style,
      ]}
      {...rest}
    >
      {allText(children) ? (
        <Text style={[{ color: color || t.ink, fontFamily: sans(600), fontSize: 16 }, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

/* Colored disc with a serif initial / glyph. */
export function Glyph({ char, size = 38, fontSize, color, style, opacity }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: opacity == null ? 1 : opacity,
        },
        style,
      ]}
    >
      <Text style={{ color: '#fff', fontFamily: serif(500), fontSize: fontSize || size * 0.47, lineHeight: (fontSize || size * 0.47) * 1.1 }}>
        {char}
      </Text>
    </View>
  );
}

export function Eyebrow({ children, style }) {
  const { t } = useTheme();
  return (
    <Text style={[{ fontSize: 13, fontFamily: sans(600), letterSpacing: 2.1, color: t.inkFaint, textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children, style }) {
  const { t } = useTheme();
  return (
    <Text style={[{ fontSize: 14, fontFamily: sans(700), letterSpacing: 0.3, color: t.inkSoft }, style]}>{children}</Text>
  );
}

export const dotStyle = (size, color) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  backgroundColor: color,
});

export const styles = StyleSheet.create({});
