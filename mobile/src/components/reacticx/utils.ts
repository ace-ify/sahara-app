import React from 'react';

export function createCompoundComponent<P>(
  name: string,
  component: React.FC<P>
): React.FC<P> {
  component.displayName = name;
  return component;
}
