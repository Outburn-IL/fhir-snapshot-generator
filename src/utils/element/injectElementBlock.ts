/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { ElementDefinition } from '../../../types';

/**
 * Injects a block of elements into the working snapshot array at the specified injection point.
 * The injection point is the id of the element where the block will be injected.
 * The block will replace the existing element at the injection point, and all of its children (slices, elements).
 * @param elements working snapshot array
 * @param injectionPoint the id of the element the block will replace
 * @param elementBlock the block of elements to inject
 * @returns the updated element array after injection
 */
export const injectElementBlock = (elements: ElementDefinition[], injectionPoint: string, elementBlock: ElementDefinition[]): ElementDefinition[] => {
  const index = elements.findIndex(el => el.id === injectionPoint);
  if (index === -1) throw new Error(`Element with id "${injectionPoint}" not found`);
  const before = elements.slice(0, index);
  const after = elements.slice(index + 1).filter(element => !(element.id.startsWith(`${injectionPoint}.`)) && !(element.id.startsWith(`${injectionPoint}:`))); // Skip the target
  const results = [...before, ...elementBlock, ...after];
  return results;
};