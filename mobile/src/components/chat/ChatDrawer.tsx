import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Animated, ScrollView, Easing } from 'react-native';
import { AppText } from '../AppText';
import { Icon } from '../Icon';
import { colors } from '../../theme';
import { useApp } from '../../context/AppContext';
import { PressableScale } from '../PressableScale';
import { ChatSession, getChatSessions, deleteChatSession } from '../../services/chatStorage';

interface ChatDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
  onNavigateScreen: (screenName: string) => void;
  onNewChat: () => void;
  onSelectSession?: (sessionId: string) => void;
  activeSessionId?: string | null;
}

export function ChatDrawer({
  visible,
  onClose,
  onSelectPrompt,
  onNavigateScreen,
  onNewChat,
  onSelectSession,
  activeSessionId,
}: ChatDrawerProps) {
  const { t, lang } = useApp();
  const progress = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      getChatSessions().then(setSessions).catch(() => {});
    }
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!visible && finished) setRendered(false);
    });
  }, [visible, progress]);

  const slide = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-380, 0],
    extrapolate: 'clamp',
  });
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (!rendered) return null;

  const menu = [
    { id: 'ai', label: t('feat_ai'), icon: 'message-circle', set: 'feather', go: () => onClose() },
    { id: 'meds', label: t('feat_meds'), icon: 'pill', set: 'mci', go: () => { onClose(); onNavigateScreen('Meds'); } },
    { id: 'prescription', label: t('feat_scanner') || 'पर्चा व बिल स्कैनर', icon: 'camera', set: 'feather', go: () => { onClose(); onNavigateScreen('PrescriptionScanner'); } },
    { id: 'vitals', label: t('feat_vitals'), icon: 'heart-pulse', set: 'mci', go: () => { onClose(); onNavigateScreen('Vitals'); } },
    { id: 'emergency', label: t('feat_emergency'), icon: 'alert-triangle', set: 'feather', go: () => { onClose(); onNavigateScreen('Emergency'); } },
    { id: 'caregiver', label: t('feat_caregiver'), icon: 'users', set: 'feather', go: () => { onClose(); onNavigateScreen('CaregiverPairing'); } },
  ];

  const handleDelete = async (id: string, e: any) => {
    e.stopPropagation();
    await deleteChatSession(id);
    const updated = await getChatSessions();
    setSessions(updated);
  };

  return (
    <View style={s.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[s.panel, { transform: [{ translateX: slide }] }]}>
        {/* Title + New chat button */}
        <View style={s.topRow}>
          <AppText variant="h1" weight="bold" color={colors.text} style={{ fontSize: 26 }}>
            Sahārā
          </AppText>
          <PressableScale style={s.searchCircle} onPress={onNewChat}>
            <Icon name="edit" set="feather" size={18} color={colors.white} />
          </PressableScale>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Feature rows */}
          {menu.map((item) => (
            <PressableScale key={item.id} style={s.menuRow} onPress={item.go}>
              <Icon name={item.icon} set={item.set as any} size={22} color={colors.text} />
              <AppText variant="body" color={colors.text} style={{ fontSize: 17 }}>
                {item.label}
              </AppText>
            </PressableScale>
          ))}

          <View style={s.divider} />

          {/* Real Saved Chat Sessions */}
          <View style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
            <AppText variant="small" weight="bold" color={colors.textMuted} style={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11 }}>
              {lang === 'hi' ? 'हाल की बातचीत (Saved Chats)' : 'Recent Chats'}
            </AppText>
          </View>

          {sessions.length === 0 ? (
            <View style={{ padding: 14 }}>
              <AppText variant="small" color={colors.textMuted}>
                {lang === 'hi' ? 'अभी कोई पुरानी बातचीत सेव नहीं है।' : 'No saved chat conversations yet.'}
              </AppText>
            </View>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              const dateStr = new Date(sess.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <PressableScale
                  key={sess.id}
                  style={[s.recentRow, isActive && s.recentRowActive]}
                  onPress={() => {
                    if (onSelectSession) onSelectSession(sess.id);
                    onClose();
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" color={isActive ? colors.brand : colors.text} numberOfLines={1} style={{ fontSize: 15 }}>
                      {sess.title || (lang === 'hi' ? 'स्वास्थ्य बातचीत' : 'Health Conversation')}
                    </AppText>
                    <AppText variant="small" color={colors.textMuted} style={{ fontSize: 11, marginTop: 2 }}>
                      {dateStr} · {sess.messages.length} संदेश
                    </AppText>
                  </View>
                  <Pressable onPress={(e) => handleDelete(sess.id, e)} hitSlop={10} style={{ padding: 4 }}>
                    <Icon name="x" set="feather" size={14} color={colors.textMuted} />
                  </Pressable>
                </PressableScale>
              );
            })
          )}
        </ScrollView>

        {/* Bottom: New chat pill + avatar */}
        <View style={s.footer}>
          <PressableScale style={s.newChatPill} onPress={onNewChat}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="plus" set="feather" size={18} color={colors.black} />
              <AppText variant="label" weight="bold" color={colors.black}>
                {t('talk_new_chat')}
              </AppText>
            </View>
          </PressableScale>

          <PressableScale style={s.avatar} onPress={() => { onClose(); onNavigateScreen('Profile'); }}>
            <AppText variant="label" weight="bold" color={colors.white}>⚙️</AppText>
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, flexDirection: 'row' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: {
    width: '80%',
    maxWidth: 360,
    height: '100%',
    backgroundColor: colors.surface,
    paddingTop: 52,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  searchCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 10, paddingBottom: 20 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10, marginHorizontal: 10 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  recentRowActive: { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 26,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  newChatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
