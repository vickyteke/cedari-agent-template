import { styleToken } from "../../../../packages/config/src/theme.ts";
import { t } from "../../../../packages/config/src/copy.ts";
import { useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { checkout } from "../lib/api";
import { track } from "../lib/analytics";
import { router } from "expo-router";
import type { CheckoutLink, Product } from "../lib/model";
import { Button, colors, s } from "./ui";

export function ChatCheckoutCard({
  link,
  products = [],
}: {
  link: CheckoutLink;
  products?: Product[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open() {
    setBusy(true);
    setError("");
    try {
      // Saved conversations may contain old links. Recheck the selected items
      // through MCP before opening the merchant's current checkout.
      const fresh = await checkout(
        link.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        link.idempotencyKey,
      );
      if (!fresh.url.startsWith("https://"))
        throw new Error(t("ui.b344f01b89"));
      await Linking.openURL(fresh.url);
      track("checkout_opened", {
        merchant: link.storeKey,
        item_count: link.items.length,
        source: "chat",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ui.85c0c5b9c5"));
      track("checkout_failed", { merchant: link.storeKey, source: "chat" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <View
      style={[
        s.panel,
        {
          marginTop: styleToken(
            "ChatCheckoutCard.marginTop.b17ef6d19c",
            "marginTop",
            16,
          ),
          borderColor: colors.accent,
        },
      ]}
    >
      <Text style={s.eyebrow}>{t("ui.7c6640bda0")}</Text>
      <Text
        style={[
          s.sectionTitle,
          {
            marginBottom: styleToken(
              "ChatCheckoutCard.marginBottom.e629fa6598",
              "marginBottom",
              15,
            ),
          },
        ]}
      >
        {link.merchant}
      </Text>
      {link.items.map((item) => (
        <CheckoutItem
          key={item.productId}
          item={item}
          imageUrl={
            item.imageUrl !== undefined
              ? item.imageUrl
              : products.find((product) => product.id === item.productId)
                  ?.image_url
          }
        />
      ))}
      <Button disabled={busy} onPress={() => void open()}>
        {busy
          ? t("ui.ff2ae18c17")
          : t("dynamic.f7823211c9", { value0: String(link.merchant) })}
      </Button>
      <Text
        style={[
          s.small,
          {
            marginTop: styleToken(
              "ChatCheckoutCard.marginTop.6b51d431df",
              "marginTop",
              12,
            ),
          },
        ]}
      >
        {t("ui.54e365b873")}
      </Text>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

function CheckoutItem({
  item,
  imageUrl,
}: {
  item: CheckoutLink["items"][number];
  imageUrl?: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const currentImage =
    imageUrl?.includes("/api/product-image/") && !imageUrl.includes("?")
      ? `${imageUrl}?variantImage=1`
      : imageUrl;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("dynamic.fd945ae40c", {
        value0: String(item.title),
      })}
      onPress={() =>
        router.push({
          pathname: "/product/[id]",
          params: { id: item.productId },
        })
      }
      style={[
        s.row,
        {
          alignItems: "flex-start",
          gap: styleToken("ChatCheckoutCard.gap.8527a891e2", "gap", 14),
          marginBottom: styleToken(
            "ChatCheckoutCard.marginBottom.f5ca38f748",
            "marginBottom",
            20,
          ),
        },
      ]}
    >
      {currentImage && !imageFailed ? (
        <Image
          source={{ uri: currentImage }}
          accessibilityLabel={item.title}
          onError={() => setImageFailed(true)}
          style={{
            width: styleToken("ChatCheckoutCard.width.8b940be7fb", "width", 88),
            height: styleToken(
              "ChatCheckoutCard.height.9bdb2af679",
              "height",
              110,
            ),
            borderRadius: styleToken(
              "ChatCheckoutCard.borderRadius.4a44dc1536",
              "borderRadius",
              10,
            ),
            backgroundColor: colors.soft,
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: styleToken("ChatCheckoutCard.width.8b940be7fb", "width", 88),
            height: styleToken(
              "ChatCheckoutCard.height.9bdb2af679",
              "height",
              110,
            ),
            borderRadius: styleToken(
              "ChatCheckoutCard.borderRadius.4a44dc1536",
              "borderRadius",
              10,
            ),
            backgroundColor: colors.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={s.small}>{t("ui.b53ea25115")}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            s.body,
            {
              color: colors.ink,
              fontSize: styleToken(
                "ChatCheckoutCard.fontSize.b17ef6d19c",
                "fontSize",
                16,
              ),
              lineHeight: styleToken(
                "ChatCheckoutCard.lineHeight.785f3ec7eb",
                "lineHeight",
                22,
              ),
              marginBottom: styleToken(
                "ChatCheckoutCard.marginBottom.ef2d127de3",
                "marginBottom",
                5,
              ),
            },
          ]}
        >
          {item.title}
        </Text>
        {item.variant &&
          !["Default", t("ui.3dc1541e1a")].includes(item.variant) && (
            <Text
              style={[
                s.small,
                {
                  marginBottom: styleToken(
                    "ChatCheckoutCard.marginBottom.e7f6c01177",
                    "marginBottom",
                    6,
                  ),
                },
              ]}
            >
              {item.variant}
            </Text>
          )}
        <Text style={s.small}>
          {t("ui.d4b2cb9601")}
          {item.quantity}
        </Text>
        <Text style={[s.body, { color: colors.ink }]}>
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: item.currency,
          }).format(item.price)}{" "}
          {t("ui.bec1687971")}
        </Text>
      </View>
    </Pressable>
  );
}
