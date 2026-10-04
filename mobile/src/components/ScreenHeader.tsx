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
          style={s.iconBtn}
          onPress={handleBack}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" set="feather" size={20} color="#F3F4F6" />
        </Pressable>
      ) : (
        <View style={s.iconBtnPlaceholder} />
      )}

      {/* Center: Title & Subtitle */}
      <View style={s.titleWrap}>
        <AppText variant="label" weight="bold" color="#F3F4F6" align="center" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" color="#9CA3AF" align="center" numberOfLines={1} style={{ fontSize: 11 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {/* Right Action: Language toggle & SOS */}
      <View style={s.rightActions}>
        <Pressable
          style={s.langBtn}
          onPress={toggleLanguage}
          accessibilityLabel="Toggle Language"
        >
          <AppText variant="small" weight="bold" color="#2DD4BF" style={{ fontSize: 12 }}>
            {lang === 'hi' ? 'EN' : 'हिं'}
          </AppText>
        </Pressable>

        {showSOS && (
          <Pressable
            style={s.sosBtn}
            onPress={handleSOS}
            accessibilityLabel="Emergency SOS"
          >
            <AppText variant="small" weight="bold" color="#EF4444" style={{ fontSize: 12 }}>
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
    height: 58,
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
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnPlaceholder: {
    width: 36,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  sosBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    shadowColor: colors.danger,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
});
