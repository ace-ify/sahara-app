import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from './ScreenHeader';
import { colors, space } from '../theme';

export function Screen({
  children,
  scroll = true,
  bg = colors.bg,
  padded = true,
  title,
  subtitle,
  showBack = true,
  showSOS = true,
  onBack,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  bg?: string;
  padded?: boolean;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showSOS?: boolean;
  onBack?: () => void;
  style?: ViewStyle;
}) {
  const containerStyle: ViewStyle = {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: padded ? space.lg : 0,
    paddingVertical: padded ? space.md : 0,
    gap: space.md,
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      {title ? (
        <ScreenHeader
          title={title}
          subtitle={subtitle}
          showBack={showBack}
          showSOS={showSOS}
          onBack={onBack}
        />
      ) : null}

      {scroll ? (
        <ScrollView
          contentContainerStyle={[containerStyle, style]}
          showsVerticalScrollIndicator={false}
          style={{ width: '100%' }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[s.flex, containerStyle, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
