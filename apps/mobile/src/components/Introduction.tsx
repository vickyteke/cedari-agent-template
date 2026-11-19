import { styleToken } from "../../../../packages/config/src/theme.ts";
import { t } from "../../../../packages/config/src/copy.ts";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { agentConfig, storageNamespace } from '../../../../packages/config/src/public.ts';
import { migratePreferences, validateAnswers, type PreferenceAnswers } from '../../../../packages/config/src/preferences.ts';
import { assets } from '../../../../config/assets';
import { useShopper } from '../lib/store';
import { initialHref } from '../lib/navigation';
import { track } from '../lib/analytics';
import { PreferenceFields } from './PreferenceFields';
import { Button, colors, Logo, s } from './ui';

const Revisit=createContext<()=>void>(()=>{});
export const useIntroduction=()=>useContext(Revisit);
const config=agentConfig.onboarding;
const key=storageNamespace(agentConfig.id)+'.onboarding';
type Progress={completed:boolean;slideId?:string;answers:PreferenceAnswers;version:number};
export function IntroductionProvider({children}:{children:ReactNode}) {
 const {ready,state,update}=useShopper();
 const [progress,setProgress]=useState<Progress|null>(null);
 const [visible,setVisible]=useState(false);
 const [error,setError]=useState('');
 const profile=useRef(state.profile);
 const writes=useRef(Promise.resolve());
 useEffect(()=>{profile.current=state.profile;},[state.profile]);
 useEffect(()=>{
  if(!ready)return;
  let alive=true;
  void AsyncStorage.getItem(key).then(raw=>{
   const fallback={completed:false,answers:{},version:config.version};
   let stored:Progress=fallback;
   try {
    const parsed=raw?JSON.parse(raw):null;
    if(parsed&&typeof parsed.completed==='boolean') stored={...fallback,...parsed,answers:migratePreferences({answers:parsed.answers},agentConfig).answers};
   } catch { /* An invalid local draft restarts onboarding without changing the profile. */ }
   if(alive){setProgress(stored);setVisible(config.enabled&&!stored.completed);}
  }).catch(()=>{if(alive){setProgress({completed:false,answers:{},version:config.version});setVisible(config.enabled);}});
  return ()=>{alive=false;};
 },[ready]);
 useEffect(()=>{
  if(!progress)return;
  // Completed answers live only in the account-scoped profile.
  const stored=progress.completed?{...progress,answers:{}}:progress;
  writes.current=writes.current.catch(()=>{}).then(()=>AsyncStorage.setItem(key,JSON.stringify(stored)));
  void writes.current.catch(()=>setError(t("ui.dbc022e46a")));
 },[progress]);
 const index=Math.max(0,config.slides.findIndex(slide=>slide.id===progress?.slideId));
 const slide=config.slides[index];
 const p=migratePreferences(state.profile,agentConfig);
 const answers={...p.answers,name:p.name,preferences:p.preferences,...progress?.answers};
 function finish(skipped=false) {
  if(!progress)return;
  if(!skipped){
   const check=validateAnswers(answers,config.fields);
   if(!check.valid){setError(t("ui.83f153b9bc")+check.errors.join(', '));return;}
  }
  update(old=>({...old,profile:{...old.profile,answers,name:typeof answers.name==='string'?answers.name:old.profile.name,preferences:typeof answers.preferences==='string'?answers.preferences:old.profile.preferences,updatedAt:Date.now()}}));
  setProgress({...progress,completed:true,answers:{},version:config.version});setVisible(false);Keyboard.dismiss();
  track(skipped?'onboarding_skipped':'onboarding_completed',{step:index+1});
  router.replace(initialHref as Href);
 }
 function next(){
  const check=validateAnswers(answers,config.fields.filter(f=>slide.fields.includes(f.id)));
  if(!check.valid){setError(t("ui.83f153b9bc")+check.errors.join(', '));return;}
  setError('');Keyboard.dismiss();
  if(index===config.slides.length-1)finish();
  else if(progress)setProgress({...progress,slideId:config.slides[index+1].id});
 }
 function revisit(){if(config.enabled){setError('');setProgress({completed:false,answers:{...p.answers,name:p.name,preferences:p.preferences},version:config.version,slideId:config.slides[0]?.id});setVisible(true);}}
 const image=slide?.image?assets.onboarding[slide.image as keyof typeof assets.onboarding]:undefined;
 return <Revisit.Provider value={revisit}><View style={{flex:1}} accessibilityElementsHidden={visible} aria-hidden={visible} importantForAccessibility={visible?"no-hide-descendants":"auto"}>{children}</View>
  {config.enabled&&progress&&slide&&<Modal visible={visible} presentationStyle="fullScreen" animationType="fade" onRequestClose={()=>{if(config.skippable)finish(true);}}>
   <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:colors.paper}}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
    <View style={[s.row,{paddingHorizontal:styleToken("Introduction.paddingHorizontal.f5ca38f748","paddingHorizontal",20),paddingVertical:styleToken("Introduction.paddingVertical.2c624232cd","paddingVertical",8),justifyContent:'space-between'}]}>
     <Pressable disabled={index===0} accessibilityRole="button" accessibilityLabel={t("ui.76900f1bfd")} onPress={()=>{Keyboard.dismiss();setProgress({...progress,slideId:config.slides[index-1].id});}} style={{minWidth:styleToken("Introduction.minWidth.71ee45a3c0","minWidth",44),minHeight:styleToken("Introduction.minHeight.71ee45a3c0","minHeight",44),justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:styleToken("Introduction.fontSize.59e19706d5","fontSize",28)}}>{index>0?'‹':''}</Text></Pressable>
     <View style={s.row}><Logo size={28}/><Text style={s.sectionTitle}>{agentConfig.brand.name}</Text></View>
     <Pressable accessibilityRole="button" disabled={!config.skippable} onPress={()=>finish(true)} style={{padding:styleToken("Introduction.padding.6b51d431df","padding",12)}}><Text style={s.small}>{config.skippable?t("ui.28d03596d2"):''}</Text></Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{padding:styleToken("Introduction.padding.c2356069e9","padding",24),paddingBottom:styleToken("Introduction.paddingBottom.38d66d9692","paddingBottom",130),maxWidth:styleToken("Introduction.maxWidth.a4c6af0cb6","maxWidth",680),width:'100%',alignSelf:'center'}}>
     {image&&<Image source={image} accessibilityLabel={slide.title} resizeMode="cover" style={{height:styleToken("Introduction.height.983bd614bb","height",300),width:'100%',borderRadius:styleToken("Introduction.borderRadius.59e19706d5","borderRadius",28),marginBottom:styleToken("Introduction.marginBottom.c2356069e9","marginBottom",24)}}/>}
     <Text style={s.eyebrow}>{slide.eyebrow}</Text><Text style={s.title}>{slide.title}</Text><Text style={[s.body,{marginTop:styleToken("Introduction.marginTop.4ec9599fc2","marginTop",18),marginBottom:styleToken("Introduction.marginBottom.4ec9599fc2","marginBottom",18)}]}>{slide.body}</Text>
     <PreferenceFields ids={slide.fields} answers={answers} onChange={value=>setProgress({...progress,answers:value})}/>
     {slide.fields.length>0&&<Pressable onPress={Keyboard.dismiss} style={{padding:styleToken("Introduction.padding.6b51d431df","padding",12),alignSelf:'flex-end'}}><Text style={s.small}>{t("ui.0049612de6")}</Text></Pressable>}
     {!!error&&<Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
    </ScrollView>
    <View pointerEvents="box-none" style={{position:'absolute',bottom:12,left:0,right:0,backgroundColor:'transparent',alignItems:'center'}}>
     <Text style={[s.small,{marginBottom:styleToken("Introduction.marginBottom.2c624232cd","marginBottom",8)}]}>{index+1} {t("ui.8a5edab282")}{config.slides.length}</Text>
     <Button style={{width:'50%',minWidth:styleToken("Introduction.minWidth.80c3cd40fa","minWidth",168),maxWidth:styleToken("Introduction.maxWidth.9644294ac4","maxWidth",340)}} onPress={next}>{slide.button}</Button>
    </View>
   </KeyboardAvoidingView></SafeAreaView></SafeAreaProvider>
  </Modal>}
 </Revisit.Provider>;
}
