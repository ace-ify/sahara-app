import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { createCompoundComponent } from './utils';

export interface TProfilePalette {
  surface: string;
  cover: string;
  name: string;
  handle: string;
  bio: string;
  location: string;
  action: string;
  actionLabel: string;
  avatarRing: string;
  outline: string;
}

export const SAHARA_PROFILE_PALETTE: TProfilePalette = {
  surface: '#13192B',
  cover: '#0F172A',
  name: '#F8FAFC',
  handle: '#10B981',
  bio: '#94A3B8',
  location: '#64748B',
  action: 'rgba(16, 185, 129, 0.15)',
  actionLabel: '#34D399',
  avatarRing: '#1E293B',
  outline: 'rgba(255, 255, 255, 0.08)',
};

const CARD_WIDTH = 340;
const CARD_RADIUS = 24;
const OUTLINE_WIDTH = 2;
const COVER_HEIGHT = 90;
const COVER_BOTTOM_RADIUS = 16;
const ACTION_RADIUS = 12;
const AVATAR_SIZE = 56;
const AVATAR_RADIUS = 18;
const AVATAR_RING = 3;
const AVATAR_INSET = 16;
const AVATAR_OVERLAP = 0.45;

const PRESS_SPRING: WithSpringConfig = {
  damping: 18,
  stiffness: 320,
  mass: 0.5,
};

interface IProfileCardContext {
  palette: TProfilePalette;
  coverHeight: number;
  width: number;
  springConfig: WithSpringConfig;
}

const ProfileCardContext = createContext<IProfileCardContext | null>(null);

