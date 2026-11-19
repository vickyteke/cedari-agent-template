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
  const confirmed=Platform.OS==='web'?window.confirm(`Email these pieces to ${email}?`):await new Promise<boolean>(resolve=>Alert.alert('Email your personal edit?',`Send up to five pieces to ${email}. Your chat text and photos won’t be included.`,[{text:'Cancel',style:'cancel',onPress:()=>resolve(false)},{text:'Send edit',onPress:()=>resolve(true)}],{cancelable:true,onDismiss:()=>resolve(false)}));
  if(!confirmed)return;setBusy(true);setError('');
  try {requestId.current ||= Crypto.randomUUID(); const result=await request<{status:string}>('/email-edit',{method:'POST',body:JSON.stringify({productIds:products.slice(0,5).map(p=>p.id),requestId:requestId.current})});setMessage(result.status==='sent'?'Your personal edit is on its way.':'Your personal edit is queued.');}
  catch(e){setError(e instanceof Error?e.message:'Your edit could not be emailed.');}finally{setBusy(false);}
 }
 return <View style={{alignSelf:'stretch',marginTop:14}}><Button secondary disabled={busy||!!message} onPress={()=>void send()}>{busy?'Preparing your email…':session?'Email my edit':'Sign in to email my edit'}</Button>{!!message&&<Text accessibilityLiveRegion="polite" style={[s.small,{marginTop:8}]}>{message}</Text>}{!!error&&<Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}</View>;
}
