import { styleToken } from "../../../../packages/config/src/theme.ts";
import { Pressable, Text, TextInput, View } from 'react-native';
import { agentConfig } from '../../../../packages/config/src/public.ts';
import type { PreferenceAnswers } from '../../../../packages/config/src/preferences.ts';
import { colors, s } from './ui';
export function PreferenceFields({ids,answers,onChange}:{ids:string[];answers:PreferenceAnswers;onChange:(answers:PreferenceAnswers)=>void}) {
 return <>{ids.map(id=>{
  const field=agentConfig.onboarding.fields.find(f=>f.id===id);
  if(!field)return null;
  const value=answers[id];
  return <View key={id} style={{marginVertical:styleToken("PreferenceFields.marginVertical.6b51d431df","marginVertical",12)}}>
   <Text style={[s.sectionTitle,{fontSize:styleToken("PreferenceFields.fontSize.f5ca38f748","fontSize",20),marginBottom:styleToken("PreferenceFields.marginBottom.6b51d431df","marginBottom",12)}]}>{field.label}{field.required?' *':''}</Text>
   {field.type==='text'?<TextInput accessibilityLabel={field.label} value={typeof value==='string'?value:''} onChangeText={text=>onChange({...answers,[id]:text})} placeholder={field.placeholder} placeholderTextColor={colors.muted} multiline={id!=='name'} maxLength={field.maxLength||900} style={[s.input,{minHeight:id==='name'?50:100,textAlignVertical:'top'}]}/>:
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:styleToken("PreferenceFields.gap.4a44dc1536","gap",10)}}>{field.options?.map(option=>{
     const selected=Array.isArray(value)?value.includes(option.id):value===option.id;
     return <Pressable key={option.id} accessibilityRole={field.type==='single'?'radio':'checkbox'} accessibilityState={{checked:selected}} onPress={()=>{
      const next=field.type==='single'?option.id:selected?(Array.isArray(value)?value:[]).filter(v=>v!==option.id):[...(Array.isArray(value)?value:[]),option.id];
      onChange({...answers,[id]:next});
     }} style={[s.chip,{maxWidth:'100%'},selected&&{borderColor:colors.accent,backgroundColor:colors.soft}]}><Text style={[s.chipText,{flexShrink:1}]}>{option.label}{selected?' ✓':''}</Text></Pressable>;
    })}</View>}
  </View>;
 })}</>;
}
