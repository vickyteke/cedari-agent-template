import { useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/auth';
import { request } from '../lib/api';
import { track } from '../lib/analytics';
import { Back, Button, colors, Heading, s, Screen } from '../components/ui';
export default function SignInScreen() {
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    if (!supabase) { setError('Email sign-in is not connected yet. You can keep shopping as a guest.'); return; }
    setBusy(true); setError('');
    try {
      if (!sent) {
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
        if (error) throw error; setSent(true); track('sign_in_started');
      } else {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
        if (error) throw error; track('sign_in_completed'); if (emailUpdates) { try { await request('/email-preferences', { method: 'POST', body: JSON.stringify({ welcome: true, weekly: true, consentVersion: '2026-11-09', source: 'sign_in' }) }); } catch { router.replace({ pathname: '/profile', params: { emailSetup: 'retry' } }); return; } } router.replace('/profile');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); } finally { setBusy(false); }
  }
  return <Screen name="sign_in"><Back title="Your Arviva account"/><View style={{ paddingTop: 35 }}><Heading eyebrow="A home, distinctly yours" title="Your personal edit, wherever you are."/><Text style={[s.body, { marginBottom: 28 }]}>Sign up or sign in with an email code—no password needed. Save conversations, sync favorites, and keep your shopping preferences in one place. Your guest favorites and conversations will join your account.</Text>
    <Text style={[s.small, { marginBottom: 8 }]}>Email address</Text><TextInput accessibilityLabel="Email address" style={s.input} value={email} onChangeText={setEmail} editable={!sent && !busy} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" placeholderTextColor={colors.muted}/>
    {sent && <><Text style={[s.body, { marginVertical: 18 }]}>Enter the code sent to {email}. Check your spam folder too.</Text><TextInput accessibilityLabel="Email verification code" style={s.input} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={8} placeholder="Verification code" placeholderTextColor={colors.muted}/></>}
    {!sent && <View style={[s.row, { marginTop: 18, alignItems: 'flex-start' }]}><Switch accessibilityLabel="Email me a welcome guide and weekly personal edits, optional" value={emailUpdates} onValueChange={setEmailUpdates}/><Text style={[s.small, { flex: 1 }]}>Email me a welcome guide and weekly personal edits. Optional; unsubscribe anytime. This is separate from analytics consent.</Text></View>}
    {!!error && <Text style={s.error}>{error}</Text>}<Button style={{ marginTop: 18 }} disabled={busy || (sent ? code.length < 6 : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))} onPress={() => void submit()}>{busy ? 'One moment…' : sent ? 'Verify & sign in' : 'Email me a sign-in code'}</Button>
    {sent && <Button secondary style={{ marginTop: 12 }} onPress={() => { setSent(false); setCode(''); }}>Change email or request another code</Button>}<Button secondary style={{ marginTop: 12 }} onPress={() => router.back()}>Continue as a guest</Button><Text style={[s.small, { marginTop: 25 }]}>By continuing, you agree to Arviva Space’s terms and privacy policy, available under You.</Text>
  </View></Screen>;
}
