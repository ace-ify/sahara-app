import React from 'react';
import { cardStyle } from './styles';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { flattenStyle } from '../utils/flatten-style';

type ICardProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & 
  VariantProps<typeof cardStyle> & { 
    className?: string;
    size?: 'default' | 'sm';
    style?: any;
  };

const Card = React.forwardRef<HTMLDivElement, ICardProps>(function Card(
  { className, size = 'default', style, ...props },
  ref
) {
  return (
    <div
      className={cardStyle({ size, class: className })}
      style={flattenStyle(style)}
      {...props}
      ref={ref}
    />
  );
});

Card.displayName = 'Card';

export { Card };

