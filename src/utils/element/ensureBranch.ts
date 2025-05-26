/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { ILogger } from 'fhir-package-explorer';
import { ElementDefinition } from '../../../types';
import { DefinitionFetcher, ensureChild } from '..';

/**
 * Walks the path segements up to the target, expanding child elements and creating slices as needed.
 * @param elements working snapshot array
 * @param targetElementId target element id
 * * @returns the updated element array after entire path to target element was added
 */
export const ensureBranch = async (
  elements: ElementDefinition[],
  targetElementId: string,
  fetcher: DefinitionFetcher,
  logger: ILogger,
  pathRewriteMap: Map<string, { id: string, path: string }>
): Promise<ElementDefinition[]> => {
  const idSegments = targetElementId.split('.');
  const rootId = idSegments[0];
  let updatedElements = elements;
  // check that root matches the first element in the array
  if (elements[0].id !== rootId) {
    throw new Error(`Root element '${rootId}' not found in the working snapshot array`);
  }
  if (rootId === targetElementId) {
    // if the target is the root element, just return the elements array
    return updatedElements;
  }

  // track the canonical parent id - this is the correct form of the cumulative branch after any rewrites
  let canonicalParentId = rootId;

  // loop over the remaining segments and ensure each one exists
  for (let i = 1; i < idSegments.length; i++) {
    const rawChildSegment = idSegments[i];

    // Rewrite the current parent ID if needed (cumulative)
    const rewrite = pathRewriteMap.get(canonicalParentId);
    if (rewrite) {
      canonicalParentId = rewrite.id;
    }

    // Ensure the child
    updatedElements = await ensureChild(
      updatedElements,
      canonicalParentId,
      rawChildSegment,
      fetcher,
      logger,
      pathRewriteMap
    );

    // Build canonical child ID and continue
    canonicalParentId = `${canonicalParentId}.${rawChildSegment}`;
  }
  return updatedElements;
};