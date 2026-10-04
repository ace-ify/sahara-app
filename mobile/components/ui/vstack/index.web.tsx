import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { flattenStyle } from '../utils/flatten-style';

import { vstackStyle } from './styles';

type IVStackProps = Omit<React.ComponentProps<'div'>, 'style'> &
  VariantProps<typeof vstackStyle> & { style?: any };

const VStack = React.forwardRef<React.ComponentRef<'div'>, IVStackProps>(
  function VStack({ className, space, reversed, style, ...props }, ref) {
    return (
      <div
        className={vstackStyle({
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

VStack.displayName = 'VStack';

export { VStack };

