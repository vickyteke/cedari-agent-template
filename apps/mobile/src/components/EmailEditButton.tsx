import { styleToken } from "../../../../packages/config/src/theme.ts";
import { t } from "../../../../packages/config/src/copy.ts";
import { useRef, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { request } from '../lib/api';
import { useShopper } from '../lib/store';
import type { Product } from '../lib/model';
import { Button, s } from './ui';
export function EmailEditButton({products}:{products:Product[]}) {
 const {session}=useShopper();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');const requestId=useRef<string|null>(null);
 async function send(){
  if(!session){router.push('/sign-in');return;}
  const email=session.user.email;
  const confirmed=Platform.OS==='web'?window.confirm(t("dynamic.ed42688d72",{value0: String(email)})):await new Promise<boolean>(resolve=>Alert.alert(t("ui.74f4120183"),t("dynamic.c3e2f54f7b",{value0: String(email)}),[{text:t("ui.19766ed6cc"),style:'cancel',onPress:()=>resolve(false)},{text:t("ui.29c90d789a"),onPress:()=>resolve(true)}],{cancelable:true,onDismiss:()=>resolve(false)}));
  if(!confirmed)return;setBusy(true);setError('');
  try {requestId.current ||= Crypto.randomUUID(); const result=await request<{status:string}>('/email-edit',{method:'POST',body:JSON.stringify({productIds:products.slice(0,5).map(p=>p.id),requestId:requestId.current})});setMessage(result.status==='sent'?t("ui.ee61ce6395"):t("ui.aab556382a"));}
  catch(e){setError(e instanceof Error?e.message:t("ui.5ad6f4ef2a"));}finally{setBusy(false);}
 }
 return <View style={{alignSelf:'stretch',marginTop:styleToken("EmailEditButton.marginTop.8527a891e2","marginTop",14)}}><Button secondary disabled={busy||!!message} onPress={()=>void send()}>{busy?t("ui.e4a4223ae4"):session?t("ui.09ac4a79ca"):t("ui.71776c5dd3")}</Button>{!!message&&<Text accessibilityLiveRegion="polite" style={[s.small,{marginTop:styleToken("EmailEditButton.marginTop.2c624232cd","marginTop",8)}]}>{message}</Text>}{!!error&&<Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}</View>;
}
