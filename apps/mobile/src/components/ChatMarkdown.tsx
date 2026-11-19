import { styleToken } from "../../../../packages/config/src/theme.ts";
import { memo, useMemo } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { chatMarkdown, type Block, type Inline } from "../lib/markdown";
import { colors } from "./ui";
function spans(nodes: Inline[]) {
  return nodes.map((node, index) => (
    <Text
      key={index}
      accessibilityRole={node.kind === "link" && node.href ? "link" : undefined}
      onPress={
        node.kind === "link" && node.href
          ? () => {
              void Linking.openURL(node.href!).catch(() => {});
            }
          : undefined
      }
      style={
        node.kind === "strong"
          ? styles.strong
          : node.kind === "em"
            ? styles.em
            : node.kind === "del"
              ? styles.del
              : node.kind === "code"
                ? styles.inlineCode
                : node.kind === "link" && node.href
                  ? styles.link
                  : undefined
      }
    >
      {node.children ? spans(node.children) : node.text}
    </Text>
  ));
}
function render(blocks: Block[], nested = false) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case "heading":
        return (
          <Text
            key={index}
            selectable
            style={[
              styles.text,
              styles.heading,
              {
                fontSize: block.depth === 1 ? 23 : block.depth === 2 ? 20 : 17,
              },
            ]}
          >
            {spans(block.content || [])}
          </Text>
        );
      case "paragraph":
        return (
          <Text
            key={index}
            selectable
            style={[styles.text, { marginBottom: nested ? 4 : 10 }]}
          >
            {spans(block.content || [])}
          </Text>
        );
      case "list":
        return (
          <View key={index} style={styles.list}>
            {block.items?.map((item, i) => (
              <View key={i} style={styles.item}>
                <Text style={[styles.text, styles.bullet]}>
                  {block.ordered ? `${(block.start || 1) + i}.` : "•"}
                </Text>
                <View style={styles.itemContent}>{render(item, true)}</View>
              </View>
            ))}
          </View>
        );
      case "quote":
        return (
          <View key={index} style={styles.quote}>
            {render(block.blocks || [], true)}
          </View>
        );
      case "code":
        return (
          <Text key={index} selectable style={[styles.text, styles.code]}>
            {block.text}
          </Text>
        );
      case "rule":
        return <View key={index} style={styles.rule} />;
      case "table":
        return (
          <ScrollView
            key={index}
            horizontal
            style={styles.table}
            contentContainerStyle={{ flexDirection: "column" }}
          >
            <View style={styles.tableRow}>
              {block.header?.map((cell, i) => (
                <Text
                  key={i}
                  selectable
                  style={[styles.text, styles.cell, styles.strong]}
                >
                  {spans(cell)}
                </Text>
              ))}
            </View>
            {block.rows?.map((row, i) => (
              <View key={i} style={styles.tableRow}>
                {row.map((cell, j) => (
                  <Text key={j} selectable style={[styles.text, styles.cell]}>
                    {spans(cell)}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
        );
    }
  });
}
export const ChatMarkdown = memo(function ChatMarkdown({
  children,
}: {
  children: string;
}) {
  const blocks = useMemo(() => chatMarkdown(children), [children]);
  return <View style={{ flexShrink: 1 }}>{render(blocks)}</View>;
});
const styles = StyleSheet.create({
  text: {
    fontSize: styleToken("ChatMarkdown.fontSize.8527a891e2", "fontSize", 14),
    lineHeight: styleToken(
      "ChatMarkdown.lineHeight.535fa30d7e",
      "lineHeight",
      23,
    ),
    color: colors.ink,
  },
  strong: { fontWeight: "700" },
  em: { fontStyle: "italic" },
  del: { textDecorationLine: "line-through" },
  heading: {
    fontWeight: "600",
    marginTop: styleToken("ChatMarkdown.marginTop.4a44dc1536", "marginTop", 10),
    marginBottom: styleToken(
      "ChatMarkdown.marginBottom.2c624232cd",
      "marginBottom",
      8,
    ),
    lineHeight: styleToken(
      "ChatMarkdown.lineHeight.35135aaa6c",
      "lineHeight",
      29,
    ),
  },
  link: { color: colors.accent, textDecorationLine: "underline" },
  inlineCode: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: colors.soft,
  },
  code: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: colors.soft,
    padding: styleToken("ChatMarkdown.padding.6b51d431df", "padding", 12),
    borderRadius: styleToken(
      "ChatMarkdown.borderRadius.2c624232cd",
      "borderRadius",
      8,
    ),
    marginBottom: styleToken(
      "ChatMarkdown.marginBottom.4a44dc1536",
      "marginBottom",
      10,
    ),
  },
  list: {
    marginBottom: styleToken(
      "ChatMarkdown.marginBottom.2c624232cd",
      "marginBottom",
      8,
    ),
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: styleToken("ChatMarkdown.gap.2c624232cd", "gap", 8),
    marginBottom: styleToken(
      "ChatMarkdown.marginBottom.4e07408562",
      "marginBottom",
      3,
    ),
  },
  bullet: {
    minWidth: styleToken("ChatMarkdown.minWidth.f5ca38f748", "minWidth", 20),
  },
  itemContent: { flex: 1 },
  quote: {
    borderLeftWidth: 3,
    borderColor: colors.accent,
    paddingLeft: styleToken(
      "ChatMarkdown.paddingLeft.6b51d431df",
      "paddingLeft",
      12,
    ),
    marginVertical: styleToken(
      "ChatMarkdown.marginVertical.2c624232cd",
      "marginVertical",
      8,
    ),
  },
  rule: {
    height: styleToken("ChatMarkdown.height.6b86b273ff", "height", 1),
    backgroundColor: colors.line,
    marginVertical: styleToken(
      "ChatMarkdown.marginVertical.6b51d431df",
      "marginVertical",
      12,
    ),
  },
  table: {
    marginVertical: styleToken(
      "ChatMarkdown.marginVertical.2c624232cd",
      "marginVertical",
      8,
    ),
  },
  tableRow: { flexDirection: "row" },
  cell: {
    width: styleToken("ChatMarkdown.width.734d0759cd", "width", 170),
    padding: styleToken("ChatMarkdown.padding.2c624232cd", "padding", 8),
    borderWidth: styleToken(
      "ChatMarkdown.borderWidth.d2cbad71ff",
      "borderWidth",
      0.5,
    ),
    borderColor: colors.line,
  },
});
