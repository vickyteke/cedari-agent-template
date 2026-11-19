import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { ChatPhoto as Photo } from '../lib/model';
import { request } from '../lib/api';
import { useShopper } from '../lib/store';
import { colors, s } from './ui';

type Props = { photo: Photo; preview?: boolean };

export function ChatPhoto(props: Props) {
  const { session } = useShopper();
  return <PrivatePhoto key={JSON.stringify([props.photo.ownerId, props.photo.id, session?.user.id])} {...props} />;
}

function PrivatePhoto({ photo, preview = false }: Props) {
  const [uri, setUri] = useState<string>();
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    void request<{ url: string }>(`/chat-images/${encodeURIComponent(photo.id)}`)
      .then(({ url }) => { if (active) setUri(url); })
      .catch(() => { if (active) setMissing(true); });
    return () => { active = false; };
  }, [photo.id, attempt]);

  function reload() {
    setUri(undefined);
    setMissing(false);
    setAttempt(previous => previous + 1);
  }

  function imageFailed() {
    if (attempt === 0) reload();
    else setMissing(true);
  }

  const image = uri && !missing ? (
    <Image
      source={{ uri }}
      accessibilityLabel={preview ? 'AI preview of the selected piece in your space' : 'Photo shared with Arviva'}
      style={{ width: '100%', height: '100%' }}
      resizeMode={preview ? 'contain' : 'cover'}
      onError={imageFailed}
    />
  ) : missing ? (
    <Pressable accessibilityRole="button" onPress={reload}>
      <Text style={[s.small, { textAlign: 'center', padding: 8 }]}>
        {preview ? 'Room preview unavailable.' : 'Photo unavailable.'} Tap to retry.
      </Text>
    </Pressable>
  ) : (
    <Text style={[s.small, { textAlign: 'center', padding: 8 }]}>Loading photo…</Text>
  );

  return (
    <View style={{
      width: preview ? '100%' : 128,
      height: preview ? undefined : 128,
      aspectRatio: preview ? 4 / 3 : undefined,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.paper,
      justifyContent: 'center',
      marginBottom: 8,
    }}>
      {preview && uri && !missing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open room preview full screen"
          onPress={() => setExpanded(true)}
          style={{ flex: 1 }}
        >
          {image}
        </Pressable>
      ) : image}
      {expanded && (
        <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setExpanded(false)}>
          <SafeAreaProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, paddingHorizontal: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close room preview"
                onPress={() => setExpanded(false)}
                style={{ alignSelf: 'flex-end', padding: 14 }}
              >
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Close</Text>
              </Pressable>
              <View style={{ flex: 1, justifyContent: 'center' }}>{image}</View>
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
      )}
    </View>
  );
}
