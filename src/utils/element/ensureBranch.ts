import { ILogger } from 'fhir-package-explorer';
import { ElementDefinition } from '../../types';
import { DefinitionFetcher, ensureChild } from '..';

/**
 * Walks the path segements up to the target, expanding child elements and creating slices as needed.
 * @param elements working snapshot array
 * @param targetElementId target element id
 * * @returns the updated element array after entire path to target element was added
 */
export const ensureBranch = async (elements: ElementDefinition[], targetElementId: string, fetcher: DefinitionFetcher, logger: ILogger): Promise<ElementDefinition[]> => {
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
  // loop over the remaining segments and ensure each one exists
  for (let i = 1; i < idSegments.length; i++) {
    const parentId = idSegments.slice(0, i).join('.');
    const childId = idSegments[i];
    updatedElements = await ensureChild(updatedElements, parentId, childId, fetcher, logger);
  }
  return updatedElements;
};