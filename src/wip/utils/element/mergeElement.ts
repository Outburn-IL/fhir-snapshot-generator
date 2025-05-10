import { ElementDefinition } from '../../types';

/**
 * Merge an existing snapshot element with a diff element.
 * Most diff keys just override the snapshot ones if they exist.
 * The 'constraint' and 'condition' arrays are accumulated.
 * @param base ElementDefinition - the base snapshot element to apply the merge to
 * @param diff ElementDefinition - the diff element to merge with the base element
 * @returns ElementDefinition - the merged element
 * @throws Error if the diff element ID does not match the base element ID
 */
export const mergeElement = (base: ElementDefinition, diff: ElementDefinition): ElementDefinition => {
  // ensure diff.id === base.id
  if (diff.id !== base.id) {
    throw new Error(`Element ID mismatch. Tried to apply "${diff.id}" onto "${base.id}".`);
  }
  // create a shallow working copy of the base element
  const mergedElement: ElementDefinition = { ...base };
  // apply the diff attributes, key by key
  for (const key of Object.keys(diff) as string[]) {
    if (key === 'constraint') {
      const baseConstraints = base.constraint || [];
      const diffConstraints = diff.constraint || [];
      mergedElement.constraint = [...baseConstraints, ...diffConstraints];
    } else if (key === 'condition') {
      const baseConditions = base.condition || [];
      const diffConditions = diff.condition || [];
      const mergedConditions = [...baseConditions, ...diffConditions];
      mergedElement.condition = Array.from(new Set(mergedConditions));
    } else if (key !== 'id' && key !== 'path') {
      if (diff[key] !== undefined) {
        mergedElement[key] = diff[key];
      };
    }
  }
  return mergedElement;
};