function useProfileCard(component = 'ProfileCard.Body'): IProfileCardContext {
  const ctx = useContext(ProfileCardContext);
  if (!ctx) {
    throw new Error(`${component} must be rendered inside <ProfileCard>.`);
  }
  return ctx;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface IProfileCardRoot {
  children?: ReactNode;
  palette?: Partial<TProfilePalette>;
  width?: number;
  radius?: number;
  outlineWidth?: number;
  outlineColor?: string;
  coverHeight?: number;
  springConfig?: WithSpringConfig;
  style?: ViewStyle;
}

export interface IProfileCardCover {
  source?: ImageSourcePropType;
  alt?: string;
  children?: ReactNode;
  height?: number;
  bottomRadius?: number;
  style?: ViewStyle;
}

export interface IProfileCardAvatar {
  source?: ImageSourcePropType;
  alt?: string;
  icon?: ReactNode;
  size?: number;
  ringWidth?: number;
  ringColor?: string;
  style?: ViewStyle;
}

export interface IProfileCardAction {
  children?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

export interface IProfileCardSlot {
  children?: ReactNode;
  style?: ViewStyle;
}

export interface IProfileCardText {
  children?: ReactNode;
  style?: TextStyle;
}

const ProfileCardRoot: React.FC<IProfileCardRoot> = ({
  children,
  palette,
  width = CARD_WIDTH,
  radius = CARD_RADIUS,
  outlineWidth = OUTLINE_WIDTH,
  outlineColor,
  coverHeight = COVER_HEIGHT,
  springConfig = PRESS_SPRING,
  style,
}) => {
  const context = useMemo<IProfileCardContext>(
    () => ({
      palette: { ...SAHARA_PROFILE_PALETTE, ...palette },
      coverHeight,
      width,
      springConfig,
    }),
    [palette, coverHeight, width, springConfig]
  );

  return (
    <ProfileCardContext.Provider value={context}>
      <View
        style={[
          styles.root,
          {
            width,
            padding: outlineWidth,
            borderRadius: radius,
            backgroundColor: outlineColor ?? context.palette.outline,
          },
          style,
        ]}
      >
        <View
          style={[
            styles.content,
            {
              borderRadius: radius - outlineWidth,
              backgroundColor: context.palette.surface,
            },
          ]}
        >
          {children}
        </View>
      </View>
    </ProfileCardContext.Provider>
  );
};

const ProfileCardCover: React.FC<IProfileCardCover> = ({
  source,
  children,
  height,
  bottomRadius = COVER_BOTTOM_RADIUS,
  style,
}) => {
  const { palette, coverHeight } = useProfileCard('ProfileCard.Cover');

  return (
    <View
      style={[
        styles.cover,
        {
          height: height ?? coverHeight,
          backgroundColor: palette.cover,
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
        },
        style,
      ]}
    >
      {source && (
        <Image
          source={source}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
};

const ProfileCardAvatar: React.FC<IProfileCardAvatar> = ({
  source,
  icon,
  size = AVATAR_SIZE,
  ringWidth = AVATAR_RING,
  ringColor,
  style,
}) => {
  const { palette } = useProfileCard('ProfileCard.Avatar');

  return (
    <View
      style={[
        styles.avatarRing,
        {
          width: size + ringWidth * 2,
          height: size + ringWidth * 2,
          borderRadius: 999,
          backgroundColor: ringColor ?? palette.avatarRing,
          marginTop: -size * AVATAR_OVERLAP,
          marginLeft: AVATAR_INSET,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: 999,
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
          },
        ]}
      >
        {source ? (
          <Image
            source={source}
            style={{ width: size, height: size, borderRadius: 999 }}
            resizeMode="cover"
          />
        ) : (
          icon
        )}
      </View>
    </View>
  );
};

const ProfileCardBody: React.FC<IProfileCardSlot> = ({ children, style }) => (
  <View style={[styles.body, style]}>{children}</View>
);

const ProfileCardName: React.FC<IProfileCardText> = ({ children, style }) => {
  const { palette } = useProfileCard('ProfileCard.Name');
  return <Text style={[styles.name, { color: palette.name }, style]}>{children}</Text>;
};

const ProfileCardHandle: React.FC<IProfileCardText> = ({ children, style }) => {
  const { palette } = useProfileCard('ProfileCard.Handle');
  return <Text style={[styles.handle, { color: palette.handle }, style]}>{children}</Text>;
};

const ProfileCardBio: React.FC<IProfileCardText> = ({ children, style }) => {
  const { palette } = useProfileCard('ProfileCard.Bio');
  return <Text style={[styles.bio, { color: palette.bio }, style]}>{children}</Text>;
};

const ProfileCardAction: React.FC<IProfileCardAction> = ({
  children,
  onPress,
  style,
  labelStyle,
}) => {
  const { palette, springConfig } = useProfileCard('ProfileCard.Action');
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, springConfig);
  }, [scale, springConfig]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, springConfig);
  }, [scale, springConfig]);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.action,
        {
          backgroundColor: palette.action,
          borderRadius: ACTION_RADIUS,
        },
        animatedStyle,
        style,
      ]}
    >
      <Text style={[styles.actionLabel, { color: palette.actionLabel }, labelStyle]}>
        {children}
      </Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
    marginVertical: 8,
  },
  content: {
    overflow: 'hidden',
  },
  cover: {
    overflow: 'hidden',
    position: 'relative',
    padding: 12,
  },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: AVATAR_INSET,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  handle: {
    fontSize: 13,
    fontWeight: '700',
  },
  bio: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});

const Root = createCompoundComponent('ProfileCard.Root', ProfileCardRoot);
const Cover = createCompoundComponent('ProfileCard.Cover', ProfileCardCover);
const Avatar = createCompoundComponent('ProfileCard.Avatar', ProfileCardAvatar);
const Body = createCompoundComponent('ProfileCard.Body', ProfileCardBody);
const Name = createCompoundComponent('ProfileCard.Name', ProfileCardName);
const Handle = createCompoundComponent('ProfileCard.Handle', ProfileCardHandle);
const Bio = createCompoundComponent('ProfileCard.Bio', ProfileCardBio);
const Action = createCompoundComponent('ProfileCard.Action', ProfileCardAction);

export const ProfileCard = Object.assign(Root, {
  Cover,
  Avatar,
  Body,
  Name,
  Handle,
  Bio,
  Action,
});
