import { useCallback, useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';

export type RegisterEditorExit = (leave: () => void | Promise<void>) => () => void;

// Save/cancel must finish before a router or system-back action removes an editor.
export function useEditorExit() {
  const navigation = useNavigation();
  const leaveRef = useRef<(() => void | Promise<void>) | null>(null);
  const allowedRef = useRef(false);
  const registerExit: RegisterEditorExit = useCallback((leave) => {
    leaveRef.current = leave;
    return () => { if (leaveRef.current === leave) leaveRef.current = null; };
  }, []);
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (allowedRef.current || !leaveRef.current) return;
    event.preventDefault();
    void leaveRef.current();
  }), [navigation]);
  const navigate = useCallback((action: () => void) => {
    allowedRef.current = true;
    action();
  }, []);
  return { registerExit, navigate };
}
