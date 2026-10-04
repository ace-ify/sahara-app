import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  type WithSpringConfig,
  type SharedValue,
} from 'react-native-reanimated';
import { createCompoundComponent } from './utils';

interface FlipCardContextValue {
  isFlipped: boolean;
  flip: () => void;
  width: number;
  height: number;
  borderRadius: number;
  progress: SharedValue<number>;
  scale: SharedValue<number>;
}

const FlipCardContext = createContext<FlipCardContextValue | null>(null);

const DEFAULT_SPRING: WithSpringConfig = {
  damping: 16,
  stiffness: 180,
  mass: 0.6,
};

const PRESS_SPRING: WithSpringConfig = {
  damping: 18,
  stiffness: 320,
  mass: 0.5,
};

function useFlipCard(component = 'FlipCard.Front'): FlipCardContextValue {
  const ctx = useContext(FlipCardContext);
  if (!ctx) {
    throw new Error(`${component} must be rendered inside <FlipCard>.`);
  }
  return ctx;
}

export interface IFlipCardRoot {
  children?: ReactNode;
  width?: number;
  height?: number;
  borderRadius?: number;
  containerStyle?: ViewStyle;
  onFlip?: (flipped: boolean) => void;
}

const FlipCardRoot: React.FC<IFlipCardRoot> = ({
  children,
  width = 330,
  height = 190,
  borderRadius = 20,
  containerStyle,
  onFlip,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);

  const flip = useCallback(() => {
    const next = !isFlipped;
    setIsFlipped(next);
    progress.value = withSpring(next ? 1 : 0, DEFAULT_SPRING);
    onFlip?.(next);
  }, [isFlipped, onFlip, progress]);

  const value = useMemo(
    () => ({
      isFlipped,
      flip,
      width,
      height,
      borderRadius,
      progress,
      scale,
    }),
    [isFlipped, flip, width, height, borderRadius, progress, scale]
  );

  return (
    <FlipCardContext.Provider value={value}>
      <View style={[styles.container, { width, height }, containerStyle]}>
        {children}
      </View>
    </FlipCardContext.Provider>
  );
};

export interface IFlipCardFace {
  children?: ReactNode;
  style?: ViewStyle;
}

const FlipCardFront: React.FC<IFlipCardFace> = memo(({ children, style }) => {
  const { progress, scale, width, height, borderRadius, isFlipped } = useFlipCard('FlipCard.Front');

  const animatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(progress.value, [0, 1], [0, 180]);
    return {
      transform: [
        { perspective: 1000 },
        { scale: scale.value },
        { rotateY: `${rotateValue}deg` },
      ],
      opacity: progress.value < 0.5 ? 1 : 0,
      zIndex: progress.value < 0.5 ? 1 : 0,
    };
  });

  return (
    <Animated.View
      pointerEvents={!isFlipped ? 'auto' : 'none'}
      style={[styles.card, { width, height, borderRadius }, animatedStyle, style]}
    >
      {children}
    </Animated.View>
  );
});

const FlipCardBack: React.FC<IFlipCardFace> = memo(({ children, style }) => {
  const { progress, scale, width, height, borderRadius, isFlipped } = useFlipCard('FlipCard.Back');

  const animatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(progress.value, [0, 1], [180, 360]);
    return {
      transform: [
        { perspective: 1000 },
        { scale: scale.value },
        { rotateY: `${rotateValue}deg` },
      ],
      opacity: progress.value >= 0.5 ? 1 : 0,
      zIndex: progress.value >= 0.5 ? 1 : 0,
    };
  });

  return (
    <Animated.View
      pointerEvents={isFlipped ? 'auto' : 'none'}
      style={[styles.card, { width, height, borderRadius }, animatedStyle, style]}
    >
      {children}
    </Animated.View>
  );
});

export interface IFlipCardTrigger {
  children?: ReactNode;
  style?: ViewStyle;
}

const FlipCardTrigger: React.FC<IFlipCardTrigger> = memo(({ children, style }) => {
  const { flip, scale } = useFlipCard('FlipCard.Trigger');

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.96, PRESS_SPRING);
  }, [scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);

  return (
    <Pressable onPress={flip} onPressIn={onPressIn} onPressOut={onPressOut} style={style}>
      {children}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
});

const Root = createCompoundComponent('FlipCard.Root', FlipCardRoot);
const Front = createCompoundComponent('FlipCard.Front', FlipCardFront);
const Back = createCompoundComponent('FlipCard.Back', FlipCardBack);
const Trigger = createCompoundComponent('FlipCard.Trigger', FlipCardTrigger);

export const FlipCard = Object.assign(Root, {
  Front,
  Back,
  Trigger,
});
