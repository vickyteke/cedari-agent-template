import { agentConfig } from "../../../../packages/config/src/public.ts";
import { styleToken } from "../../../../packages/config/src/theme.ts";
import { t } from "../../../../packages/config/src/copy.ts";
import { useEffect, useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { ChatPhoto as Photo } from "../lib/model";
import { request } from "../lib/api";
import { useShopper } from "../lib/store";
import { colors, s } from "./ui";

type Props = { photo: Photo; preview?: boolean };

export function ChatPhoto(props: Props) {
  const { session } = useShopper();
  if (!agentConfig.features.uploads) return null;
  return (
    <PrivatePhoto
      key={JSON.stringify([
        props.photo.ownerId,
        props.photo.id,
        session?.user.id,
      ])}
      {...props}
    />
  );
}

function PrivatePhoto({ photo, preview = false }: Props) {
  const [uri, setUri] = useState<string>();
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    void request<{ url: string }>(
      `/chat-images/${encodeURIComponent(photo.id)}`,
    )
      .then(({ url }) => {
        if (active) setUri(url);
      })
      .catch(() => {
        if (active) setMissing(true);
      });
    return () => {
      active = false;
    };
  }, [photo.id, attempt]);

  function reload() {
    setUri(undefined);
    setMissing(false);
    setAttempt((previous) => previous + 1);
  }

  function imageFailed() {
    if (attempt === 0) reload();
    else setMissing(true);
  }

  const image =
    uri && !missing ? (
      <Image
        source={{ uri }}
        accessibilityLabel={preview ? t("ui.9fb8145511") : t("ui.6e17ed12a1")}
        style={{ width: "100%", height: "100%" }}
        resizeMode={preview ? "contain" : "cover"}
        onError={imageFailed}
      />
    ) : missing ? (
      <Pressable accessibilityRole="button" onPress={reload}>
        <Text
          style={[
            s.small,
            {
              textAlign: "center",
              padding: styleToken("ChatPhoto.padding.2c624232cd", "padding", 8),
            },
          ]}
        >
          {preview ? t("ui.9c266cb6dc") : t("ui.539fb8721f")}{" "}
          {t("ui.7297cdf4cb")}
        </Text>
      </Pressable>
    ) : (
      <Text
        style={[
          s.small,
          {
            textAlign: "center",
            padding: styleToken("ChatPhoto.padding.2c624232cd", "padding", 8),
          },
        ]}
      >
        {t("ui.49fba41bc3")}
      </Text>
    );

  return (
    <View
      style={{
        width: preview ? "100%" : 128,
        height: preview ? undefined : 128,
        aspectRatio: preview ? 4 / 3 : undefined,
        borderRadius: styleToken(
          "ChatPhoto.borderRadius.6b51d431df",
          "borderRadius",
          12,
        ),
        overflow: "hidden",
        backgroundColor: colors.paper,
        justifyContent: "center",
        marginBottom: styleToken(
          "ChatPhoto.marginBottom.2c624232cd",
          "marginBottom",
          8,
        ),
      }}
    >
      {preview && uri && !missing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("ui.6f46ac9d88")}
          onPress={() => setExpanded(true)}
          style={{ flex: 1 }}
        >
          {image}
        </Pressable>
      ) : (
        image
      )}
      {expanded && (
        <Modal
          visible
          animationType="fade"
          presentationStyle="fullScreen"
          onRequestClose={() => setExpanded(false)}
        >
          <SafeAreaProvider>
            <SafeAreaView
              style={{
                flex: 1,
                backgroundColor: colors.paper,
                paddingHorizontal: styleToken(
                  "ChatPhoto.paddingHorizontal.b17ef6d19c",
                  "paddingHorizontal",
                  16,
                ),
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("ui.23bf436d39")}
                onPress={() => setExpanded(false)}
                style={{
                  alignSelf: "flex-end",
                  padding: styleToken(
                    "ChatPhoto.padding.8527a891e2",
                    "padding",
                    14,
                  ),
                }}
              >
                <Text style={{ color: colors.accent, fontWeight: "600" }}>
                  {t("ui.7d9eb7acb1")}
                </Text>
              </Pressable>
              <View style={{ flex: 1, justifyContent: "center" }}>{image}</View>
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
      )}
    </View>
  );
}
