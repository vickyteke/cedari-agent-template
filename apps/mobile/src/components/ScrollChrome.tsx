import { styleToken } from "../../../../packages/config/src/theme.ts";
import { theme } from "../../../../packages/config/src/public.ts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createScrollDirection } from "../lib/scroll-direction";

const duration = theme.motion.duration;
const ChromeContext = createContext<{
  hidden: boolean;
  keyboard: boolean;
  reduceMotion: boolean;
  activeTab: string;
  selectTab: (name: string) => void;
  setHidden: (hidden: boolean) => void;
  isAnimating: () => boolean;
} | null>(null);

export function ScrollChromeProvider({ children }: { children: ReactNode }) {
  const [hidden, updateHidden] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const selectTab = useCallback((name: string) => {
    if (name === "chat") setActiveTab("chat");
    else if (["discover", "saved", "bag", "profile"].includes(name))
      setActiveTab(name);
  }, []);
  const [keyboard, setKeyboard] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const current = useRef(false);
  const until = useRef(0);
  const setHidden = useCallback((next: boolean) => {
    if (current.current === next) return;
    current.current = next;
    until.current = Date.now() + duration + 40;
    updateHidden(next);
  }, []);
  const isAnimating = useCallback(() => Date.now() < until.current, []);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboard(true);
      setHidden(false);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false),
    );
    return () => {
      mounted = false;
      motion.remove();
      show.remove();
      hide.remove();
    };
  }, [setHidden]);
  const value = useMemo(
    () => ({
      hidden,
      keyboard,
      reduceMotion,
      activeTab,
      selectTab,
      setHidden,
      isAnimating,
    }),
    [
      hidden,
      keyboard,
      reduceMotion,
      activeTab,
      selectTab,
      setHidden,
      isAnimating,
    ],
  );
  return (
    <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>
  );
}

function CollapsingBar({
  hidden,
  reduceMotion,
  height,
  children,
  direction,
}: {
  hidden: boolean;
  reduceMotion: boolean;
  height: number;
  children: ReactNode;
  direction: -1 | 1;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: hidden ? 1 : 0,
      duration: reduceMotion || !theme.motion.enabled ? 0 : duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [hidden, reduceMotion, progress]);
  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "auto"}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      style={{
        overflow: "hidden",
        height: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [height, 0],
        }),
      }}
    >
      <Animated.View
        style={{
          height,
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, direction * height],
              }),
            },
          ],
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

export function ScrollHeader({ children }: { children: ReactNode }) {
  const chrome = useContext(ChromeContext);
  const [height, setHeight] = useState(67);
  if (!chrome) return <>{children}</>;
  return (
    <CollapsingBar
      hidden={chrome.hidden}
      reduceMotion={chrome.reduceMotion}
      height={height}
      direction={-1}
    >
      <View onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        {children}
      </View>
    </CollapsingBar>
  );
}

const floatingBarHeight = theme.navigation.height;
const floatingBarGap = 12;

export function FloatingTabBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const chrome = useContext(ChromeContext);
  const [scale] = useState(() => new Animated.Value(1));
  const compact = chrome?.hidden ?? false;
  const reduceMotion = chrome?.reduceMotion ?? true;
  useEffect(() => {
    const animation = Animated.timing(scale, {
      toValue: compact ? theme.motion.compactScale : 1,
      duration: reduceMotion || !theme.motion.enabled ? 0 : duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [compact, reduceMotion, scale]);
  // The capsule stays available while scrolling. Only the keyboard hides it,
  // leaving the composer and the system keyboard clear of navigation controls.
  if (chrome?.keyboard) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        paddingBottom: Math.max(insets.bottom, floatingBarGap),
      }}
    >
      <Animated.View
        style={{
          width: "92%",
          maxWidth: theme.navigation.maxWidth,
          height: floatingBarHeight,
          borderRadius: theme.navigation.radius,
          backgroundColor: styleToken(
            "ScrollChrome.backgroundColor.09daa71dc2",
            "backgroundColor",
            "rgba(255,252,248,0.82)",
          ),
          flexDirection: "row",
          paddingHorizontal: styleToken(
            "ScrollChrome.paddingHorizontal.e7f6c01177",
            "paddingHorizontal",
            6,
          ),
          alignItems: "center",
          borderWidth: styleToken(
            "ScrollChrome.borderWidth.6b86b273ff",
            "borderWidth",
            1,
          ),
          borderColor: styleToken(
            "ScrollChrome.borderColor.28e2f381d3",
            "borderColor",
            "rgba(255,255,255,0.8)",
          ),
          shadowColor: "#35271f",
          shadowOffset: {
            width: styleToken("ScrollChrome.width.5feceb66ff", "width", 0),
            height: styleToken("ScrollChrome.height.4b227777d4", "height", 4),
          },
          shadowOpacity: theme.shadowOpacity,
          shadowRadius: styleToken(
            "ScrollChrome.shadowRadius.b17ef6d19c",
            "shadowRadius",
            16,
          ),
          elevation: styleToken(
            "ScrollChrome.elevation.2c624232cd",
            "elevation",
            8,
          ),
          // Keep the lower edge in place as the whole capsule scales to 75%.
          transform: [
            {
              translateY: scale.interpolate({
                inputRange: [theme.motion.compactScale, 1],
                outputRange: [
                  (floatingBarHeight * (1 - theme.motion.compactScale)) / 2,
                  0,
                ],
              }),
            },
            { scale },
          ],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export function useScrollChrome() {
  const chrome = useContext(ChromeContext);
  const insets = useSafeAreaInsets();
  const bottomSpace =
    chrome && !chrome.keyboard
      ? floatingBarHeight +
        Math.max(insets.bottom, floatingBarGap) +
        floatingBarGap
      : 0;
  const tracker = useRef(createScrollDirection());
  const setHidden = chrome?.setHidden;
  const show = useCallback(() => {
    tracker.current.reset();
    setHidden?.(false);
  }, [setHidden]);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const action = tracker.current.observe(
      contentOffset.y,
      layoutMeasurement.height,
      contentSize.height,
      chrome?.isAnimating(),
    );
    if (action) chrome?.setHidden(action === "hide");
  };
  return {
    show,
    bottomSpace,
    activeTab: chrome?.activeTab ?? "chat",
    selectTab: chrome?.selectTab,
    onScroll,
    onScrollBeginDrag: () => tracker.current.start(),
    onScrollEndDrag: () => tracker.current.end(),
    onMomentumScrollBegin: () => tracker.current.start(),
    onMomentumScrollEnd: () => tracker.current.end(),
  };
}
