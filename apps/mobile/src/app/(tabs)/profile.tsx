import {
  mergeEditedAnswers,
  removeCustomerData,
} from "../../lib/customer-storage";
import { styleToken } from "../../../../../packages/config/src/theme.ts";
import { t } from "../../../../../packages/config/src/copy.ts";
import { PreferenceFields } from "../../components/PreferenceFields";
import {
  migratePreferences,
  validateAnswers,
} from "../../../../../packages/config/src/preferences.ts";
import type { PreferenceAnswers } from "../../../../../packages/config/src/preferences.ts";
import { agentConfig } from "../../../../../packages/config/src/public.ts";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { request } from "../../lib/api";
import { useShopper } from "../../lib/store";
import { EmailPreferences } from "../../components/EmailPreferences";
import { useIntroduction } from "../../components/Introduction";
import { Button, colors, Heading, s, Screen } from "../../components/ui";
function confirm(title: string, detail: string, action: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${detail}`)) action();
  } else
    Alert.alert(title, detail, [
      { text: t("ui.19766ed6cc"), style: "cancel" },
      { text: t("ui.eebdd24a77"), style: "destructive", onPress: action },
    ]);
}
export default function ProfileScreen() {
  const { session } = useShopper();
  return <ProfileContent key={session?.user.id || "guest"} />;
}
function ProfileContent() {
  const revisitIntroduction = useIntroduction();
  const {
    state,
    session,
    syncStatus,
    retrySync,
    update,
    consent,
    setConsent,
    clearHistory,
    signOut,
  } = useShopper();
  const [draftName, setName] = useState<string>();
  const [draftPreferences, setPreferences] = useState<string>();
  const name = draftName ?? state.profile.name;
  const preferences = draftPreferences ?? state.profile.preferences;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [answerEdits, setAnswerEdits] = useState<PreferenceAnswers>({});
  const answers = mergeEditedAnswers(
    migratePreferences(state.profile, agentConfig).answers,
    answerEdits,
  );
  async function deleteAccount() {
    if (!session) return;
    setDeleting(true);
    setError("");
    try {
      await request("/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      try {
        await signOut();
      } finally {
        await removeCustomerData(AsyncStorage, agentConfig.id, session.user.id);
      }
      setName("");
      setPreferences("");
      setMessage(t("ui.f65c2dd173"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ui.d3ed6dda10"));
    } finally {
      setDeleting(false);
    }
  }
  return (
    <Screen name="profile">
      <Heading
        eyebrow={t("ui.64c95ae2d3")}
        title={session ? t("ui.ca48cb3b46") : t("ui.0fee4c6e23")}
      />
      <View style={s.panel}>
        <Text style={s.sectionTitle}>
          {session ? session.user.email : t("ui.17775bb447")}
        </Text>
        <Text
          style={[
            s.body,
            {
              marginVertical: styleToken(
                "profile.marginVertical.6b51d431df",
                "marginVertical",
                12,
              ),
            },
          ]}
        >
          {session ? t("ui.f15ac163b1") : t("ui.ddba8734f0")}
        </Text>
        {!session && (
          <Button onPress={() => router.push("/sign-in")}>
            {t("ui.e6f13c85f1")}
          </Button>
        )}
        <Pressable onPress={retrySync}>
          <Text
            style={[
              s.small,
              {
                marginTop: styleToken(
                  "profile.marginTop.6b51d431df",
                  "marginTop",
                  12,
                ),
              },
            ]}
          >
            {syncStatus}
          </Text>
        </Pressable>
      </View>
      {agentConfig.onboarding.enabled && (
        <Button
          secondary
          style={{
            marginBottom: styleToken(
              "profile.marginBottom.f5ca38f748",
              "marginBottom",
              20,
            ),
          }}
          onPress={revisitIntroduction}
        >
          {t("ui.8a1f90073b")}
        </Button>
      )}
      <Text
        style={[
          s.sectionTitle,
          {
            marginVertical: styleToken(
              "profile.marginVertical.6b51d431df",
              "marginVertical",
              12,
            ),
          },
        ]}
      >
        {t("ui.f4718a5b9d")}
      </Text>
      <Text
        style={[
          s.small,
          {
            marginBottom: styleToken(
              "profile.marginBottom.8527a891e2",
              "marginBottom",
              14,
            ),
          },
        ]}
      >
        {t("ui.5aaa821998")}
      </Text>
      <TextInput
        accessibilityLabel={t("ui.be5edee540")}
        placeholder={t("ui.d82e5fe24e")}
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
        maxLength={80}
        style={[
          s.input,
          {
            marginBottom: styleToken(
              "profile.marginBottom.6b51d431df",
              "marginBottom",
              12,
            ),
          },
        ]}
      />
      <TextInput
        accessibilityLabel={t("ui.da78fb91c8")}
        placeholder={t("ui.9b5da3cd47")}
        placeholderTextColor={colors.muted}
        multiline
        value={preferences}
        onChangeText={setPreferences}
        maxLength={1200}
        style={[
          s.input,
          {
            height: styleToken("profile.height.38d66d9692", "height", 130),
            textAlignVertical: "top",
          },
        ]}
      />
      <PreferenceFields
        ids={agentConfig.onboarding.fields
          .filter((f) => f.id !== "name" && f.id !== "preferences")
          .map((f) => f.id)}
        answers={answers}
        onChange={(next) => {
          const edits: PreferenceAnswers = {};
          for (const [id, value] of Object.entries(next))
            if (JSON.stringify(value) !== JSON.stringify(answers[id]))
              edits[id] = value;
          setAnswerEdits((old) => ({ ...old, ...edits }));
        }}
      />
      <Button
        secondary
        style={{
          marginTop: styleToken(
            "profile.marginTop.6b51d431df",
            "marginTop",
            12,
          ),
          marginBottom: styleToken(
            "profile.marginBottom.f5ca38f748",
            "marginBottom",
            20,
          ),
        }}
        onPress={() => {
          const check = validateAnswers(
            { ...answers, name, preferences },
            agentConfig.onboarding.fields,
          );
          if (!check.valid) {
            setError(
              t("preferences.invalid", { fields: check.errors.join(", ") }),
            );
            return;
          }
          update((s) => ({
            ...s,
            profile: {
              ...s.profile,
              answers: mergeEditedAnswers(
                migratePreferences(s.profile, agentConfig).answers,
                answerEdits,
              ),
              name: name.trim(),
              preferences: preferences.trim(),
              updatedAt: Date.now(),
            },
          }));
          setName(undefined);
          setPreferences(undefined);
          setAnswerEdits({});
          setMessage(t("ui.60d6766a9e"));
        }}
      >
        {t("ui.089e57e38f")}
      </Button>
      {agentConfig.features.analytics && (
        <View style={s.panel}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text
              style={[
                s.sectionTitle,
                {
                  fontSize: styleToken(
                    "profile.fontSize.6f4b661212",
                    "fontSize",
                    21,
                  ),
                },
              ]}
            >
              {t("ui.ff5a743c8a")}
            </Text>
            <Switch
              accessibilityLabel={t("ui.d291d8a8c5")}
              value={consent}
              onValueChange={setConsent}
              trackColor={{ true: colors.accent }}
            />
          </View>
          <Text
            style={[
              s.small,
              {
                marginTop: styleToken(
                  "profile.marginTop.4a44dc1536",
                  "marginTop",
                  10,
                ),
              },
            ]}
          >
            {t("ui.de9be6d155")}
          </Text>
        </View>
      )}
      {agentConfig.features.email && <EmailPreferences />}
      <Text
        style={[
          s.sectionTitle,
          {
            marginVertical: styleToken(
              "profile.marginVertical.8527a891e2",
              "marginVertical",
              14,
            ),
          },
        ]}
      >
        {t("ui.8e445e8aa6")}
      </Text>
      {Object.values(state.viewed)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5)
        .map(({ product }) => (
          <Pressable
            key={product.id}
            onPress={() =>
              router.push({
                pathname: "/product/[id]",
                params: { id: product.id },
              })
            }
            style={{
              paddingVertical: styleToken(
                "profile.paddingVertical.6b51d431df",
                "paddingVertical",
                12,
              ),
              borderBottomWidth: styleToken(
                "profile.borderBottomWidth.6b86b273ff",
                "borderBottomWidth",
                1,
              ),
              borderColor: colors.line,
            }}
          >
            <Text style={s.body}>
              {product.title} {t("ui.ca29edb468")}
            </Text>
          </Pressable>
        ))}
      {!Object.keys(state.viewed).length && (
        <Text style={s.small}>{t("ui.563d79dda0")}</Text>
      )}
      <View style={s.divider} />
      <Text style={s.sectionTitle}>{t("ui.92e9274edc")}</Text>
      <Text
        style={[
          s.small,
          {
            marginVertical: styleToken(
              "profile.marginVertical.e629fa6598",
              "marginVertical",
              15,
            ),
          },
        ]}
      >
        {t("ui.4ad1a44243")}
      </Text>
      <Button
        secondary
        onPress={() =>
          confirm(t("ui.acadf500fb"), t("ui.f7b684dad2"), () => {
            clearHistory();
            setMessage(t("ui.1c2c4cc5c8"));
          })
        }
      >
        {t("ui.bb18388c17")}
      </Button>
      {session && (
        <>
          <Button
            secondary
            style={{
              marginTop: styleToken(
                "profile.marginTop.6b51d431df",
                "marginTop",
                12,
              ),
            }}
            onPress={() => {
              void signOut().catch((e) => setError(e.message));
            }}
          >
            {t("ui.48f0d3d397")}
          </Button>
          <Button
            secondary
            disabled={deleting}
            style={{
              marginTop: styleToken(
                "profile.marginTop.6b51d431df",
                "marginTop",
                12,
              ),
            }}
            onPress={() =>
              confirm(
                t("ui.e3b4e71126"),
                t("ui.fecd33c836"),
                () => void deleteAccount(),
              )
            }
          >
            {deleting ? "Deleting…" : t("ui.162730edd0")}
          </Button>
        </>
      )}
      {!!message && (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            s.body,
            {
              marginTop: styleToken(
                "profile.marginTop.e629fa6598",
                "marginTop",
                15,
              ),
            },
          ]}
        >
          {message}
        </Text>
      )}
      {!!error && <Text style={s.error}>{error}</Text>}
      <View style={s.divider} />
      {[
        [t("ui.ba445cff38"), "privacy"],
        [t("ui.e69e061448"), "terms"],
        ["Support", "support"],
      ].map(([label, path]) => (
        <Pressable
          key={path}
          style={{
            paddingVertical: styleToken(
              "profile.paddingVertical.6b51d431df",
              "paddingVertical",
              12,
            ),
          }}
          onPress={() => {
            void Linking.openURL(
              path === "privacy"
                ? agentConfig.brand.privacyUrl
                : path === "terms"
                  ? agentConfig.brand.termsUrl
                  : "mailto:" + agentConfig.brand.supportEmail,
            ).catch(() => setError(t("ui.2a7951b135")));
          }}
        >
          <Text style={s.body}>
            {label} {t("ui.ca29edb468")}
          </Text>
        </Pressable>
      ))}
      <Text
        style={[
          s.small,
          {
            marginTop: styleToken(
              "profile.marginTop.c2356069e9",
              "marginTop",
              24,
            ),
          },
        ]}
      >
        {agentConfig.brand.name}
        {agentConfig.brand.attribution ? " · " + agentConfig.brand.company : ""}
        {"\n"}
        {t("ui.dd167905de")}
        {Application.nativeApplicationVersion ||
          Constants.expoConfig?.version ||
          "0.1.1"}
      </Text>
    </Screen>
  );
}
