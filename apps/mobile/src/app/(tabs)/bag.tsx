import { styleToken } from "../../../../../packages/config/src/theme.ts";
import { t } from "../../../../../packages/config/src/copy.ts";
import { useState } from "react";
import { Image, Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { checkout } from "../../lib/api";
import { groupBag, price, merchantName } from "../../lib/model";
import { track } from "../../lib/analytics";
import { useShopper } from "../../lib/store";
import {
  Button,
  colors,
  Empty,
  Heading,
  IconButton,
  s,
  Screen,
} from "../../components/ui";
export default function BagScreen() {
  const { state, bag } = useShopper();
  const groups = groupBag(state);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function openCheckout(merchant: string) {
    setBusy(merchant);
    setError("");
    try {
      const { url } = await checkout(
        groups[merchant].map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      );
      if (!url.startsWith("https://")) throw new Error(t("ui.0a53bbbedb"));
      await Linking.openURL(url);
      track("checkout_opened", {
        merchant,
        item_count: groups[merchant].length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ui.6b758b7cdf"));
      track("checkout_failed", { merchant });
    } finally {
      setBusy("");
    }
  }
  return (
    <Screen name="bag">
      <Heading eyebrow={t("ui.59d5c3a26a")} title={t("ui.3f9c7ea9f5")} />
      <Text
        style={[
          s.body,
          {
            marginBottom: styleToken(
              "bag.marginBottom.b7a56873cd",
              "marginBottom",
              25,
            ),
          },
        ]}
      >
        {t("ui.bc10deaaa9")}
      </Text>
      {Object.entries(groups).map(([merchant, items]) => (
        <View key={merchant} style={s.panel}>
          <Text
            style={[
              s.sectionTitle,
              {
                marginBottom: styleToken(
                  "bag.marginBottom.4ec9599fc2",
                  "marginBottom",
                  18,
                ),
              },
            ]}
          >
            {merchantName(items[0].product)}
          </Text>
          {items.map(({ product, quantity }) => (
            <View
              key={product.id}
              style={{
                marginBottom: styleToken(
                  "bag.marginBottom.f5ca38f748",
                  "marginBottom",
                  20,
                ),
              }}
            >
              <View style={[s.row, { alignItems: "flex-start" }]}>
                {product.image_url && (
                  <Image
                    source={{ uri: product.image_url }}
                    style={{
                      width: styleToken("bag.width.3ada92f28b", "width", 66),
                      height: styleToken("bag.height.48449a14a4", "height", 80),
                      borderRadius: styleToken(
                        "bag.borderRadius.2c624232cd",
                        "borderRadius",
                        8,
                      ),
                      backgroundColor: colors.soft,
                    }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: styleToken(
                        "bag.fontSize.8527a891e2",
                        "fontSize",
                        14,
                      ),
                      lineHeight: styleToken(
                        "bag.lineHeight.6f4b661212",
                        "lineHeight",
                        21,
                      ),
                    }}
                  >
                    {product.title}
                  </Text>
                  {product.variant_title &&
                    product.variant_title !== t("ui.3dc1541e1a") && (
                      <Text style={s.small}>{product.variant_title}</Text>
                    )}
                  <Text style={s.body}>{price(product)}</Text>
                  <View style={s.row}>
                    <Button
                      secondary
                      onPress={() => bag(product, quantity - 1)}
                      style={{
                        minHeight: styleToken(
                          "bag.minHeight.86e5014965",
                          "minHeight",
                          34,
                        ),
                        paddingHorizontal: styleToken(
                          "bag.paddingHorizontal.8527a891e2",
                          "paddingHorizontal",
                          14,
                        ),
                      }}
                    >
                      {t("ui.afba2418d6")}
                    </Button>
                    <Text>{quantity}</Text>
                    <Button
                      secondary
                      disabled={quantity >= 20}
                      onPress={() => bag(product, quantity + 1)}
                      style={{
                        minHeight: styleToken(
                          "bag.minHeight.86e5014965",
                          "minHeight",
                          34,
                        ),
                        paddingHorizontal: styleToken(
                          "bag.paddingHorizontal.8527a891e2",
                          "paddingHorizontal",
                          14,
                        ),
                      }}
                    >
                      {t("ui.a318c24216")}
                    </Button>
                    <IconButton
                      name="close"
                      label={t("dynamic.3028bf7d2d", {
                        value0: String(product.title),
                      })}
                      onPress={() => bag(product, 0)}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}
          <Text
            style={[
              s.small,
              {
                marginBottom: styleToken(
                  "bag.marginBottom.6b51d431df",
                  "marginBottom",
                  12,
                ),
              },
            ]}
          >
            {t("ui.0d20dd69b8")}
          </Text>
          <Button disabled={!!busy} onPress={() => void openCheckout(merchant)}>
            {busy === merchant
              ? t("ui.1574841e9c")
              : t("dynamic.4a59ef4750", {
                  value0: String(merchantName(items[0].product)),
                })}
          </Button>
        </View>
      ))}
      {!!error && <Text style={s.error}>{error}</Text>}
      {!Object.keys(groups).length && (
        <Empty
          title={t("ui.2fa888ebd5")}
          detail={t("ui.12c29de56c")}
          action={t("ui.9d6366b50a")}
          onPress={() => router.push("/discover")}
        />
      )}
    </Screen>
  );
}
