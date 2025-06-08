/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { elementExists } from '..';
import { ElementDefinition } from '../../../types';

/**
 * Takes a parent node and a child id, and checks if the child exists in the working snapshot array.
 * @param elements working snapshot array
 * @param parentNode the full path of the parent node to look for the child in
 * @param childId the last segment of the child element id to look for, e.g "identifier:foo" or "system"
 * @returns true if the child exists, false otherwise
 */
export const childExists = (elements: ElementDefinition[], parentNode: string, childId: string): boolean => {
  return elementExists(elements, `${parentNode}.${childId}`);
};