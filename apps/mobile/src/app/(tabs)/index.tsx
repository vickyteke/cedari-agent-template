import { useScrollChrome } from '../../components/ScrollChrome';
import { createChatScrollFollow } from '../../lib/chat-scroll';
import { ChatWaiting } from '../../components/ChatWaiting';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import { pickPhotos, preparePhoto, uploadPhoto, type DraftPhoto } from '../../lib/photos';
import { ChatPhoto } from '../../components/ChatPhoto';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { chat } from '../../lib/api';
import { useShopper } from '../../lib/store';
import { track } from '../../lib/analytics';
import { introductionFromProfile } from '../../lib/onboarding';
import type { Message } from '../../lib/model';
import { colors, Heading, Icon, IconButton, Logo, s, Screen } from '../../components/ui';
import { EmailEditButton } from '../../components/EmailEditButton';
import { ProductCard } from '../../components/ProductCard';
import { ChatCheckoutCard } from '../../components/ChatCheckoutCard';
const defaultPrompts = ['Layer my living room with texture', 'Set a beautifully considered table', 'Find sculptural bedroom lighting'];
export default function ChatScreen() {
  const chrome = useScrollChrome();
  const { state, update, activeChat, newChat, setActiveChat, session } = useShopper();
  const taste = introductionFromProfile(state.profile);
  const prompts = state.profile.preferences ? [`Help me decorate ${taste.rooms[0] && taste.rooms[0] !== 'Whole home' ? 'my ' + taste.rooms[0].toLowerCase() : 'my home'}${taste.styles[0] ? ' in a ' + taste.styles[0].toLowerCase() + ' style' : ' with my aesthetic in mind'}`, 'Find complementary pieces for my space', 'Help me refine my palette and materials'] : defaultPrompts;
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
  const [streamStatus, setStreamStatus] = useState('Getting ready to help…');
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
  const lock = useRef(false); const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
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
    }).catch(() => setError('Please choose that photo again.'));
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
        if (!Device.isDevice) { setError('The simulator has no camera. Choose a photo from the library, or use the camera on a real phone.'); return; }
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError('Camera access is off. Enable it in your phone’s settings, or choose a photo from your library.'); return; }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false, ...(camera ? {} : { allowsMultipleSelection: true, selectionLimit: 2 - photos.length }) };
      const result = await pickPhotos(camera, options);
      if (result.canceled) return;
      setPreparing(true);
      const selected = await Promise.all(result.assets.slice(0, 2 - photos.length).map(preparePhoto));
      setPhotos(previous => [...previous, ...selected].slice(0, 2));
      track('chat_photo_selected', { source: camera ? 'camera' : 'library', image_count: selected.length });
    } catch (error) {
      setError(Platform.OS === 'web' && error instanceof Error ? error.message : 'That photo could not be opened. Try exporting it as a JPEG or PNG and selecting it again.');
    }
    finally { setPreparing(false); }
  }
  async function send(value = text) {
    if ((!value.trim() && !photos.length) || lock.current || preparing) return;
    previewAnchor.current = null; follow.current.resume(); setReadingEarlier(false);
    Keyboard.dismiss();
    const waitingAt = Date.now(); const turn = Crypto.randomUUID();
    wait.current = { startedAt: waitingAt, turn, replied: false }; setWaitTurn(turn); setWaitStartedAt(waitingAt); setReplyStarted(false);
    lock.current = true; pending.current = new AbortController(); setStreamingText(''); setStreamStatus(photos.length ? 'Getting your photos ready…' : 'Getting ready to help…'); setBusy(true); setError(''); setText(''); setHistory(false);
    const id = activeChat || newChat();
    let attached;
    try { attached = await Promise.all(photos.map(uploadPhoto)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Photo upload failed. Please try again.'); setText(value); setBusy(false); lock.current = false; pending.current = null; wait.current = null; return; }
    setPhotos([]);
    const message: Message = { images: attached, id: Crypto.randomUUID(), role: 'user', content: (value.trim() || 'Suggest complementary pieces for the room or furniture in my photos, from different shops.').slice(0, 1800), createdAt: Date.now() };
    const next = [...messages, message];
    update(s => ({ ...s, conversations: { ...s.conversations, [id]: { ...s.conversations[id], id, title: next[0].content.slice(0, 48), messages: next, updatedAt: Date.now() } } }));
    const started = Date.now(); let firstTextMs: number | undefined; track('chat_sent', { conversation_id: id, image_count: attached.length });
    try {
      const memory = [state.profile.preferences,
        `Saved pieces: ${Object.values(state.saved).filter(x => x.active).slice(-6).map(x => x.product.title).join('; ')}`,
        `Recently explored: ${Object.values(state.viewed).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4).map(x => x.product.title).join('; ')}`,
      ].join('\n').slice(0, 1200);
      let lastPaint = 0;
      const signal = pending.current.signal;
      const response = await chat(next, memory, { signal,
        onText: value => {
          const now = Date.now();
          if (!value || now - lastPaint >= 50) { setStreamingText(value); lastPaint = now; }
          if (value && firstTextMs === undefined) { setReplyStarted(true); if (wait.current) wait.current.replied = true; firstTextMs = Date.now() - started; track('chat_first_text', { conversation_id: id, first_text_ms: firstTextMs }); }
        },
        onStatus: setStreamStatus,
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your message.'); track('chat_failed', { ...(firstTextMs === undefined ? {} : { first_text_ms: firstTextMs }), conversation_id: id, duration_ms: Date.now() - started }); }
    finally { setRevealingPreview(undefined); setStreamingText(''); setBusy(false); pending.current = null; wait.current = null; lock.current = false; }
  }
  function retry() { const last = messages.at(-1); if (last?.role !== 'user') return; update(s => { const c = s.conversations[activeChat!]; return { ...s, conversations: { ...s.conversations, [activeChat!]: { ...c, messages: c.messages.slice(0, -1) } } }; }); setText(last.content); setPhotos((last.images || []).map(image => ({ key: image.id, uri: '', base64: '', uploaded: image }))); setError(''); }
  // Cover the full screen, including our custom header and safe-area inset.
  // A nested avoiding view measures its origin relative to Screen's inner view,
  // which does not match the keyboard's window coordinates on a real iPhone.
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><Screen name="chat" scroll={false}>
    <View style={[s.row, { justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 7 }]}><Pressable accessibilityRole="button" onPress={() => setHistory(!history)}><Text style={s.small}>Your conversations ↗</Text></Pressable><IconButton name="plus" label="New conversation" onPress={() => { if (!busy) { showLatest(); setActiveChat(null); setError(''); setPhotos([]); setText(''); } }}/></View>
    <View style={{ flex: 1, minHeight: 0 }}>
    <ScrollView ref={scroll} style={{ flex: 1, minHeight: 0 }} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, paddingBottom: 20 }} onTouchStart={pauseFollowing} onTouchEnd={() => follow.current.touchEnd()} onTouchCancel={() => follow.current.touchEnd()}
      onScrollBeginDrag={() => { chrome.onScrollBeginDrag(); follow.current.dragStart(); setReadingEarlier(true); }}
      onScroll={event => { chrome.onScroll(event); const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent; offset.current = contentOffset.y; follow.current.scroll(contentOffset.y, layoutMeasurement.height, contentSize.height); setReadingEarlier(follow.current.paused()); }} scrollEventThrottle={16}
      onScrollEndDrag={event => { chrome.onScrollEndDrag(); const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent; follow.current.dragEnd(contentOffset.y, layoutMeasurement.height, contentSize.height); setReadingEarlier(follow.current.paused()); }}
      onMomentumScrollBegin={() => { chrome.onMomentumScrollBegin(); follow.current.momentumStart(); }}
      onMomentumScrollEnd={event => { chrome.onMomentumScrollEnd(); const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent; follow.current.momentumEnd(contentOffset.y, layoutMeasurement.height, contentSize.height); setReadingEarlier(follow.current.paused()); }}
      onContentSizeChange={() => { if (!history && messages.length > 0 && !previewAnchor.current && follow.current.shouldFollow()) scroll.current?.scrollToEnd({ animated: false }); }}>
      {history ? <><Heading eyebrow="Pick up where you left off" title="Your conversations"/>{Object.values(state.conversations).filter(c => !c.deletedAt && c.messages.length).sort((a, b) => b.updatedAt - a.updatedAt).map(c => <Pressable key={c.id} style={s.panel} disabled={busy} onPress={() => { showLatest(); setActiveChat(c.id); setHistory(false); setError(''); }}><Text style={s.sectionTitle}>{c.title}</Text><Text style={s.small}>{new Date(c.updatedAt).toLocaleDateString()} · {c.messages.length} messages</Text></Pressable>)}<Text style={s.body}>{session ? 'Your conversations sync to your account.' : 'Guest conversations stay on this device. Sign in to sync them.'}</Text></> : <>
      {!messages.length && <View style={{ paddingTop: 22 }}><Text style={s.eyebrow}>Your personal home décor companion</Text><Heading title={state.profile.name ? `Welcome home, ${state.profile.name}.` : 'Beautiful spaces\nstart with a conversation.'}/><Text style={[s.body, { maxWidth: 350, marginBottom: 30 }]}>A more considered home, one conversation at a time. Share your vision, and I’ll help you discover distinctive pieces from independent shops that suit your space and personal style.</Text><View style={{ gap: 10 }}>{prompts.map((prompt, i) => <Pressable key={prompt} onPress={() => void send(prompt)} style={[s.chip, s.row, { justifyContent: 'space-between', borderRadius: 16, paddingVertical: 18 }]}><View style={[s.row, { flex: 1, minWidth: 0 }]}><Text style={{ fontSize: 10, color: colors.accent, flexShrink: 0 }}>0{i + 1}</Text><Text style={[s.chipText, { flex: 1, flexShrink: 1, minWidth: 0, lineHeight: 19 }]}>{prompt}</Text></View><View style={{ flexShrink: 0 }}><Icon name="arrow" size={17}/></View></Pressable>)}</View><Text style={[s.small, { marginTop: 25 }]}>PREMIUM HOME DÉCOR. A PERSONAL POINT OF VIEW.</Text></View>}
      {messages.map(message => <View key={message.id} style={{ marginBottom: 22 }} onLayout={message.previewImage ? event => {
        if (previewAnchor.current !== message.id) return;
        previewAnchor.current = null;
        if (!follow.current.shouldFollow()) return;
        follow.current.touchStart();
        follow.current.touchEnd();
        setReadingEarlier(true);
        scroll.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true });
      } : undefined}>{message.role === 'user' ? <View style={{ backgroundColor: colors.soft, padding: 16, borderRadius: 18, borderBottomRightRadius: 4, alignSelf: 'flex-end', maxWidth: '88%' }}>{!!message.images?.length && <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{message.images.map(photo => <ChatPhoto key={photo.id} photo={photo}/>)}</View>}<Text style={{ color: colors.ink, lineHeight: 22, fontSize: 15 }}>{message.content}</Text></View> : <><View style={[s.row, { marginBottom: 10 }]}><Logo size={26}/><Text style={s.eyebrow}>Arviva</Text></View>{message.previewImage && <ChatPhoto photo={message.previewImage} preview/>}
        <ChatMarkdown>{revealingPreview === message.id ? streamingText : message.content}</ChatMarkdown>{message.checkoutLinks?.map(link => <ChatCheckoutCard key={link.storeKey} link={link} products={message.products}/>)}{!!message.products?.some(p => !message.checkoutLinks?.some(link => link.items.some(item => item.productId === p.id))) && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 18 }}>{message.products.filter(p => !message.checkoutLinks?.some(link => link.items.some(item => item.productId === p.id))).map(p => <ProductCard key={p.id} product={p} compact/>)}</ScrollView>}{!!message.products?.length && !message.previewImage && !message.checkoutLinks?.length && <EmailEditButton key={message.id + message.products.map(p => p.id).join(',')} products={message.products}/>}{messages.at(-1)?.id === message.id && !!message.products?.length && !message.previewImage && !message.checkoutLinks?.length && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void send("Show me more options like these, keeping the same preferences.")} style={[s.chip, { alignSelf: 'flex-start', marginTop: 12, opacity: busy ? 0.5 : 1 }]}><Text style={s.chipText}>Find more options</Text></Pressable>}</>}</View>)}
      {busy && !revealingPreview && <View style={{ marginBottom: 22 }}>{streamStatus === 'Creating your room preview…' ? (
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 144, borderRadius: 12, backgroundColor: colors.paper }}>
          <Icon name="camera" color={colors.accent} size={26}/>
          <ActivityIndicator color={colors.accent} accessibilityLabel="Room preview in progress"/>
          <Text style={s.small}>{streamStatus}</Text>
        </View>
      ) : <ChatWaiting key={waitTurn} turn={waitTurn} startedAt={waitStartedAt} status={streamStatus} streaming={!!streamingText} replyStarted={replyStarted} conversationId={activeChat || undefined}/>}{!!streamingText && <ChatMarkdown>{streamingText}</ChatMarkdown>}</View>}{!!error && <View><Text style={s.error}>{error}</Text>{messages.at(-1)?.role === 'user' && <Pressable onPress={retry}><Text style={{ color: colors.accent }}>Edit and resend</Text></Pressable>}</View>}
      </>}
    </ScrollView>
    {!history && readingEarlier && messages.length > 0 && <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 8, alignItems: 'center', backgroundColor: 'transparent' }}><Pressable accessibilityRole="button" accessibilityLabel="Jump to latest message" onPress={showLatest} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}><View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="arrow" size={20}/></View></Pressable></View>}
    </View>
    <View style={{ flexShrink: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderColor: colors.line }}>{keyboardVisible && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss keyboard" onPress={() => Keyboard.dismiss()} hitSlop={8} style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 6 }}><Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>Done</Text></Pressable>}{!!photos.length && <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>{photos.map((photo, index) => <View key={photo.key} style={{ width: 80 }}>{photo.uploaded ? <View style={{ width: 76, height: 76, overflow: 'hidden', borderRadius: 12 }}><ChatPhoto photo={photo.uploaded}/></View> : <Image source={{ uri: photo.uri }} accessibilityLabel={`Attached photo ${index + 1}`} style={{ width: 76, height: 76, borderRadius: 12 }}/>}<Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} disabled={busy} onPress={() => setPhotos(previous => previous.filter(item => item.key !== photo.key))} style={{ paddingVertical: 6 }}><Text style={s.small}>Remove ×</Text></Pressable></View>)}</View>}{preparing && <Text style={s.small}>Preparing your photo…</Text>}{!!photos.length && <Text style={[s.small, { marginBottom: 6 }]}>Your photos are shared with Arviva’s AI when you send.</Text>}<View style={[s.row, s.input, { borderRadius: 28, paddingVertical: 4, paddingRight: 6 }]}><Pressable accessibilityRole="button" accessibilityLabel="Add photos or take a picture" disabled={busy || preparing || photos.length >= 2} onPress={() => setPhotoMenu(true)} style={{ paddingVertical: 12, opacity: busy || preparing || photos.length >= 2 ? 0.4 : 1 }}><Icon name="camera" color={colors.accent}/></Pressable><TextInput accessibilityLabel="Message your home décor companion" placeholder="Tell me about the space you’re creating…" placeholderTextColor={colors.muted} multiline maxLength={1800} value={text} onChangeText={setText} style={{ flex: 1, maxHeight: 110, paddingVertical: 12, fontSize: 14, color: colors.ink }}/><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={busy || preparing || (!text.trim() && !photos.length)} onPress={() => void send()} style={{ borderRadius: 24, padding: 12, backgroundColor: colors.accent, opacity: busy || preparing || (!text.trim() && !photos.length) ? 0.4 : 1 }}><Icon name="send" color={colors.white} size={19}/></Pressable></View><Pressable onPress={() => router.push('/profile')}><Text style={[s.small, { textAlign: 'center', fontSize: 10, paddingTop: 7 }]}>Thoughtfully selected. Always your decision. · Privacy & preferences</Text></Pressable></View>
    <Modal visible={photoMenu} transparent animationType="slide" onRequestClose={() => setPhotoMenu(false)} onDismiss={() => { const camera = photoSource.current; photoSource.current = null; if (camera !== null) void choosePhoto(camera); }}><View style={{ flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' }}><Pressable accessibilityRole="button" accessibilityLabel="Close photo options" onPress={() => setPhotoMenu(false)} style={{ flex: 1 }}/><View style={{ backgroundColor: colors.paper, padding: 24, paddingBottom: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}><Text style={s.sectionTitle}>Show me your space</Text><Text style={[s.body, { marginVertical: 12 }]}>Add up to two photos. Let’s explore pieces that complement your space, palette and personal style.</Text><Pressable accessibilityRole="button" onPress={() => selectPhotoSource(false)} style={[s.panel, s.row]}><Icon name="image"/><Text style={s.body}>Choose from photo library</Text></Pressable><Pressable accessibilityRole="button" onPress={() => selectPhotoSource(true)} style={[s.panel, s.row]}><Icon name="camera"/><Text style={s.body}>Take a photo</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setPhotoMenu(false)} style={{ padding: 12 }}><Text style={[s.body, { textAlign: 'center' }]}>Cancel</Text></Pressable></View></View></Modal>
  </Screen></KeyboardAvoidingView>;
}
