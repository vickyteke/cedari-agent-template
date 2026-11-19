import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { track } from '../lib/analytics';
import { introductionForStorage, introductionFromProfile, introductionPreferences, parseIntroduction, roomNames, styleNames, type Introduction } from '../lib/onboarding';
import { useShopper } from '../lib/store';
import { onboardingInterior } from '../lib/onboarding-art';
import { Button, colors, Logo, s, serif } from './ui';

const storageKey = 'arviva.introduction.v1';
const teal = '#193e3a';
const Revisit = createContext<() => void>(() => {});
export const useIntroduction = () => useContext(Revisit);
const titles = ['A home,\ndistinctly yours.', 'More possibilities.\nA thoughtful selection.', 'What feels like\nhome to you?', 'Your space.\nYour point of view.'];
const palettes = [['#c8b99e', '#f1e9db', '#68584c'], ['#b2b395', '#d7c7af', '#6b5845'], ['#aa7158', '#546a65', '#dab56e'], ['#e3dac9', '#7f8b87', '#514a40'], ['#e9e3db', '#9d7968', '#353c39']];

export function IntroductionProvider({ children }: { children: ReactNode }) {
  const { ready, state, update, setActiveChat } = useShopper();
  const [draft, setDraft] = useState<Introduction | null>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const writes = useRef(Promise.resolve());
  const edited = useRef(false);
  const profile = useRef(state.profile);
  useEffect(() => { profile.current = state.profile; }, [state.profile]);
  useEffect(() => {
    if (!ready || loaded) return;
    let alive = true;
    void AsyncStorage.getItem(storageKey).then(raw => {
      if (!alive) return;
      const next = (raw && parseIntroduction(raw)) || introductionFromProfile(profile.current);
      edited.current = next.edited === true;
      setDraft(next); setVisible(!next.completed); setLoaded(true);
    }).catch(() => { if (alive) { setDraft(introductionFromProfile(profile.current)); setLoaded(true); setVisible(true); } });
    return () => { alive = false; };
  }, [ready, loaded]);
  useEffect(() => {
    if (!loaded || !draft) return;
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify(introductionForStorage(draft))));
    void writes.current.catch(() => setError('Your introduction could not be saved. Please check device storage.'));
  }, [draft, loaded]);
  const currentStep = draft?.step;
  useEffect(() => { if (visible && currentStep !== undefined) track('onboarding_screen_viewed', { step: currentStep + 1 }); }, [visible, currentStep]);
  function change(values: Partial<Introduction>) { if ('name' in values || 'preferences' in values || 'styles' in values || 'rooms' in values) edited.current = true; const changed = edited.current; setDraft(previous => previous ? { ...previous, ...values, edited: changed } : previous); }
  function finish(skipped = false) {
    if (!draft) return;
    Keyboard.dismiss();
    if (edited.current) update(previous => ({ ...previous, profile: { name: draft.name.trim(), preferences: introductionPreferences(draft), updatedAt: Date.now() } }));
    change({ completed: true }); setVisible(false); setActiveChat(null); router.replace('/');
    track(skipped ? 'onboarding_skipped' : 'onboarding_completed', { step: draft.step + 1, styles_selected: draft.styles.length, rooms_selected: draft.rooms.length });
  }
  function toggle(field: 'styles' | 'rooms', value: string) { if (draft) change({ [field]: draft[field].includes(value) ? draft[field].filter(item => item !== value) : [...draft[field], value] }); }
  return <Revisit.Provider value={() => { edited.current = false; setDraft(introductionFromProfile(state.profile)); setError(''); setVisible(true); }}><View style={{ flex: 1 }} accessibilityElementsHidden={!loaded || visible} aria-hidden={!loaded || visible} importantForAccessibility={!loaded || visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
    <Modal visible={!loaded || (visible && !!draft)} animationType="none" presentationStyle="fullScreen" onRequestClose={() => finish(true)}><SafeAreaProvider>
      {!draft && <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}><Logo size={54}/></View>}
      {draft && <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.top}>{draft.step > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { Keyboard.dismiss(); change({ step: draft.step - 1 }); }} style={styles.backButton}><Text style={{ color: teal, fontSize: 30 }}>‹</Text></Pressable> : <View style={styles.backButton}/>}<View style={s.row}><Logo size={30}/><Text style={styles.wordmark}>arviva space</Text></View><Pressable accessibilityRole="button" onPress={() => finish(true)} style={styles.smallButton}><Text style={{ color: teal }}>Skip</Text></Pressable></View>
          <ScrollView key={draft.step} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
            {draft.step < 2 && <View style={[styles.hero, draft.step === 1 && { height: 245, borderRadius: 22 }]}>{onboardingInterior && <Image source={onboardingInterior} accessibilityLabel="An inspirational interior with warm natural materials and considered home details" resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}/>}<View style={styles.photoLabel}><Text style={styles.photoLabelText}>A LITTLE INSPIRATION. A WORLD OF POSSIBILITY.</Text></View></View>}
            <Text style={[s.eyebrow, { color: teal, marginTop: draft.step < 2 ? 26 : 18 }]}>{['WELCOME TO ARVIVA SPACE', 'YOUR PERSONAL HOME EDIT', 'FOLLOW YOUR INSTINCT', 'LET’S MAKE IT PERSONAL'][draft.step]}</Text>
            <Text accessibilityRole="header" style={styles.title}>{titles[draft.step]}</Text>
            {draft.step === 0 && <Text style={styles.body}>Beautiful spaces begin with you. Meet your personal home décor companion, here to help you find distinctive pieces and bring your vision to life.</Text>}
            {draft.step === 1 && <><Text style={styles.body}>We’re building a growing collection of thousands of home pieces, bringing more possibilities to your personal edit.</Text><View style={styles.edit}><Text style={[s.sectionTitle, { color: teal, fontSize: 23 }]}>A few exceptional finds. Chosen for you.</Text><Text style={[s.body, { marginTop: 10 }]}>Describe your vision or share a photo of your room. Arviva brings together complementary pieces from independent shops, with up to five thoughtful suggestions at a time.</Text></View><Text style={s.small}>Inspiration photography. Featured room pieces are not product listings.</Text></>}
            {draft.step === 2 && <><Text style={styles.body}>Choose the moods you’re drawn to. There’s no single style to get right.</Text><View style={styles.grid}>{styleNames.map((name, index) => <Pressable key={name} accessibilityRole="checkbox" aria-checked={draft.styles.includes(name)} accessibilityState={{ checked: draft.styles.includes(name) }} onPress={() => toggle('styles', name)} style={[styles.styleCard, draft.styles.includes(name) && { borderColor: teal, borderWidth: 2 }]}><View style={styles.palette}>{palettes[index].map(color => <View key={color} style={{ flex: 1, backgroundColor: color }}/>)}</View><Text style={styles.styleName}>{name}{draft.styles.includes(name) ? '  ✓' : ''}</Text></Pressable>)}</View><Pressable accessibilityRole="checkbox" aria-checked={!draft.styles.length} accessibilityState={{ checked: !draft.styles.length }} onPress={() => change({ styles: [] })} style={styles.smallButton}><Text style={{ color: teal }}>{!draft.styles.length ? '✓  ' : ''}Still exploring</Text></Pressable><Text style={[s.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Where shall we begin?</Text><View style={styles.chips}>{roomNames.map(room => <Pressable key={room} accessibilityRole="checkbox" aria-checked={draft.rooms.includes(room)} accessibilityState={{ checked: draft.rooms.includes(room) }} onPress={() => toggle('rooms', room)} style={[s.chip, draft.rooms.includes(room) && styles.selected]}><Text style={s.chipText}>{room}{draft.rooms.includes(room) ? '  ✓' : ''}</Text></Pressable>)}</View></>}
            {draft.step === 3 && <><Image source={onboardingInterior} accessibilityLabel="Warm natural textures and sculptural details for home inspiration" resizeMode="cover" style={{ width: '100%', height: 110, borderRadius: 18, marginBottom: 20 }}/><Text style={styles.body}>A few details help me make your discoveries feel more like you. Everything here is optional.</Text><Text style={styles.label}>What should I call you?</Text><TextInput accessibilityLabel="Your preferred name, optional" autoComplete="given-name" value={draft.name} onChangeText={name => change({ name })} maxLength={80} placeholder="Your first name" placeholderTextColor={colors.muted} style={s.input} returnKeyType="done" onSubmitEditing={Keyboard.dismiss}/><Text style={styles.label}>Describe the home you’re imagining.</Text><TextInput accessibilityLabel="Your aesthetic preferences, optional" multiline maxLength={900} value={draft.preferences} onChangeText={preferences => change({ preferences })} placeholder="Warm neutrals, natural wood, sculptural lighting, and a calm living room with character…" placeholderTextColor={colors.muted} style={[s.input, { minHeight: 140, textAlignVertical: 'top' }]}/><Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={[styles.smallButton, { alignSelf: 'flex-end' }]}><Text style={{ color: teal }}>Done typing</Text></Pressable><View style={styles.chips}>{draft.styles.map(name => <Pressable key={name} accessibilityRole="button" accessibilityLabel={`Remove ${name}`} onPress={() => toggle('styles', name)} style={[s.chip, styles.selected]}><Text style={s.chipText}>{name} ×</Text></Pressable>)}</View><Text style={[s.small, { marginTop: 20 }]}>Saved on this device. You can change your preferences in You at any time. No account needed.</Text></>}
            {!!error && <Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
          </ScrollView>
          <View pointerEvents="box-none" style={styles.footer}><View pointerEvents="none" accessibilityLabel={`Step ${draft.step + 1} of 4`} style={styles.dots}>{[0, 1, 2, 3].map(step => <View key={step} style={{ width: step === draft.step ? 25 : 6, height: 6, borderRadius: 3, backgroundColor: step === draft.step ? teal : colors.line }}/>)}</View><Button style={styles.continueButton} onPress={() => { Keyboard.dismiss(); if (draft.step === 3) finish(); else change({ step: draft.step + 1 }); }}>{['Find my inspiration', 'Make it personal', 'Continue', 'Explore my home edit'][draft.step]}</Button></View>
        </KeyboardAvoidingView>
      </SafeAreaView>}
    </SafeAreaProvider></Modal>
  </Revisit.Provider>;
}
const styles = StyleSheet.create({
  top: { paddingHorizontal: 24, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, wordmark: { fontFamily: serif, fontSize: 23, color: teal },
  content: { paddingHorizontal: 24, paddingBottom: 120, width: '100%', maxWidth: 680, alignSelf: 'center' }, hero: { height: 320, borderRadius: 160, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden', marginTop: 10, backgroundColor: '#d9d0be' },
  photoLabel: { position: 'absolute', bottom: 18, left: 18, right: 18, padding: 10, backgroundColor: 'rgba(25,62,58,0.85)', borderRadius: 12 }, photoLabelText: { color: '#fffaf0', fontSize: 9, letterSpacing: 1.5, textAlign: 'center', lineHeight: 15 },
  title: { fontFamily: serif, color: teal, fontSize: 38, letterSpacing: -1, lineHeight: 43, marginBottom: 16 }, body: { color: colors.muted, fontSize: 15, lineHeight: 25, marginBottom: 20 }, edit: { backgroundColor: '#ede7dc', padding: 22, borderRadius: 22, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, styleCard: { width: '47%', borderWidth: 1, borderColor: colors.line, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.white }, palette: { height: 78, flexDirection: 'row' }, styleName: { padding: 12, fontSize: 13, color: teal, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, selected: { borderColor: teal, backgroundColor: '#e6ece6' }, label: { color: teal, fontSize: 14, marginBottom: 10, marginTop: 16 },
  footer: { position: 'absolute', bottom: 0, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: 'transparent' }, continueButton: { backgroundColor: teal, width: '50%', minWidth: 168, maxWidth: '100%', alignSelf: 'center', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 12 }, backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 }, smallButton: { paddingHorizontal: 8, paddingVertical: 12, minHeight: 44 },
});
