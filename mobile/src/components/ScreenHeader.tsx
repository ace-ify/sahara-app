import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useApp } from '../context/AppContext';
import { colors, space, radius } from '../theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showSOS?: boolean;
  onBack?: () => void;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  showSOS = true,
  onBack,
}: ScreenHeaderProps) {
  const nav = useNavigation<any>();
  const { lang, setLang } = useApp();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (nav.canGoBack()) {
      nav.goBack();
    } else {
      nav.navigate('Home');
    }
  };

  const handleSOS = () => {
    nav.navigate('Emergency');
  };

  const toggleLanguage = () => {
    setLang(lang === 'hi' ? 'en' : 'hi');
  };

  return (
    <View style={s.header}>
      {/* Left Action: Back Arrow */}
      {showBack ? (
        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && s.iconBtnPressed]}
          onPress={handleBack}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" set="feather" size={18} color="#F8FAFC" />
        </Pressable>
      ) : (
        <View style={s.iconBtnPlaceholder} />
      )}

      {/* Center: Title & Subtitle */}
      <View style={s.titleWrap}>
        <AppText variant="label" weight="bold" color="#F8FAFC" align="center" numberOfLines={1} style={{ letterSpacing: -0.2 }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" color={colors.textMuted} align="center" numberOfLines={1} style={{ fontSize: 11, marginTop: 1 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {/* Right Action: Language toggle & SOS */}
      <View style={s.rightActions}>
        <Pressable
          style={({ pressed }) => [s.langBtn, pressed && { opacity: 0.8 }]}
          onPress={toggleLanguage}
          accessibilityLabel="Toggle Language"
        >
          <AppText variant="small" weight="bold" color={colors.brand} style={{ fontSize: 12, letterSpacing: 0.5 }}>
            {lang === 'hi' ? 'EN' : 'हिं'}
          </AppText>
        </Pressable>

        {showSOS && (
          <Pressable
            style={({ pressed }) => [s.sosBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={handleSOS}
            accessibilityLabel="Emergency SOS"
          >
            <AppText variant="small" weight="bold" color="#FFFFFF" style={{ fontSize: 11, letterSpacing: 0.8 }}>
              SOS
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  iconBtnPlaceholder: {
    width: 38,
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(5, 223, 114, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(5, 223, 114, 0.28)',
  },
  sosBtn: {
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(239, 68, 68, 0.90)',
    borderWidth: 1,
    borderColor: '#EF4444',
    shadowColor: colors.danger,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
});
