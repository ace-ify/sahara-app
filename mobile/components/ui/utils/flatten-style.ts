export const flattenStyle = (style: any): any => {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    const flat: Record<string, any> = {};
    for (let i = 0; i < style.length; i++) {
      const item = flattenStyle(style[i]);
      if (item && typeof item === 'object') {
        Object.assign(flat, item);
      }
    }
    return flat;
  }
  return style;
};
