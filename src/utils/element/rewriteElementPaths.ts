/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { ElementDefinition } from '../../../types';

/**
 * Rewrites the paths and id's of elements in an array to match a new prefix.
 * The id's maintain slice names while the paths don't.
 * @param elements - the array of elements to rewrite
 * @param newPrefix - the new prefix to use for the element ids and paths
 * @param oldPrefix - the old prefix to replace in the element ids and paths
 * @returns - the rewritten array of elements
 */
export const rewriteElementPaths = (
  elements: ElementDefinition[],
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
    
  return elements.map(el => ({
    ...el,
    id: replaceId(el.id),
    path: replacePath(el.path)
  }));
};