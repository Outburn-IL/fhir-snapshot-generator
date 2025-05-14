import { ILogger } from 'fhir-package-explorer';
import { ElementDefinition } from '../../types';
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
const applySingleDiff = (elements: ElementDefinition[], diffElement: ElementDefinition): ElementDefinition[] => {
  const index = elements.findIndex(el => el.id === diffElement.id);
  if (index === -1) {
    throw new Error(`Element with id "${diffElement.id}" not found`);
  }
  const baseElement = { ...elements[index]}; // create a shallow copy of the base element
  const mergedElement = mergeElement(baseElement, diffElement);
  const updatedElements = [...elements.slice(0, index), mergedElement, ...elements.slice(index + 1)];
  return updatedElements;
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
  let updatedElements = [...elements];
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
      updatedElements = await ensureBranch(updatedElements, diff.id, fetcher, logger);
    }
    
    // apply the diff element to the working snapshot array
    updatedElements = applySingleDiff(updatedElements, diff);
  }
  return updatedElements;
};