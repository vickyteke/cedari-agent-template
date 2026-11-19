import { styleToken } from "../../../../../packages/config/src/theme.ts";
import { t } from "../../../../../packages/config/src/copy.ts";
import { agentConfig } from "../../../../../packages/config/src/public.ts";
import { useScrollChrome } from '../../components/ScrollChrome';
import { createChatScrollFollow } from '../../lib/chat-scroll';
import { ChatWaiting } from '../../components/ChatWaiting';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import { pickPhotos, preparePhoto, uploadPhoto, type DraftPhoto } from '../../lib/photos';
import { ChatPhoto } from '../../components/ChatPhoto';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { chat } from '../../lib/api';
import { useShopper } from '../../lib/store';
import { track } from '../../lib/analytics';
import { preferenceContext, migratePreferences } from '../../../../../packages/config/src/preferences.ts';
import type { Message } from '../../lib/model';
import { colors, Heading, Icon, IconButton, Logo, s, Screen } from '../../components/ui';
import { EmailEditButton } from '../../components/EmailEditButton';
import { ProductCard } from '../../components/ProductCard';
import { ChatCheckoutCard } from '../../components/ChatCheckoutCard';
export default function ChatScreen() {
  const chrome = useScrollChrome();
  const { state, update, activeChat, newChat, setActiveChat, session } = useShopper();
  const prompts = agentConfig.discovery.prompts;
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [history, setHistory] = useState(false);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [preparing, setPreparing] = useState(false);
  const [waitTurn, setWaitTurn] = useState('');
  const [waitStartedAt, setWaitStartedAt] = useState(0);
  const [replyStarted, setReplyStarted] = useState(false);
  const wait = useRef<{ startedAt: number; turn: string; replied: boolean } | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [revealingPreview, setRevealingPreview] = useState<string>();
  const previewAnchor = useRef<string | null>(null);
  const [imageWorking,setImageWorking]=useState(false);
  const [streamStatus, setStreamStatus] = useState(t("ui.21c3e0ada3"));
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => {
      const current = wait.current;
      if (value === 'background' && current) track('chat_wait_left', { wait_ms: Date.now() - current.startedAt, had_text: current.replied, reason: 'background' });
    });
    return () => subscription.remove();
  }, []);
  const photoSource = useRef<boolean | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useFocusEffect(useCallback(() => () => {
    const current = wait.current;
    if (current) track('chat_wait_left', { wait_ms: Date.now() - current.startedAt, had_text: current.replied, reason: 'navigation' });
  }, []));
  const lock = useRef(false); const scroll = useRef<import("react-native").ScrollViewInstance>(null);
  const follow = useRef(createChatScrollFollow());
  const offset = useRef(0);
  const [readingEarlier, setReadingEarlier] = useState(false);
  function showLatest() { previewAnchor.current = null; follow.current.resume(); setReadingEarlier(false); scroll.current?.scrollToEnd({ animated: false }); }
  function pauseFollowing() {
    follow.current.touchStart(); setReadingEarlier(true);
    // Stop an in-flight follow animation as soon as the reader touches the list.
    scroll.current?.scrollTo({ y: offset.current, animated: false });
  }
  const conversation = activeChat ? state.conversations[activeChat] : null;
  const messages = conversation?.messages || [];
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void ImagePicker.getPendingResultAsync().then(async result => {
      if (!result || 'code' in result || result.canceled) return;
      const recovered = await Promise.all(result.assets.slice(0, 2).map(preparePhoto));
      setPhotos(previous => [...previous, ...recovered].slice(0, 2));
    }).catch(() => setError(t("ui.8d02052610")));
  }, []);
  function selectPhotoSource(camera: boolean) {
    // UIKit cannot present a picker while the React Native sheet is dismissing.
    if (Platform.OS === 'ios') { photoSource.current = camera; setPhotoMenu(false); }
    else void choosePhoto(camera);
  }
  async function choosePhoto(camera: boolean) {
    setPhotoMenu(false); setError('');
    try {
      if (camera && Platform.OS !== 'web') {
        if (!Device.isDevice) { setError(t("ui.2119ea882e")); return; }
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError(t("ui.a86e1d312f")); return; }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false, ...(camera ? {} : { allowsMultipleSelection: true, selectionLimit: 2 - photos.length }) };
      const result = await pickPhotos(camera, options);
      if (result.canceled) return;
      setPreparing(true);
      const selected = await Promise.all(result.assets.slice(0, 2 - photos.length).map(preparePhoto));
      setPhotos(previous => [...previous, ...selected].slice(0, 2));
      track('chat_photo_selected', { source: camera ? 'camera' : 'library', image_count: selected.length });
    } catch (error) {
      setError(Platform.OS === 'web' && error instanceof Error ? error.message : t("ui.90b848c5fb"));
    }
    finally { setPreparing(false); }
  }
  async function send(value = text) {
    if ((!value.trim() && !photos.length) || lock.current || preparing) return;
    previewAnchor.current = null; follow.current.resume(); setReadingEarlier(false);
    Keyboard.dismiss();
    const waitingAt = Date.now(); const turn = Crypto.randomUUID();
    wait.current = { startedAt: waitingAt, turn, replied: false }; setWaitTurn(turn); setWaitStartedAt(waitingAt); setReplyStarted(false);
    lock.current = true; pending.current = new AbortController(); setStreamingText(''); setImageWorking(false); setStreamStatus(photos.length ? t("ui.0b5c2afe10") : t("ui.21c3e0ada3")); setBusy(true); setError(''); setText(''); setHistory(false);
    const id = activeChat || newChat();
    let attached;
    try { attached = await Promise.all(photos.map(uploadPhoto)); }
    catch (error) { setError(error instanceof Error ? error.message : t("ui.e17c5befb6")); setText(value); setBusy(false); lock.current = false; pending.current = null; wait.current = null; return; }
    setPhotos([]);
    const message: Message = { images: attached, id: Crypto.randomUUID(), role: 'user', content: (value.trim() || t("ui.c4d1b28c66")).slice(0, 1800), createdAt: Date.now() };
    const next = [...messages, message];
    update(s => ({ ...s, conversations: { ...s.conversations, [id]: { ...s.conversations[id], id, title: next[0].content.slice(0, 48), messages: next, updatedAt: Date.now() } } }));
    const started = Date.now(); let firstTextMs: number | undefined; track('chat_sent', { conversation_id: id, image_count: attached.length });
    try {
      const memory = [preferenceContext(migratePreferences(state.profile, agentConfig), agentConfig),
        t("dynamic.cabc83c1d7",{value0: String(Object.values(state.saved).filter(x => x.active).slice(-6).map(x => x.product.title).join('; '))}),
        t("dynamic.3f1d56b090",{value0: String(Object.values(state.viewed).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4).map(x => x.product.title).join('; '))}),
      ].join('\n').slice(0, 1200);
      let lastPaint = 0;
      const signal = pending.current.signal;
      const response = await chat(next, memory, { signal,
        onText: value => {
          const now = Date.now();
          if (!value || now - lastPaint >= 50) { setStreamingText(value); lastPaint = now; }
          if (value && firstTextMs === undefined) { setReplyStarted(true); if (wait.current) wait.current.replied = true; firstTextMs = Date.now() - started; track('chat_first_text', { conversation_id: id, first_text_ms: firstTextMs }); }
        },
        onStatus: (status, phase) => {setStreamStatus(status);setImageWorking(phase === "image");},
      });
      const { timings, ...reply } = response;
      const answer: Message = { ...reply, id: Crypto.randomUUID(), role: 'assistant', createdAt: Date.now() };
      if (answer.previewImage) {
        if (follow.current.shouldFollow()) previewAnchor.current = answer.id;
        setStreamingText('');
        setRevealingPreview(answer.id);
      }
      update(s => { const c = s.conversations[id]; if (!c || c.deletedAt) return s; return { ...s, conversations: { ...s.conversations, [id]: { ...c, messages: [...c.messages, answer], updatedAt: Date.now() } } }; });
      track('chat_completed', { ...timings, ...(firstTextMs === undefined ? {} : { first_text_ms: firstTextMs }), conversation_id: id, wait_duration_ms: Date.now() - waitingAt, duration_ms: Date.now() - started, result_count: response.products.length, mode: response.mode });
      if (answer.previewImage) {
        // The image arrives whole. Reveal the accompanying caption in the same row.
        const chunks = answer.content.match(/(?:\s*\S+){1,2}\s*/g) ?? [];
        let caption = '';
        for (const chunk of chunks) {
          await new Promise(resolve => setTimeout(resolve, 65));
          if (signal.aborted) break;
          caption += chunk;
          setStreamingText(caption);
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : t("ui.654aa58223")); track('chat_failed', { ...(firstTextMs === undefined ? {} : { first_text_ms: firstTextMs }), conversation_id: id, duration_ms: Date.now() - started }); }
    finally { setRevealingPreview(undefined); setStreamingText(''); setBusy(false); pending.current = null; wait.current = null; lock.current = false; }
  }
  function retry() { const last = messages.at(-1); if (last?.role !== 'user') return; update(s => { const c = s.conversations[activeChat!]; return { ...s, conversations: { ...s.conversations, [activeChat!]: { ...c, messages: c.messages.slice(0, -1) } } }; }); setText(last.content); setPhotos((last.images || []).map(image => ({ key: image.id, uri: '', base64: '', uploaded: image }))); setError(''); }
  // Cover the full screen, including our custom header and safe-area inset.
  // A nested avoiding view measures its origin relative to Screen's inner view,
  // which does not match the keyboard's window coordinates on a real iPhone.
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><Screen name="chat" scroll={false}>
    <View style={[s.row, { justifyContent: 'space-between', paddingHorizontal: styleToken("index.paddingHorizontal.4ec9599fc2","paddingHorizontal",18), paddingVertical: styleToken("index.paddingVertical.7902699be4","paddingVertical",7) }]}><Pressable accessibilityRole="button" onPress={() => setHistory(!history)}><Text style={s.small}>{t("ui.efc80d5ff5")}</Text></Pressable><IconButton name="plus" label={t("ui.396c946f0c")} onPress={() => { if (!busy) { showLatest(); setActiveChat(null); setError(''); setPhotos([]); setText(''); } }}/></View>
    <View style={{ flex: 1, minHeight: styleToken("index.minHeight.5feceb66ff","minHeight",0) }}>
    <ScrollView ref={scroll} style={{ flex: 1, minHeight: styleToken("index.minHeight.5feceb66ff","minHeight",0) }} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: styleToken("index.padding.785f3ec7eb","padding",22), paddingBottom: styleToken("index.paddingBottom.f5ca38f748","paddingBottom",20) }} onTouchStart={pauseFollowing} onTouchEnd={() => follow.current.touchEnd()} onTouchCancel={() => follow.current.touchEnd()}
      onScrollBeginDrag={() => { chrome.onScrollBeginDrag(); follow.current.dragStart(); setReadingEarlier(true); }}
      onScroll={event => { chrome.onScroll(event); const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent; offset.current = contentOffset.y; follow.current.scroll(contentOffset.y, layoutMeasurement.height, contentSize.height); setReadingEarlier(follow.current.paused()); }} scrollEventThrottle={16}
      onScrollEndDrag={event => { chrome.onScrollEndDrag(); const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent; follow.current.dragEnd(contentOffset.y, layoutMeasurement.height, contentSize.height); setReadingEarlier(follow.current.paused()); }}
      onMomentumScrollBegin={() => { chrome.onMomentumScrollBegin(); follow.current.momentumStart(); }}
      onMomentumScrollEnd={event => { chrome.onMomentumScrollEnd(); const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent; follow.current.momentumEnd(contentOffset.y, layoutMeasurement.height, contentSize.height); setReadingEarlier(follow.current.paused()); }}
      onContentSizeChange={() => { if (!history && messages.length > 0 && !previewAnchor.current && follow.current.shouldFollow()) scroll.current?.scrollToEnd({ animated: false }); }}>
      {history ? <><Heading eyebrow={t("ui.4717348231")} title={t("ui.903532e033")}/>{Object.values(state.conversations).filter(c => !c.deletedAt && c.messages.length).sort((a, b) => b.updatedAt - a.updatedAt).map(c => <Pressable key={c.id} style={s.panel} disabled={busy} onPress={() => { showLatest(); setActiveChat(c.id); setHistory(false); setError(''); }}><Text style={s.sectionTitle}>{c.title}</Text><Text style={s.small}>{new Date(c.updatedAt).toLocaleDateString()} {t("ui.a137f17a19")}{c.messages.length} {t("ui.f5cccfb737")}</Text></Pressable>)}<Text style={s.body}>{session ? t("ui.d63bfdfa16") : t("ui.0c8ae6b693")}</Text></> : <>
      {!messages.length && <View style={{ paddingTop: styleToken("index.paddingTop.785f3ec7eb","paddingTop",22) }}><Text style={s.eyebrow}>{t("ui.8d18158460")}</Text><Heading title={state.profile.name ? t("dynamic.fea8d8a0c6",{value0: String(state.profile.name)}) : t("ui.cd45dc4d9e")}/><Text style={[s.body, { maxWidth: styleToken("index.maxWidth.deeeb5df3f","maxWidth",350), marginBottom: styleToken("index.marginBottom.624b60c58c","marginBottom",30) }]}>{t("ui.86756f7c54")}</Text><View style={{ gap: styleToken("index.gap.4a44dc1536","gap",10) }}>{prompts.map((prompt, i) => <Pressable key={prompt} onPress={() => void send(prompt)} style={[s.chip, s.row, { justifyContent: 'space-between', borderRadius: styleToken("index.borderRadius.b17ef6d19c","borderRadius",16), paddingVertical: styleToken("index.paddingVertical.4ec9599fc2","paddingVertical",18) }]}><View style={[s.row, { flex: 1, minWidth: styleToken("index.minWidth.5feceb66ff","minWidth",0) }]}><Text style={{ fontSize: styleToken("index.fontSize.4a44dc1536","fontSize",10), color: colors.accent, flexShrink: 0 }}>{t("ui.5feceb66ff")}{i + 1}</Text><Text style={[s.chipText, { flex: 1, flexShrink: 1, minWidth: styleToken("index.minWidth.5feceb66ff","minWidth",0), lineHeight: styleToken("index.lineHeight.9400f1b21c","lineHeight",19) }]}>{prompt}</Text></View><View style={{ flexShrink: 0 }}><Icon name="arrow" size={17}/></View></Pressable>)}</View><Text style={[s.small, { marginTop: styleToken("index.marginTop.b7a56873cd","marginTop",25) }]}>{t("ui.e8703e7fb5")}</Text></View>}
      {messages.map(message => <View key={message.id} style={{ marginBottom: styleToken("index.marginBottom.785f3ec7eb","marginBottom",22) }} onLayout={message.previewImage ? event => {
        if (previewAnchor.current !== message.id) return;
        previewAnchor.current = null;
        if (!follow.current.shouldFollow()) return;
        follow.current.touchStart();
        follow.current.touchEnd();
        setReadingEarlier(true);
        scroll.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true });
      } : undefined}>{message.role === 'user' ? <View style={{ backgroundColor: colors.soft, padding: styleToken("index.padding.b17ef6d19c","padding",16), borderRadius: styleToken("index.borderRadius.4ec9599fc2","borderRadius",18), borderBottomRightRadius: 4, alignSelf: 'flex-end', maxWidth: '88%' }}>{!!message.images?.length && <View style={{ flexDirection: 'row', gap: styleToken("index.gap.2c624232cd","gap",8), flexWrap: 'wrap' }}>{message.images.map(photo => <ChatPhoto key={photo.id} photo={photo}/>)}</View>}<Text style={{ color: colors.ink, lineHeight: styleToken("index.lineHeight.785f3ec7eb","lineHeight",22), fontSize: styleToken("index.fontSize.e629fa6598","fontSize",15) }}>{message.content}</Text></View> : <><View style={[s.row, { marginBottom: styleToken("index.marginBottom.4a44dc1536","marginBottom",10) }]}><Logo size={26}/><Text style={s.eyebrow}>{t("ui.633b564713")}</Text></View>{message.previewImage && <ChatPhoto photo={message.previewImage} preview/>}
        <ChatMarkdown>{revealingPreview === message.id ? streamingText : message.content}</ChatMarkdown>{message.checkoutLinks?.map(link => <ChatCheckoutCard key={link.storeKey} link={link} products={message.products}/>)}{!!message.products?.some(p => !message.checkoutLinks?.some(link => link.items.some(item => item.productId === p.id))) && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: styleToken("index.gap.8527a891e2","gap",14), paddingTop: styleToken("index.paddingTop.4ec9599fc2","paddingTop",18) }}>{message.products.filter(p => !message.checkoutLinks?.some(link => link.items.some(item => item.productId === p.id))).map(p => <ProductCard key={p.id} product={p} compact/>)}</ScrollView>}{!!message.products?.length && !message.previewImage && !message.checkoutLinks?.length && agentConfig.features.email && <EmailEditButton key={message.id + message.products.map(p => p.id).join(',')} products={message.products}/>}{messages.at(-1)?.id === message.id && !!message.products?.length && !message.previewImage && !message.checkoutLinks?.length && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void send(t("ui.81f7caa07e"))} style={[s.chip, { alignSelf: 'flex-start', marginTop: styleToken("index.marginTop.6b51d431df","marginTop",12), opacity: busy ? 0.5 : 1 }]}><Text style={s.chipText}>{t("ui.6324c2015d")}</Text></Pressable>}</>}</View>)}
      {busy && !revealingPreview && <View style={{ marginBottom: styleToken("index.marginBottom.785f3ec7eb","marginBottom",22) }}>{imageWorking ? (
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', justifyContent: 'center', gap: styleToken("index.gap.6b51d431df","gap",12), minHeight: styleToken("index.minHeight.5ec1a0c99d","minHeight",144), borderRadius: styleToken("index.borderRadius.6b51d431df","borderRadius",12), backgroundColor: colors.paper }}>
          <Icon name="camera" color={colors.accent} size={26}/>
          <ActivityIndicator color={colors.accent} accessibilityLabel={t("ui.c70ac102b1")}/>
          <Text style={s.small}>{streamStatus}</Text>
        </View>
      ) : <ChatWaiting key={waitTurn} turn={waitTurn} startedAt={waitStartedAt} status={streamStatus} streaming={!!streamingText} replyStarted={replyStarted} conversationId={activeChat || undefined}/>}{!!streamingText && <ChatMarkdown>{streamingText}</ChatMarkdown>}</View>}{!!error && <View><Text style={s.error}>{error}</Text>{messages.at(-1)?.role === 'user' && <Pressable onPress={retry}><Text style={{ color: colors.accent }}>{t("ui.7c9468f3a1")}</Text></Pressable>}</View>}
      </>}
    </ScrollView>
    {!history && readingEarlier && messages.length > 0 && <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 8, alignItems: 'center', backgroundColor: 'transparent' }}><Pressable accessibilityRole="button" accessibilityLabel={t("ui.8e55e19c81")} onPress={showLatest} style={{ width: styleToken("index.width.71ee45a3c0","width",44), height: styleToken("index.height.71ee45a3c0","height",44), borderRadius: styleToken("index.borderRadius.785f3ec7eb","borderRadius",22), backgroundColor: colors.white, borderWidth: styleToken("index.borderWidth.6b86b273ff","borderWidth",1), borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}><View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="arrow" size={20}/></View></Pressable></View>}
    </View>
    <View style={{ flexShrink: 0, paddingHorizontal: styleToken("index.paddingHorizontal.4ec9599fc2","paddingHorizontal",18), paddingTop: styleToken("index.paddingTop.4a44dc1536","paddingTop",10), paddingBottom: styleToken("index.paddingBottom.4a44dc1536","paddingBottom",10), borderTopWidth: styleToken("index.borderTopWidth.6b86b273ff","borderTopWidth",1), borderColor: colors.line }}>{keyboardVisible && <Pressable accessibilityRole="button" accessibilityLabel={t("ui.7f4e2e1d11")} onPress={() => Keyboard.dismiss()} hitSlop={8} style={{ alignSelf: 'flex-end', paddingVertical: styleToken("index.paddingVertical.2c624232cd","paddingVertical",8), paddingHorizontal: styleToken("index.paddingHorizontal.e7f6c01177","paddingHorizontal",6) }}><Text style={{ color: colors.accent, fontSize: styleToken("index.fontSize.8527a891e2","fontSize",14), fontWeight: '600' }}>{t("ui.11a6767d56")}</Text></Pressable>}{!!photos.length && <View style={{ flexDirection: 'row', gap: styleToken("index.gap.6b51d431df","gap",12), marginBottom: styleToken("index.marginBottom.4a44dc1536","marginBottom",10) }}>{photos.map((photo, index) => <View key={photo.key} style={{ width: styleToken("index.width.48449a14a4","width",80) }}>{photo.uploaded ? <View style={{ width: styleToken("index.width.f74efabef1","width",76), height: styleToken("index.height.f74efabef1","height",76), overflow: 'hidden', borderRadius: styleToken("index.borderRadius.6b51d431df","borderRadius",12) }}><ChatPhoto photo={photo.uploaded}/></View> : <Image source={{ uri: photo.uri }} accessibilityLabel={t("dynamic.f0d8b685b3",{value0: String(index + 1)})} style={{ width: styleToken("index.width.f74efabef1","width",76), height: styleToken("index.height.f74efabef1","height",76), borderRadius: styleToken("index.borderRadius.6b51d431df","borderRadius",12) }}/>}<Pressable accessibilityRole="button" accessibilityLabel={t("dynamic.62aa8318b7",{value0: String(index + 1)})} disabled={busy} onPress={() => setPhotos(previous => previous.filter(item => item.key !== photo.key))} style={{ paddingVertical: styleToken("index.paddingVertical.e7f6c01177","paddingVertical",6) }}><Text style={s.small}>{t("ui.7eb117190a")}</Text></Pressable></View>)}</View>}{preparing && <Text style={s.small}>{t("ui.366366057d")}</Text>}{!!photos.length && <Text style={[s.small, { marginBottom: styleToken("index.marginBottom.e7f6c01177","marginBottom",6) }]}>{t("ui.bf8d8df923")}</Text>}<View style={[s.row, s.input, { borderRadius: styleToken("index.borderRadius.59e19706d5","borderRadius",28), paddingVertical: styleToken("index.paddingVertical.4b227777d4","paddingVertical",4), paddingRight: styleToken("index.paddingRight.e7f6c01177","paddingRight",6) }]}>{agentConfig.features.uploads && <Pressable accessibilityRole="button" accessibilityLabel={t("ui.cec6203b5d")} disabled={busy || preparing || photos.length >= 2} onPress={() => setPhotoMenu(true)} style={{ paddingVertical: styleToken("index.paddingVertical.6b51d431df","paddingVertical",12), opacity: busy || preparing || photos.length >= 2 ? 0.4 : 1 }}><Icon name="camera" color={colors.accent}/></Pressable>}<TextInput accessibilityLabel={t("ui.f9c2a6b745")} placeholder={t("ui.5b656ad4d9")} placeholderTextColor={colors.muted} multiline maxLength={1800} value={text} onChangeText={setText} style={{ flex: 1, maxHeight: styleToken("index.maxHeight.9bdb2af679","maxHeight",110), paddingVertical: styleToken("index.paddingVertical.6b51d431df","paddingVertical",12), fontSize: styleToken("index.fontSize.8527a891e2","fontSize",14), color: colors.ink }}/><Pressable accessibilityRole="button" accessibilityLabel={t("ui.93a26b1eaf")} disabled={busy || preparing || (!text.trim() && !photos.length)} onPress={() => void send()} style={{ borderRadius: styleToken("index.borderRadius.c2356069e9","borderRadius",24), padding: styleToken("index.padding.6b51d431df","padding",12), backgroundColor: colors.accent, opacity: busy || preparing || (!text.trim() && !photos.length) ? 0.4 : 1 }}><Icon name="send" color={colors.white} size={19}/></Pressable></View><Pressable onPress={() => router.push('/profile')}><Text style={[s.small, { textAlign: 'center', fontSize: styleToken("index.fontSize.4a44dc1536","fontSize",10), paddingTop: styleToken("index.paddingTop.7902699be4","paddingTop",7) }]}>{t("ui.98c9aea798")}</Text></Pressable></View>
    <Modal visible={photoMenu} transparent animationType="slide" onRequestClose={() => setPhotoMenu(false)} onDismiss={() => { const camera = photoSource.current; photoSource.current = null; if (camera !== null) void choosePhoto(camera); }}><View style={{ flex: 1, backgroundColor: styleToken("index.backgroundColor.848cea16c1","backgroundColor",'#00000055'), justifyContent: 'flex-end' }}><Pressable accessibilityRole="button" accessibilityLabel={t("ui.f3abd8e92f")} onPress={() => setPhotoMenu(false)} style={{ flex: 1 }}/><View style={{ backgroundColor: colors.paper, padding: styleToken("index.padding.c2356069e9","padding",24), paddingBottom: styleToken("index.paddingBottom.d59eced1de","paddingBottom",40), borderTopLeftRadius: 24, borderTopRightRadius: 24 }}><Text style={s.sectionTitle}>{t("ui.65e015cddd")}</Text><Text style={[s.body, { marginVertical: styleToken("index.marginVertical.6b51d431df","marginVertical",12) }]}>{t("ui.14c1bb14e7")}</Text><Pressable accessibilityRole="button" onPress={() => selectPhotoSource(false)} style={[s.panel, s.row]}><Icon name="image"/><Text style={s.body}>{t("ui.303cd2c152")}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => selectPhotoSource(true)} style={[s.panel, s.row]}><Icon name="camera"/><Text style={s.body}>{t("ui.996e6a73ea")}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setPhotoMenu(false)} style={{ padding: styleToken("index.padding.6b51d431df","padding",12) }}><Text style={[s.body, { textAlign: 'center' }]}>{t("ui.19766ed6cc")}</Text></Pressable></View></View></Modal>
  </Screen></KeyboardAvoidingView>;
}
