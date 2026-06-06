/* Inline SVG icon set, ported from components.jsx to react-native-svg. */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

const PATHS = {
  portfolio: (s) => (
    <G stroke="currentColor">
      <Circle cx="8" cy="8" r="3.2" />
      <Circle cx="16.5" cy="9.5" r="2.4" />
      <Circle cx="11" cy="16.5" r="2.8" />
      <Path d="M9.6 10.2l1.6 4M14.4 11.1l-2.2 3.3" />
    </G>
  ),
  insights: (
    <>
      <Path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 9.5l1 2.5-1 2.5-1-2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  reflect: <Path d="M17.5 14.5A6 6 0 0 1 9.5 6.5 6.5 6.5 0 1 0 17.5 14.5z" />,
  plus: <Path d="M12 6v12M6 12h12" />,
  sun: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </>
  ),
  moon: <Path d="M18 14.5A6.5 6.5 0 0 1 9.5 6 6.5 6.5 0 1 0 18 14.5z" />,
  chevron: <Path d="M9 6l6 6-6 6" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7" />,
  clock: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  flame: <Path d="M12 3c2.5 3 4.5 5 4.5 8.5A4.5 4.5 0 0 1 7.5 11.5C7.5 9.5 9 8 9 8s0 2.5 1.5 3c0-3 1.5-5 1.5-8z" />,
  arrow: <Path d="M5 12h14M13 6l6 6-6 6" />,
  bell: (
    <>
      <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 0 0 4 0" />
    </>
  ),
  sparkle: <Path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" />,
  calendar: (
    <>
      <Path d="M4 7.7a2.2 2.2 0 0 1 2.2-2.2h11.6A2.2 2.2 0 0 1 20 7.7V17.8A2.2 2.2 0 0 1 17.8 20H6.2A2.2 2.2 0 0 1 4 17.8z" />
      <Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
};

/* react-native-svg doesn't resolve `currentColor`, so we substitute the actual
   color into stroke/fill by cloning children. */
function applyColor(node, color) {
  if (Array.isArray(node)) {
    // map children, ensuring each cloned element carries a stable key
    return node.map((n, i) => {
      const c = applyColor(n, color);
      return React.isValidElement(c) ? React.cloneElement(c, { key: c.key != null ? c.key : i }) : c;
    });
  }
  if (!React.isValidElement(node)) return node;
  const props = {};
  if (node.props.stroke === 'currentColor' || node.props.stroke === undefined) {
    // leave undefined to inherit from parent Svg stroke
  }
  if (node.props.stroke === 'currentColor') props.stroke = color;
  if (node.props.fill === 'currentColor') props.fill = color;
  if (node.props.children) {
    return React.cloneElement(node, props, applyColor(node.props.children, color));
  }
  return Object.keys(props).length ? React.cloneElement(node, props) : node;
}

export default function Icon({ name, size = 24, stroke = 1.7, color = '#000' }) {
  let inner = PATHS[name];
  if (typeof inner === 'function') inner = inner(size);
  inner = applyColor(inner, color);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {inner}
    </Svg>
  );
}
