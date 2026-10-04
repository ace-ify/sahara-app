import React, {
  createRef,
  useRef,
  useState,
  useEffect,
  type FC,
} from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  FadeInDown,
  FadeOutDown,
} from 'react-native-reanimated';

export interface IOtpInput {
  otpCount?: number;
  value?: string;
  onOtpChange?: (otp: string) => void;
  inputWidth?: number;
  inputHeight?: number;
  inputBorderRadius?: number;
  unfocusedBorderColor?: string;
  focusedBorderColor?: string;
  unfocusedBackgroundColor?: string;
  focusedBackgroundColor?: string;
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  error?: boolean;
}

export const OtpInput: FC<IOtpInput> = ({
  otpCount = 6,
  value = '',
  onOtpChange,
  inputWidth = 46,
  inputHeight = 54,
  inputBorderRadius = 14,
  unfocusedBorderColor = 'rgba(255, 255, 255, 0.12)',
  focusedBorderColor = '#10B981',
  unfocusedBackgroundColor = 'rgba(255, 255, 255, 0.04)',
  focusedBackgroundColor = 'rgba(16, 185, 129, 0.08)',
  containerStyle,
  textStyle,
  error = false,
}) => {
  const [digits, setDigits] = useState<string[]>(() => {
    const arr = new Array(otpCount).fill('');
    if (value) {
      for (let i = 0; i < Math.min(value.length, otpCount); i++) {
        arr[i] = value[i];
      }
    }
    return arr;
  });

  const [activeFocus, setActiveFocus] = useState<number>(0);
  const inputRefs = useRef<Array<React.RefObject<TextInput | null>>>(
    Array.from({ length: otpCount }, () => createRef<TextInput>())
  );

  useEffect(() => {
    if (value !== undefined) {
      const arr = new Array(otpCount).fill('');
      for (let i = 0; i < Math.min(value.length, otpCount); i++) {
        arr[i] = value[i];
      }
      setDigits(arr);
    }
  }, [value, otpCount]);

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) {
      // Pasted full code
      const pasted = text.slice(0, otpCount).split('');
      const newDigits = [...digits];
      pasted.forEach((char, i) => {
        if (i < otpCount) newDigits[i] = char;
      });
      setDigits(newDigits);
      onOtpChange?.(newDigits.join(''));
      Keyboard.dismiss();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = text;
    setDigits(newDigits);
    onOtpChange?.(newDigits.join(''));

    if (text && index < otpCount - 1) {
      inputRefs.current[index + 1]?.current?.focus();
      setActiveFocus(index + 1);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.current?.focus();
        setActiveFocus(index - 1);
      }
    }
  };

  return (
    <View style={[styles.row, containerStyle]}>
      {Array.from({ length: otpCount }).map((_, index) => {
        const isFocused = activeFocus === index;
        return (
          <Pressable
            key={index}
            onPress={() => {
              inputRefs.current[index]?.current?.focus();
              setActiveFocus(index);
            }}
            style={styles.cell}
          >
            <TextInput
              ref={inputRefs.current[index] as any}
              style={[
                styles.nativeInput,
                {
                  width: inputWidth,
                  height: inputHeight,
                  borderRadius: inputBorderRadius,
                  borderColor: error
                    ? '#EF4444'
                    : isFocused
                    ? focusedBorderColor
                    : unfocusedBorderColor,
                  backgroundColor: error
                    ? 'rgba(239, 68, 68, 0.08)'
                    : isFocused
                    ? focusedBackgroundColor
                    : unfocusedBackgroundColor,
                },
              ]}
              maxLength={1}
              keyboardType="number-pad"
              value={digits[index]}
              onChangeText={(t) => handleChange(t, index)}
              onKeyPress={(e) => handleKeyPress(e.nativeEvent.key, index)}
              onFocus={() => setActiveFocus(index)}
              caretHidden
            />
            <View pointerEvents="none" style={styles.digitOverlay}>
              {digits[index] ? (
                <Animated.Text
                  entering={FadeInDown.duration(180)}
                  exiting={FadeOutDown.duration(120)}
                  style={[styles.digitText, textStyle]}
                >
                  {digits[index]}
                </Animated.Text>
              ) : isFocused ? (
                <View style={styles.cursorPill} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  cell: {
    position: 'relative',
  },
  nativeInput: {
    borderWidth: 1.5,
    textAlign: 'center',
    color: 'transparent',
  },
  digitOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  cursorPill: {
    width: 2,
    height: 20,
    backgroundColor: '#10B981',
    borderRadius: 1,
  },
});
