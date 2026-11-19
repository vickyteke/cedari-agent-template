import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, Logo, s } from './ui';
import { waitRhyme } from '../lib/chat-wait';
import { track } from '../lib/analytics';

export function ChatWaiting({ turn, startedAt, status, streaming, replyStarted, conversationId }: { turn: string; startedAt: number; status: string; streaming: boolean; replyStarted: boolean; conversationId?: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [pulse] = useState(() => new Animated.Value(0));
  const reported = useRef(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const state = AppState.addEventListener('change', value => setForeground(value === 'active'));
    return () => { alive = false; motion.remove(); state.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion || !foreground || !focused) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1300, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1300, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); pulse.setValue(0); };
  }, [reduceMotion, foreground, focused, pulse]);
  useEffect(() => {
    if (!foreground || !focused) return;
    const tick = () => setElapsed(Math.max(0, Date.now() - startedAt));
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt, foreground, focused]);
  const rhyme = waitRhyme(turn, elapsed, replyStarted);
  useEffect(() => {
    if (!rhyme || !foreground || !focused || reported.current) return;
    reported.current = true;
    track('chat_wait_long', { conversation_id: conversationId || '', wait_ms: elapsed, presentation: 'home_rhyme' });
  }, [rhyme, foreground, focused, elapsed, conversationId]);
  return <View style={{ marginBottom: streaming ? 10 : 20 }}>
    <View style={[s.row, { marginBottom: 10 }]}>
      <Animated.View style={reduceMotion ? undefined : { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] }) }] }}><Logo size={30}/></Animated.View>
      <Text style={s.eyebrow}>Arviva</Text>
    </View>
    {!streaming && <Text accessibilityLiveRegion="polite" style={s.body}>{status}</Text>}
    {!streaming && rhyme && <View style={{ marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: colors.soft }}><Text style={[s.small, { color: colors.accent, marginBottom: 6 }]}>A considered detail</Text><Text style={{ color: colors.ink, fontSize: 14, lineHeight: 23, fontStyle: 'italic' }}>{rhyme}</Text></View>}
    {!streaming && !replyStarted && elapsed >= 25000 && <Text style={[s.small, { marginTop: 10 }]}>This is taking a little longer. I’m still here.</Text>}
  </View>;
}
