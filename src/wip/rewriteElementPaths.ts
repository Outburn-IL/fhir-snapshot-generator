import { ElementDefinition } from './types';

export default (
  snapshot: ElementDefinition[],
  newPrefix: string,
  oldPrefix: string
): ElementDefinition[] => {
  const oldPrefixDot = oldPrefix.endsWith('.') ? oldPrefix : oldPrefix + '.';
  const newPrefixDot = newPrefix.endsWith('.') ? newPrefix : newPrefix + '.';
  
  const replace = (str: string) =>
    str === oldPrefix
      ? newPrefix
      : str.startsWith(oldPrefixDot)
        ? newPrefixDot + str.slice(oldPrefixDot.length)
        : str;
  
  return snapshot.map(el => ({
    ...el,
    id: replace(el.id),
    path: replace(el.path)
  }));
};
