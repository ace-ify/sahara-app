import React, {
  createContext,
  useContext,
  useMemo,
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createCompoundComponent } from './utils';

export interface TReceiptPalette {
  paper: string;
  ink: string;
  muted: string;
  rule: string;
  leader: string;
  accent: string;
}

const MONO_FONT = Platform.select<string>({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const DEFAULT_PALETTE: TReceiptPalette = {
  paper: '#FFFFFF',
  ink: '#18181B',
  muted: '#71717A',
  rule: '#D4D4D8',
  leader: '#A1A1AA',
  accent: '#059669', // Emerald accent for Sahara health
};

export const DARK_PALETTE: TReceiptPalette = {
  paper: '#13192B',
  ink: '#F1F5F9',
  muted: '#94A3B8',
  rule: 'rgba(255, 255, 255, 0.12)',
  leader: 'rgba(255, 255, 255, 0.25)',
  accent: '#10B981',
};

const PAPER_WIDTH = 320;
const PAPER_PADDING = 18;
const TEETH_WIDTH = 18;
const TEETH_HEIGHT = 9;
const BAR_COUNT = 28;
const BARCODE_HEIGHT = 28;
const BARCODE_WIDTH = 150;

interface IReceiptCardContext {
  palette: TReceiptPalette;
  fontFamily: string;
  width: number;
}

const ReceiptCardContext = createContext<IReceiptCardContext | null>(null);

function useReceiptCard(component = 'ReceiptCard.Item'): IReceiptCardContext {
  const ctx = useContext(ReceiptCardContext);
  if (!ctx) {
    throw new Error(`${component} must be rendered inside <ReceiptCard>.`);
  }
  return ctx;
}

export interface IReceiptCardRoot {
  children?: ReactNode;
  palette?: Partial<TReceiptPalette>;
  dark?: boolean;
  width?: number;
  tilted?: boolean;
  style?: ViewStyle;
  paperStyle?: ViewStyle;
}

export interface IReceiptCardSlot {
  children?: ReactNode;
  style?: ViewStyle;
}

export interface IReceiptCardText {
  children?: ReactNode;
  style?: TextStyle;
}

export interface IReceiptCardSeparator {
  variant?: 'solid' | 'dashed' | 'dotted';
  color?: string;
  style?: ViewStyle;
}

export interface IReceiptCardItem {
  label: string;
  value: string;
  sublabel?: string;
  leader?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  valueStyle?: TextStyle;
}

export interface IReceiptCardTotal {
  label?: string;
  value: string;
  saving?: string;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  valueStyle?: TextStyle;
}

export interface IReceiptCardBarcode {
  code: string;
  showCode?: boolean;
  height?: number;
  width?: number;
  color?: string;
  style?: ViewStyle;
  codeStyle?: TextStyle;
}

export interface IReceiptCardTornEdge {
  side?: 'top' | 'bottom';
  toothWidth?: number;
  toothHeight?: number;
  color?: string;
  style?: ViewStyle;
}

const EDGE_ROLE = 'edge';

const isEdge = (child: ReactNode): child is ReactElement<IReceiptCardTornEdge> =>
  isValidElement(child) && (child.type as { role?: string })?.role === EDGE_ROLE;

const ReceiptCardRoot: React.FC<IReceiptCardRoot> = ({
  children,
  palette,
  dark = false,
  width = PAPER_WIDTH,
  tilted = false,
  style,
  paperStyle,
}) => {
  const basePalette = dark ? DARK_PALETTE : DEFAULT_PALETTE;
  const context = useMemo<IReceiptCardContext>(
    () => ({
      palette: { ...basePalette, ...palette },
      fontFamily: MONO_FONT,
      width,
    }),
    [basePalette, palette, width]
  );

  const { topEdge, bottomEdge, body } = useMemo(() => {
    let top: ReactNode = null;
    let bottom: ReactNode = null;
    const rest: ReactNode[] = [];

    Children.forEach(children, (child) => {
      if (!isEdge(child)) {
        rest.push(child);
        return;
      }
      if (child.props.side === 'top') top = child;
      else bottom = child;
    });

    return { topEdge: top, bottomEdge: bottom, body: rest };
  }, [children]);

  return (
    <ReceiptCardContext.Provider value={context}>
      <View
        style={[
          styles.root,
          { width },
          tilted && { transform: [{ rotate: '-1deg' }] },
          style,
        ]}
      >
        {topEdge}
        <View
          style={[
            styles.paper,
            { backgroundColor: context.palette.paper },
            paperStyle,
          ]}
        >
          {body}
        </View>
        {bottomEdge}
      </View>
    </ReceiptCardContext.Provider>
  );
};

const ReceiptCardHeader: React.FC<IReceiptCardSlot> = ({ children, style }) => (
  <View style={[styles.header, style]}>{children}</View>
);

const ReceiptCardStore: React.FC<IReceiptCardText> = ({ children, style }) => {
  const { palette, fontFamily } = useReceiptCard('ReceiptCard.Store');
  return (
    <Text style={[styles.store, { color: palette.accent, fontFamily }, style]}>
      {children}
    </Text>
  );
};

const ReceiptCardMeta: React.FC<IReceiptCardText> = ({ children, style }) => {
  const { palette, fontFamily } = useReceiptCard('ReceiptCard.Meta');
  return (
    <Text style={[styles.meta, { color: palette.muted, fontFamily }, style]}>
      {children}
    </Text>
  );
};

const ReceiptCardSeparator: React.FC<IReceiptCardSeparator> = ({
  variant = 'dashed',
  color,
  style,
}) => {
  const { palette } = useReceiptCard('ReceiptCard.Separator');
  return (
    <View
      style={[
        styles.separator,
        { borderColor: color ?? palette.rule, borderStyle: variant },
        style,
      ]}
    />
  );
};

const ReceiptCardItems: React.FC<IReceiptCardSlot> = ({ children, style }) => (
  <View style={[styles.items, style]}>{children}</View>
);

const ReceiptCardItem: React.FC<IReceiptCardItem> = ({
  label,
  value,
  sublabel,
  leader = true,
  style,
  labelStyle,
  valueStyle,
}) => {
  const { palette, fontFamily } = useReceiptCard('ReceiptCard.Item');
  return (
    <View style={[styles.itemWrap, style]}>
      <View style={styles.item}>
        <Text style={[styles.itemLabel, { color: palette.ink, fontFamily }, labelStyle]}>
          {label}
        </Text>
        {leader && (
          <View
            style={[styles.leader, { borderColor: palette.leader }]}
          />
        )}
        <Text style={[styles.itemValue, { color: palette.accent, fontFamily }, valueStyle]}>
          {value}
        </Text>
      </View>
      {sublabel ? (
        <Text style={[styles.sublabel, { color: palette.muted, fontFamily }]}>
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
};

const ReceiptCardTotal: React.FC<IReceiptCardTotal> = ({
  label = 'कुल योग (Total)',
  value,
  saving,
  style,
  labelStyle,
  valueStyle,
}) => {
  const { palette, fontFamily } = useReceiptCard('ReceiptCard.Total');
  return (
    <View style={[styles.totalContainer, style]}>
      <View style={styles.total}>
        <Text style={[styles.totalText, { color: palette.ink, fontFamily }, labelStyle]}>
          {label}
        </Text>
        <Text style={[styles.totalText, styles.tabular, { color: palette.accent, fontFamily }, valueStyle]}>
          {value}
        </Text>
      </View>
      {saving ? (
        <View style={styles.savingBadge}>
          <Text style={[styles.savingText, { fontFamily }]}>
            {saving}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const ReceiptCardNote: React.FC<IReceiptCardText> = ({ children, style }) => {
  const { palette, fontFamily } = useReceiptCard('ReceiptCard.Note');
  return (
    <Text style={[styles.note, { color: palette.muted, fontFamily }, style]}>
      {children}
    </Text>
  );
};

const ReceiptCardBarcode: React.FC<IReceiptCardBarcode> = ({
  code,
  showCode = true,
  height = BARCODE_HEIGHT,
  width = BARCODE_WIDTH,
  color,
  style,
  codeStyle,
}) => {
  const { palette, fontFamily } = useReceiptCard('ReceiptCard.Barcode');
  const bars = useMemo<number[]>(() => {
    const seed = code.length > 0 ? code : 'sahara';
    return Array.from(
      { length: BAR_COUNT },
      (_, i) => 1 + ((seed.charCodeAt(i % seed.length) + i * 3) % 3)
    );
  }, [code]);

  return (
    <View style={[styles.barcode, style]}>
      <View style={[styles.bars, { height, width }]}>
        {bars.map((barWidth, i) => (
          <View
            key={`${code}-${i}`}
            style={{
              width: barWidth,
              height: '100%',
              backgroundColor: color ?? palette.ink,
            }}
          />
        ))}
      </View>
      {showCode && (
        <Text style={[styles.code, { color: palette.muted, fontFamily }, codeStyle]}>
          {code}
        </Text>
      )}
    </View>
  );
};

const ReceiptCardTornEdge: React.FC<IReceiptCardTornEdge> = ({
  side = 'bottom',
  toothWidth = TEETH_WIDTH,
  toothHeight = TEETH_HEIGHT,
  color,
  style,
}) => {
  const { palette, width } = useReceiptCard('ReceiptCard.TornEdge');

  const path = useMemo<string>(() => {
    const teeth = Math.ceil(width / toothWidth);
    const base = side === 'bottom' ? 0 : toothHeight;
    const tip = side === 'bottom' ? toothHeight : 0;
    const segments: string[] = [`M0 ${base}`];

    for (let i = 0; i < teeth; i += 1) {
      const start = i * toothWidth;
      segments.push(`L${start + toothWidth / 2} ${tip}`);
      segments.push(`L${start + toothWidth} ${base}`);
    }

    return `${segments.join(' ')} Z`;
  }, [side, toothHeight, toothWidth, width]);

  return (
    <View style={[{ width, height: toothHeight }, style]}>
      <Svg width={width} height={toothHeight}>
        <Path d={path} fill={color ?? palette.paper} />
      </Svg>
    </View>
  );
};

(ReceiptCardTornEdge as { role?: string }).role = EDGE_ROLE;

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
    marginVertical: 8,
  },
  paper: {
    paddingHorizontal: PAPER_PADDING,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    gap: 3,
  },
  store: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  separator: {
    borderTopWidth: 1,
    marginVertical: 12,
  },
  items: {
    gap: 8,
  },
  itemWrap: {
    gap: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  itemLabel: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '600',
  },
  sublabel: {
    fontSize: 10,
    paddingLeft: 4,
  },
  leader: {
    flex: 1,
    minWidth: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
  },
  itemValue: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  totalContainer: {
    gap: 6,
  },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  savingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  savingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  note: {
    marginTop: 12,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  barcode: {
    marginTop: 12,
    alignItems: 'center',
    gap: 4,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  code: {
    fontSize: 10,
    letterSpacing: 3,
  },
});

const Root = createCompoundComponent('ReceiptCard.Root', ReceiptCardRoot);
const Header = createCompoundComponent('ReceiptCard.Header', ReceiptCardHeader);
const Store = createCompoundComponent('ReceiptCard.Store', ReceiptCardStore);
const Meta = createCompoundComponent('ReceiptCard.Meta', ReceiptCardMeta);
const Separator = createCompoundComponent('ReceiptCard.Separator', ReceiptCardSeparator);
const Items = createCompoundComponent('ReceiptCard.Items', ReceiptCardItems);
const Item = createCompoundComponent('ReceiptCard.Item', ReceiptCardItem);
const Total = createCompoundComponent('ReceiptCard.Total', ReceiptCardTotal);
const Note = createCompoundComponent('ReceiptCard.Note', ReceiptCardNote);
const Barcode = createCompoundComponent('ReceiptCard.Barcode', ReceiptCardBarcode);
const TornEdge = createCompoundComponent('ReceiptCard.TornEdge', ReceiptCardTornEdge);

export const ReceiptCard = Object.assign(Root, {
  Header,
  Store,
  Meta,
  Separator,
  Items,
  Item,
  Total,
  Note,
  Barcode,
  TornEdge,
});
