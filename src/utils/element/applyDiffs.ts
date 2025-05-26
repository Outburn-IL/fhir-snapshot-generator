/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { ILogger } from 'fhir-package-explorer';
import { ElementDefinition } from '../../../types';
import { ensureBranch, mergeElement, elementExists, DefinitionFetcher } from '..';

/**
 * Apply a single diff element to the working snapshot array and return the updated array.
 * The existing element will be replaced by the result of merging it with the diff element.
 * This function assumes that an element with the same id already exists in the working snapshot array.
 * If the element does not exist, an error will be thrown.
 * @param elements working snapshot array
 * @param diffElement the diff element to apply
 * @returns the updated element array after applying the diff element
 */
export const applySingleDiff = (elements: ElementDefinition[], diffElement: ElementDefinition): ElementDefinition[] => {
  const index = elements.findIndex(el => el.id === diffElement.id);
  if (index === -1) {
    throw new Error(`Element with id "${diffElement.id}" not found`);
  }
  const baseElement = { ...elements[index]}; // create a shallow copy of the base element
  const mergedElement = mergeElement(baseElement, diffElement);

  // if the resulting element has a sliceName but the id does not, remove sliceName.
  // This is a remnant of aplying a diff on a monopoly using slices
  if (mergedElement.sliceName && !mergedElement.id.endsWith(`:${mergedElement.sliceName}`)) {
    delete mergedElement.sliceName;
  }
  const updatedElements = [...elements.slice(0, index), mergedElement, ...elements.slice(index + 1)];
  return updatedElements;
};

/**
 * Rewrite the given id or path based on the path rewrite map.
 * This is used to handle the shortcut form of monopolized elements,
 * where valueString is both a type constraint and a differential on value[x].
 * After rewrite, the canonical value[x] path segment will be used.
 * The actual type constraint whould have already been applied to the working snapshot as a virtual diff during ensureChild.
 * @param original the original string to rewrite
 * @param kind the kind of rewrite to perform ('id' or 'path')
 * @returns 
 */
const rewrite = (original: string, kind: 'id' | 'path', pathRewriteMap: Map<string, { id: string, path: string }>) => {
  for (const [illegalPrefix, rewrite] of pathRewriteMap.entries()) {
    if (original === illegalPrefix || original.startsWith(illegalPrefix + '.')) {
      return original.replace(illegalPrefix, rewrite[kind]);
    }
  }
  return original;
};


/**
 * Apply all diffs to the working snapshot array, in order, and return the updated array.
 * Missing (but valid) elements and their containing branches will be added to the working snapshot array on the fly.
 * The diff is an array of ElementDefinition objects that will be applied to the target element.
 * @param elements working snapshot array
 * @param diffElements the diff elements to apply
 * @returns the updated element array after applying the diff elements
 */
export const applyDiffs = async (elements: ElementDefinition[], diffs: ElementDefinition[], fetcher: DefinitionFetcher, logger: ILogger): Promise<ElementDefinition[]> => {
  // working snapshot array. will accumulate all chnges and be returned at the end.
  let updatedElements = [...elements];
  
  // map to keep track of path rewrites for shortcut forms of monopolized elements (e.g. "valueString" as a type constraint on "value[x]")
  const pathRewriteMap = new Map<string, { id: string, path: string }>();

  // remove extension array from root element if it exists
  if (updatedElements[0].extension) {
    delete updatedElements[0].extension;
  }
  // if no diffs - return the elements array as is
  if (diffs.length === 0) return updatedElements;
  for (const diff of diffs) {
    if (!elementExists(updatedElements, diff.id)) {
      logger.info(`Creating branch '${diff.id}'...`);
      // ensure the entire path to the target element exists in the working snapshot array
      updatedElements = await ensureBranch(updatedElements, diff.id, fetcher, logger, pathRewriteMap);
    }

    // If during ensureBranch some parts of the id/path have been rewritten, fix the id and path accordingly
    const rewrittenDiff = {
      ...diff,
      id: rewrite(diff.id, 'id', pathRewriteMap),
      path: rewrite(diff.path, 'path', pathRewriteMap)
    };
    
    // apply the diff element to the working snapshot array
    updatedElements = applySingleDiff(updatedElements, rewrittenDiff);
  }
  return updatedElements;
};