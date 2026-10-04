import React from 'react';
import { boxStyle } from './styles';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { flattenStyle } from '../utils/flatten-style';

type IBoxProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> &
  VariantProps<typeof boxStyle> & { className?: string; style?: any };

const Box = React.forwardRef<HTMLDivElement, IBoxProps>(function Box(
  { className, style, ...props },
  ref
) {
  return (
    <div ref={ref} className={boxStyle({ class: className })} style={flattenStyle(style)} {...props} />
  );
});

Box.displayName = 'Box';
export { Box };

