import { styleToken } from "../../../../../packages/config/src/theme.ts";
import { t } from "../../../../../packages/config/src/copy.ts";
import { agentConfig } from "../../../../../packages/config/src/public.ts";
/* eslint-disable react-hooks/set-state-in-effect -- These effects synchronize loading and error status with an external catalog request. */
import { useEffect, useState } from "react";
import { Image, Linking, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { catalog } from "../../lib/api";
import { price, merchantName, type Product } from "../../lib/model";
import { useShopper } from "../../lib/store";
import { track } from "../../lib/analytics";
import {
  Back,
  Button,
  colors,
  Heading,
  IconButton,
  Loading,
  s,
  Screen,
} from "../../components/ui";
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, update, save, bag } = useShopper();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [added, setAdded] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    void catalog({ ids: id })
      .then(({ products }) => {
        const p = products[0];
        if (!p) throw new Error(t("ui.258929a0cd"));
        if (alive) {
          setProduct(p);
          update((s) => ({
            ...s,
            viewed: Object.fromEntries(
              Object.entries({
                ...s.viewed,
                [p.id]: { product: p, updatedAt: Date.now() },
              })
                .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
                .slice(0, 80),
            ),
          }));
          track("product_viewed", { product_id: p.id, merchant: p.store_key });
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    }; /* update intentionally uses the provider's current state */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retry]);
  return (
    <Screen name="product">
      <Back title={t("ui.e7a1fd07ad")} />
      {busy ? (
        <Loading />
      ) : error ? (
        <>
          <Text style={s.error}>{error}</Text>
          <Button secondary onPress={() => setRetry((v) => v + 1)}>
            {t("ui.d8b8392e2c")}
          </Button>
        </>
      ) : (
        product && (
          <>
            {product.image_url && (
              <Image
                source={{ uri: product.image_url }}
                style={{
                  width: "100%",
                  aspectRatio: styleToken(
                    "[id].aspectRatio.8139b33952",
                    "aspectRatio",
                    0.9,
                  ),
                  borderRadius: styleToken(
                    "[id].borderRadius.f5ca38f748",
                    "borderRadius",
                    20,
                  ),
                  backgroundColor: colors.soft,
                  marginTop: styleToken(
                    "[id].marginTop.f5ca38f748",
                    "marginTop",
                    20,
                  ),
                  marginBottom: styleToken(
                    "[id].marginBottom.b7a56873cd",
                    "marginBottom",
                    25,
                  ),
                }}
                resizeMode="cover"
              />
            )}
            <Heading eyebrow={merchantName(product)} title={product.title} />
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={s.sectionTitle}>{price(product)}</Text>
              {agentConfig.features.saved && (
                <IconButton
                  name="heart"
                  label={t("ui.ce9c3547bf")}
                  onPress={() => save(product)}
                  filled={state.saved[product.id]?.active}
                  color={colors.accent}
                />
              )}
            </View>
            {!!product.variant_title &&
              product.variant_title !== t("ui.3dc1541e1a") && (
                <Text
                  style={[
                    s.body,
                    {
                      marginVertical: styleToken(
                        "[id].marginVertical.4a44dc1536",
                        "marginVertical",
                        10,
                      ),
                    },
                  ]}
                >
                  {t("ui.d78933e0cf")}
                  {product.variant_title}
                </Text>
              )}
            <Text
              style={[
                s.body,
                {
                  marginVertical: styleToken(
                    "[id].marginVertical.785f3ec7eb",
                    "marginVertical",
                    22,
                  ),
                },
              ]}
            >
              {product.description
                ?.replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim() || t("ui.edfa011747")}
            </Text>
            {agentConfig.features.checkout && (
              <Button
                disabled={!product.available}
                onPress={() => {
                  bag(product, (state.bag[product.id]?.quantity || 0) + 1);
                  setAdded(true);
                }}
              >
                {!product.available
                  ? t("ui.3848efcfec")
                  : added
                    ? t("ui.250c100833")
                    : t("ui.39af9159d9")}
              </Button>
            )}
            <Button
              secondary
              disabled={!product.product_url}
              style={{
                marginTop: styleToken(
                  "[id].marginTop.6b51d431df",
                  "marginTop",
                  12,
                ),
              }}
              onPress={() => {
                void Linking.openURL(product.product_url!).catch(() =>
                  setError(t("ui.7a425d7289")),
                );
              }}
            >
              {t("ui.66d0d4375f")}
              {merchantName(product)} {t("ui.ca29edb468")}
            </Button>
            <Text
              style={[
                s.small,
                {
                  marginTop: styleToken(
                    "[id].marginTop.f5ca38f748",
                    "marginTop",
                    20,
                  ),
                },
              ]}
            >
              {t("ui.0dddd3deba")}
              {merchantName(product)}
              {t("ui.77bb0c51a8")}
            </Text>
          </>
        )
      )}
    </Screen>
  );
}
