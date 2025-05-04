import { ElementDefinition } from './types';

export const rewriteElementPaths = (
  snapshot: ElementDefinition[],
  newPrefix: string,
  oldPrefix: string
): ElementDefinition[] => {
  const oldPrefixDot = oldPrefix.endsWith('.') ? oldPrefix : oldPrefix + '.';
  const newPrefixDot = newPrefix.endsWith('.') ? newPrefix : newPrefix + '.';

  const removeSlices = (elementIdPart: string): string => {
    const segments = elementIdPart.split('.');
    // for each segment, remove the slice name if it exists
    const cleanedSegments = segments.map(segment => {
      const sliceIndex = segment.indexOf(':');
      return sliceIndex !== -1 ? segment.slice(0, sliceIndex) : segment;
    });
    return cleanedSegments.join('.'); 
  };
  
  const replaceId = (str: string) =>
    str === oldPrefix
      ? newPrefix
      : str.startsWith(oldPrefixDot)
        ? newPrefixDot + str.slice(oldPrefixDot.length)
        : str;
  
  const replacePath = (elementPath: string) => {
    const newPathPrefix = removeSlices(newPrefixDot);
    const oldPathPrefix = removeSlices(oldPrefixDot);
    return elementPath === oldPathPrefix
      ? newPathPrefix
      : elementPath.startsWith(oldPathPrefix)
        ? newPathPrefix + elementPath.slice(oldPathPrefix.length)
        : elementPath;
  };

  return snapshot.map(el => ({
    ...el,
    id: replaceId(el.id),
    path: replacePath(el.path)
  }));
};
