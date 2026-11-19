import { t } from "../../../../packages/config/src/copy.ts";
import { agentConfig, storageNamespace } from "../../../../packages/config/src/public.ts";
import { request } from './api';
/* eslint-disable react-hooks/set-state-in-effect -- Account transitions must hide previous-account data while external storage is loading. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from './auth';
import { analytics, analyticsConsent, track } from './analytics';
import { emptyState, mergeState, parseState, type Product, type ShopperState } from './model';

type Context = {
  state: ShopperState; ready: boolean; session: Session | null; syncStatus: string;
  update: (change: (state: ShopperState) => ShopperState) => void;
  save: (product: Product) => void; bag: (product: Product, quantity: number) => void;
  activeChat: string | null; setActiveChat: (id: string | null) => void;
  newChat: () => string; signOut: () => Promise<void>; clearHistory: () => void;
  consent: boolean; setConsent: (value: boolean) => void; retrySync: () => void;
};
const Store = createContext<Context | null>(null);
const keyFor = (id?: string) => `${storageNamespace(agentConfig.id)}.${id || 'guest'}`;
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(emptyState); const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null); const [syncStatus, setSyncStatus] = useState(t("ui.ade5400f21"));
  const [activeChat, setActiveChat] = useState<string | null>(null); const [consent, setConsentState] = useState(false);
  const [retry, setRetry] = useState(0); const generation = useRef(0); const stateRef = useRef(state);
  const persisted = useRef(Promise.resolve());
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    void AsyncStorage.getItem(storageNamespace(agentConfig.id) + '.analytics').then(value => { const allow = value === 'yes'; setConsentState(allow); analyticsConsent(allow); });
    let alive = true;
    if (!supabase) { setReady(true); return; }
    void supabase.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session?.user.is_anonymous ? null : data.session); setReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((event, value) => { if (alive && event !== 'INITIAL_SESSION') setSession(value?.user.is_anonymous ? null : value); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  const [loadedKey, setLoadedKey] = useState('');
  const userId = session?.user.id;
  useEffect(() => { if (consent && userId) analytics?.identify(userId); }, [consent, userId]);
  useEffect(() => {
    if (!ready) return;
    const currentGeneration = ++generation.current; let alive = true;
    const key = keyFor(userId); setLoadedKey(''); setActiveChat(null);
    void (async () => {
      try {
        await persisted.current;
        const local = await AsyncStorage.getItem(key);
        let next = local ? parseState(JSON.parse(local)) : emptyState();
        if (userId) {
          const guest = await AsyncStorage.getItem(keyFor());
          if (guest) next = mergeState(next, parseState(JSON.parse(guest)));
          analytics?.identify(userId);
        }
        if (alive && generation.current === currentGeneration) { setState(next); setLoadedKey(key); }
      } catch { if (alive) setSyncStatus(t("ui.fcddb11d95")); }
    })();
    return () => { alive = false; };
  }, [userId, ready]);
  useEffect(() => {
    if (!loadedKey || loadedKey !== keyFor(userId)) return;
    const snapshot = state; const key = loadedKey;
    persisted.current = persisted.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(snapshot)));
    void persisted.current.catch(() => setSyncStatus(t("ui.26b57be15d")));
  }, [state, loadedKey, userId]);
  useEffect(() => {
    if (!loadedKey || !userId || !supabase || loadedKey !== keyFor(userId)) return;
    let cancelled = false; const currentGeneration = generation.current;
    const timer = setTimeout(() => { void (async () => {
      setSyncStatus('Syncing…');
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await supabase!.from('shopper_state').select('state,version').eq('user_id', userId).maybeSingle();
          if (error) throw error;
          if (cancelled || generation.current !== currentGeneration) return;
          const merged = data ? mergeState(parseState(data.state), stateRef.current) : stateRef.current;
          const { error: saveError } = await supabase!.rpc('save_shopper_state', { payload: merged, expected_version: data?.version || 0 });
          if (saveError?.message.includes('STATE_CONFLICT')) continue;
          if (saveError) throw saveError;
          if (cancelled || generation.current !== currentGeneration) return;
          if (JSON.stringify(merged) !== JSON.stringify(stateRef.current)) setState(merged);
          await AsyncStorage.removeItem(keyFor());
          setSyncStatus(t("ui.3e53c083b9")); return;
        }
        throw new Error(t("ui.71be4f5816"));
      } catch { if (!cancelled) setSyncStatus(t("ui.3fb8a0410c")); }
    })(); }, 900);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state, loadedKey, userId, retry]);
  function update(change: (state: ShopperState) => ShopperState) { setState(previous => change(previous)); }
  function save(product: Product) { const active = !state.saved[product.id]?.active; update(s => ({ ...s, saved: { ...s.saved, [product.id]: { product, active, updatedAt: Date.now() } } })); track(active ? 'product_saved' : 'product_unsaved', { product_id: product.id, merchant: product.store_key }); }
  function bag(product: Product, quantity: number) { update(s => ({ ...s, bag: { ...s.bag, [product.id]: { product, quantity: Math.max(0, Math.min(20, quantity)), updatedAt: Date.now() } } })); track(quantity === 0 ? 'bag_removed' : quantity > (stateRef.current.bag[product.id]?.quantity || 0) ? 'bag_added' : 'bag_quantity_changed', { product_id: product.id, merchant: product.store_key, quantity }); }
  function newChat() { const id = Crypto.randomUUID(); update(s => ({ ...s, conversations: { ...s.conversations, [id]: { id, title: t("ui.240fd1a59b"), messages: [], updatedAt: Date.now() } } })); setActiveChat(id); return id; }
  async function signOut() {
    await persisted.current;
    const { error } = await supabase!.auth.signOut({ scope: 'local' });
    if (error) throw error;
    await AsyncStorage.removeItem(keyFor()); analytics?.reset(); setState(emptyState()); setSyncStatus(t("ui.ade5400f21"));
  }
  function clearHistory() { void request('/chat-images', { method: 'DELETE' }).catch(() => setSyncStatus(t("ui.5a1392ddcf"))); update(s => ({ ...s, viewed: {}, historyClearedAt: Date.now(), conversations: Object.fromEntries(Object.entries(s.conversations).map(([key, c]) => [key, { ...c, messages: [], deletedAt: Date.now(), updatedAt: Date.now() }])) })); setActiveChat(null); }
  function setConsent(value: boolean) { setConsentState(value); analyticsConsent(value); void AsyncStorage.setItem(storageNamespace(agentConfig.id) + '.analytics', value ? 'yes' : 'no'); }
  return <Store.Provider value={{ state, ready: !!loadedKey && loadedKey === keyFor(userId), session, syncStatus, update, save, bag, activeChat, setActiveChat, newChat, signOut, clearHistory, consent, setConsent, retrySync: () => setRetry(x => x + 1) }}>{children}</Store.Provider>;
}
export function useShopper() { const value = useContext(Store); if (!value) throw new Error(t("ui.68a690f199")); return value; }
