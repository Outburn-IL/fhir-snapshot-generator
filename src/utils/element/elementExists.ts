/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { ElementDefinition } from '@outburn/types';

/**
 * Check if the current working snapshot contains the target element id.
 * @param elements working snapshot array
 * @param targetElementId target element id
 * @returns true if the element exists, false otherwise
 */
export const elementExists = (elements: ElementDefinition[], targetElementId: string): boolean => {
  return elements.some(element => element.id === targetElementId);
};