import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request } from '../../lib/api';
import { useShopper } from '../../lib/store';
import { EmailPreferences } from '../../components/EmailPreferences';
import { useIntroduction } from '../../components/Introduction';
import { Button, colors, Heading, s, Screen } from '../../components/ui';
function confirm(title: string, detail: string, action: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${detail}`)) action(); }
  else Alert.alert(title, detail, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: 'destructive', onPress: action }]);
}
export default function ProfileScreen() { const { session } = useShopper(); return <ProfileContent key={session?.user.id || 'guest'}/>; }
function ProfileContent() {
  const revisitIntroduction = useIntroduction();
  const { state, session, syncStatus, retrySync, update, consent, setConsent, clearHistory, signOut } = useShopper();
  const [draftName, setName] = useState<string>(); const [draftPreferences, setPreferences] = useState<string>(); const name = draftName ?? state.profile.name; const preferences = draftPreferences ?? state.profile.preferences; const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  async function deleteAccount() {
    if (!session) return; setDeleting(true); setError('');
    try { await request('/account', { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }); await AsyncStorage.removeItem(`arviva.v1.${session.user.id}`); await signOut(); setName(''); setPreferences(''); setMessage('Your account has been deleted.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete account.'); } finally { setDeleting(false); }
  }
  return <Screen name="profile"><Heading eyebrow="A home that feels like you" title={session ? 'Your Arviva space.' : 'Make yourself at home.'}/>
    <View style={s.panel}><Text style={s.sectionTitle}>{session ? session.user.email : 'You’re exploring as a guest'}</Text><Text style={[s.body, { marginVertical: 12 }]}>{session ? 'Your favorites and conversations follow you.' : 'Chat, browse and save freely. Sign in whenever you want to sync across devices.'}</Text>{!session && <Button onPress={() => router.push('/sign-in')}>Sign in with email</Button>}<Pressable onPress={retrySync}><Text style={[s.small, { marginTop: 12 }]}>{syncStatus}</Text></Pressable></View>
    <Button secondary style={{ marginBottom: 20 }} onPress={revisitIntroduction}>Revisit introduction</Button>
    <Text style={[s.sectionTitle, { marginVertical: 12 }]}>Your style & preferences</Text><Text style={[s.small, { marginBottom: 14 }]}>Share your palette, preferred materials and the details that matter to you. Your companion will keep these in mind.</Text>
    <TextInput accessibilityLabel="Preferred name" placeholder="What should we call you?" placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={80} style={[s.input, { marginBottom: 12 }]}/><TextInput accessibilityLabel="Shopping preferences" placeholder="Your aesthetic, color palette, preferred materials, rooms and budget…" placeholderTextColor={colors.muted} multiline value={preferences} onChangeText={setPreferences} maxLength={1200} style={[s.input, { height: 130, textAlignVertical: 'top' }]}/>
    <Button secondary style={{ marginTop: 12, marginBottom: 20 }} onPress={() => { update(s => ({ ...s, profile: { name: name.trim(), preferences: preferences.trim(), updatedAt: Date.now() } })); setName(undefined); setPreferences(undefined); setMessage('Preferences saved.'); }}>Save preferences</Button>
    <View style={s.panel}><View style={[s.row, { justifyContent: 'space-between' }]}><Text style={[s.sectionTitle, { fontSize: 21 }]}>Help improve Arviva</Text><Switch accessibilityLabel="Share anonymous usage analytics" value={consent} onValueChange={setConsent} trackColor={{ true: colors.accent }}/></View><Text style={[s.small, { marginTop: 10 }]}>Share product interactions and app performance events. Analytics uses an internal ID and excludes your raw chats, email and payment information. Session recording is disabled.</Text></View>
    <EmailPreferences/>
    <Text style={[s.sectionTitle, { marginVertical: 14 }]}>Recently viewed</Text>{Object.values(state.viewed).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5).map(({ product }) => <Pressable key={product.id} onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line }}><Text style={s.body}>{product.title} ↗</Text></Pressable>)}{!Object.keys(state.viewed).length && <Text style={s.small}>Pieces you explore will appear here.</Text>}
    <View style={s.divider}/><Text style={s.sectionTitle}>Privacy & account</Text><Text style={[s.small, { marginVertical: 15 }]}>Conversations are sent to Arviva’s shopping service to answer your requests. If AI is configured, recent messages, photos you attach, preferences, and a short summary of saved and viewed pieces are shared with its provider. Merchant checkout happens outside Arviva.</Text>
    <Button secondary onPress={() => confirm('Clear shopping history?', 'This clears conversations and recently viewed pieces. Favorites and your bag stay saved.', () => { clearHistory(); setMessage('Shopping history cleared.'); })}>Clear shopping history</Button>
    {session && <><Button secondary style={{ marginTop: 12 }} onPress={() => { void signOut().catch(e => setError(e.message)); }}>Sign out</Button><Button secondary disabled={deleting} style={{ marginTop: 12 }} onPress={() => confirm('Delete your account?', 'Your Arviva account and synced shopping data will be permanently deleted. Merchant accounts and orders are managed separately.', () => void deleteAccount())}>{deleting ? 'Deleting…' : 'Delete account & data'}</Button></>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[s.body, { marginTop: 15 }]}>{message}</Text>}{!!error && <Text style={s.error}>{error}</Text>}
    <View style={s.divider}/>{[['Privacy policy', 'privacy'], ['Terms of service', 'terms'], ['Support', 'support']].map(([label, path]) => <Pressable key={path} style={{ paddingVertical: 12 }} onPress={() => { void Linking.openURL(`https://www.arviva.space/${path}`).catch(() => setError('Could not open this page.')); }}><Text style={s.body}>{label} ↗</Text></Pressable>)}<Text style={[s.small, { marginTop: 24 }]}>Arviva Space · By Cedari AI{ '\n' }Version {Application.nativeApplicationVersion || Constants.expoConfig?.version || '0.1.1'}</Text>
  </Screen>;
}
