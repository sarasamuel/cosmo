import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/* Tracks the on-screen keyboard height (0 when hidden). Bottom sheets are
   pinned to bottom: 0, so a KeyboardAvoidingView can't lift them — instead we
   add the returned height as marginBottom so the sheet rests on the keyboard
   and its text inputs stay visible. */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => setHeight(e.endCoordinates?.height ?? 0);
    const onHide = () => setHeight(0);
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  return height;
}
