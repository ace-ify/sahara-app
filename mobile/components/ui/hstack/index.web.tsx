import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { flattenStyle } from '../utils/flatten-style';
import { hstackStyle } from './styles';

type IHStackProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> &
  VariantProps<typeof hstackStyle> & { style?: any };

const HStack = React.forwardRef<React.ComponentRef<'div'>, IHStackProps>(
  function HStack({ className, space, reversed, style, ...props }, ref) {
    return (
      <div
        className={hstackStyle({
          space,
          reversed: reversed as boolean,
          class: className,
        })}
        style={flattenStyle(style)}
        {...props}
        ref={ref}
      />
    );
  }
);

HStack.displayName = 'HStack';

export { HStack };

