import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Circle, Svg, type CircleProps } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle as any);

export interface ICircularProgress {
  progress: SharedValue<number>;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly outerCircleColor?: string;
  readonly progressCircleColor?: string;
  readonly backgroundColor?: string;
  readonly onPress?: () => void;
  readonly gap?: number;
  readonly renderCenter?: () => React.ReactNode;
}

export const CircularProgress: React.FC<ICircularProgress> = memo<ICircularProgress>(
  ({
    progress,
    size = 72,
    strokeWidth = 6,
    outerCircleColor = 'rgba(255, 255, 255, 0.08)',
    progressCircleColor = '#10B981',
    backgroundColor = 'transparent',
    gap = 2,
    onPress,
    renderCenter,
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circum = radius * 2 * Math.PI;

    const circleAnimatedProps = useAnimatedProps<Pick<CircleProps, 'strokeDashoffset'>>(() => {
      'worklet';
      const progressValue = Math.min(Math.max(progress.value, 0), 100);
      const strokeDashoffset = circum * (1 - progressValue / 100);
      return {
        strokeDashoffset,
      };
    });

    const innerCircleSize = size - strokeWidth * 2 - gap * 2;
    const innerCirclePosition = strokeWidth + gap;

    return (
      <Pressable onPress={onPress}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle
              stroke={outerCircleColor}
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
            />
            <AnimatedCircle
              stroke={progressCircleColor}
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeDasharray={`${circum} ${circum}`}
              strokeLinecap="round"
              transform={`rotate(-90, ${size / 2}, ${size / 2})`}
              strokeWidth={strokeWidth}
              animatedProps={circleAnimatedProps as any}
            />
          </Svg>
          <View
            style={[
              styles.innerCircle,
              {
                width: innerCircleSize,
                height: innerCircleSize,
                backgroundColor,
                top: innerCirclePosition,
                left: innerCirclePosition,
              },
            ]}
          >
            {renderCenter ? renderCenter() : null}
          </View>
        </View>
      </Pressable>
    );
  }
);

const styles = StyleSheet.create({
  innerCircle: {
    position: 'absolute',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
