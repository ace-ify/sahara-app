import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { flattenStyle } from '../utils/flatten-style';
import { textStyle } from './styles';

type ITextProps = Omit<React.ComponentProps<'span'>, 'style'> &
  VariantProps<typeof textStyle> & { style?: any };

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      style,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    return (
      <span
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: className,
        })}
        style={flattenStyle(style)}
        {...props}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };

