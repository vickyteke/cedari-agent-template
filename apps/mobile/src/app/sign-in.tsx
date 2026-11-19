import { styleToken } from "../../../../packages/config/src/theme.ts";
import { t } from "../../../../packages/config/src/copy.ts";
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
    if (!supabase) { setError(t("ui.f35d89772a")); return; }
    setBusy(true); setError('');
    try {
      if (!sent) {
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
        if (error) throw error; setSent(true); track('sign_in_started');
      } else {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
        if (error) throw error; track('sign_in_completed'); if (emailUpdates) { try { await request('/email-preferences', { method: 'POST', body: JSON.stringify({ welcome: true, weekly: true, consentVersion: '2026-11-09', source: 'sign_in' }) }); } catch { router.replace({ pathname: '/profile', params: { emailSetup: 'retry' } }); return; } } router.replace('/profile');
      }
    } catch (e) { setError(e instanceof Error ? e.message : t("ui.97dd307bf2")); } finally { setBusy(false); }
  }
  return <Screen name="sign_in"><Back title={t("ui.f80e3131b4")}/><View style={{ paddingTop: styleToken("sign-in.paddingTop.9f14025af0","paddingTop",35) }}><Heading eyebrow={t("ui.b59da14787")} title={t("ui.7dd2cd443f")}/><Text style={[s.body, { marginBottom: styleToken("sign-in.marginBottom.59e19706d5","marginBottom",28) }]}>{t("ui.8c98ecdc1d")}</Text>
    <Text style={[s.small, { marginBottom: styleToken("sign-in.marginBottom.2c624232cd","marginBottom",8) }]}>{t("ui.f2488fd4ef")}</Text><TextInput accessibilityLabel={t("ui.f2488fd4ef")} style={s.input} value={email} onChangeText={setEmail} editable={!sent && !busy} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder={t("ui.53e6cdc307")} placeholderTextColor={colors.muted}/>
    {sent && <><Text style={[s.body, { marginVertical: styleToken("sign-in.marginVertical.4ec9599fc2","marginVertical",18) }]}>{t("ui.3892dc9387")}{email}{t("ui.fb746eea08")}</Text><TextInput accessibilityLabel={t("ui.be420e2629")} style={s.input} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={8} placeholder={t("ui.3ee75029c7")} placeholderTextColor={colors.muted}/></>}
    {!sent && <View style={[s.row, { marginTop: styleToken("sign-in.marginTop.4ec9599fc2","marginTop",18), alignItems: 'flex-start' }]}><Switch accessibilityLabel={t("ui.2d03266365")} value={emailUpdates} onValueChange={setEmailUpdates}/><Text style={[s.small, { flex: 1 }]}>{t("ui.3a6d8b9674")}</Text></View>}
    {!!error && <Text style={s.error}>{error}</Text>}<Button style={{ marginTop: styleToken("sign-in.marginTop.4ec9599fc2","marginTop",18) }} disabled={busy || (sent ? code.length < 6 : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))} onPress={() => void submit()}>{busy ? t("ui.7ce83d4536") : sent ? t("ui.63e2e398aa") : t("ui.d6687d2b32")}</Button>
    {sent && <Button secondary style={{ marginTop: styleToken("sign-in.marginTop.6b51d431df","marginTop",12) }} onPress={() => { setSent(false); setCode(''); }}>{t("ui.5dfc237e62")}</Button>}<Button secondary style={{ marginTop: styleToken("sign-in.marginTop.6b51d431df","marginTop",12) }} onPress={() => router.back()}>{t("ui.511b700644")}</Button><Text style={[s.small, { marginTop: styleToken("sign-in.marginTop.b7a56873cd","marginTop",25) }]}>{t("ui.ef6d1611b5")}</Text>
  </View></Screen>;
}
