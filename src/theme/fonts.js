/* Font families.
   The design uses Newsreader (serif: headlines, numeric readouts, with some
   italics) and Hanken Grotesk (sans: UI/body). With custom fonts in React
   Native the `fontWeight`/`fontStyle` props are unreliable — each weight/italic
   must be its own loaded family — so we expose explicit family names and small
   helpers that return the right `fontFamily`. */

// Import only the weights actually used (via subpaths) so the bundle ships 9
// font files instead of every weight of both families.
import { useFonts } from 'expo-font';
import { Newsreader_300Light } from '@expo-google-fonts/newsreader/300Light';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader/600SemiBold';
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader/400Regular_Italic';
import { Newsreader_500Medium_Italic } from '@expo-google-fonts/newsreader/500Medium_Italic';
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk/700Bold';

export const fontMap = {
  Newsreader_300Light,
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium_Italic,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
};

export function useAppFonts() {
  return useFonts(fontMap);
}

/* Serif (Newsreader). weight: 300|400|500|600 ; italic boolean. */
export function serif(weight = 400, italic = false) {
  if (italic) {
    return weight >= 500 ? 'Newsreader_500Medium_Italic' : 'Newsreader_400Regular_Italic';
  }
  if (weight <= 300) return 'Newsreader_300Light';
  if (weight >= 600) return 'Newsreader_600SemiBold';
  if (weight >= 500) return 'Newsreader_500Medium';
  return 'Newsreader_400Regular';
}

/* Sans (Hanken Grotesk). weight: 400|500|600|700. */
export function sans(weight = 400) {
  if (weight >= 700) return 'HankenGrotesk_700Bold';
  if (weight >= 600) return 'HankenGrotesk_600SemiBold';
  if (weight >= 500) return 'HankenGrotesk_500Medium';
  return 'HankenGrotesk_400Regular';
}

// Raw family-name constants for SVG <Text fontFamily> usage.
export const SERIF = 'Newsreader_500Medium';
export const SERIF_ITALIC = 'Newsreader_400Regular_Italic';
export const SANS = 'HankenGrotesk_600SemiBold';
