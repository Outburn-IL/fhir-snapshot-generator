/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { ElementConstraint, ElementDefinition, FhirExtensionInstance } from '@outburn/types';

/**
 * When bringing an ElementDefinition from one of the base FHIR packages and using it as the base for a diff application,
 * some cleanup and adaptations must be done. For example: 
 * - changing relative links in markdown to absolute links
 * - removing some extensions that are not supposed to be inherited.
 */

// list of markdown elements to replace links in
const markdownKeys = ['definition', 'comment', 'requirements', 'meaningWhenMissing'] as const;

// Extensions that should not be inherited from a base definition
// See: https://jira.hl7.org/browse/FHIR-27535
const ignoredExtensions = [
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-fmm',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-fmm-no-warnings',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-hierarchy',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-interface',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-normative-version',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-applicable-version',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-category',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-codegen-super',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-security-category',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-summary',
  'http://hl7.org/fhir/StructureDefinition/structuredefinition-wg',
  'http://hl7.org/fhir/StructureDefinition/replaces',
  'http://hl7.org/fhir/StructureDefinition/resource-approvalDate',
  'http://hl7.org/fhir/StructureDefinition/resource-effectivePeriod',
  'http://hl7.org/fhir/StructureDefinition/resource-lastReviewDate'
];

/**
 * Replaces relative links in a single Markdown field with absolute HL7 FHIR URLs.
 * Example: [Extensibility](extensibility.html) → [Extensibility](http://hl7.org/fhir/extensibility.html)
 *
 * @param markdown - The Markdown string to process
 * @returns The updated Markdown string with absolute HL7 FHIR URLs
 */
const replaceRelativeLinks = (markdown: string): string => {
  return markdown.replace(
    /\[([^\]]+)\]\((?!https?:\/\/)([^)]+)\)/g,
    (_match, text, url) => `[${text}](http://hl7.org/fhir/${url})`
  );
};

/**
 * Delete extensions that should be ignored when inheriting an ElementDefinition.
 * @param extensions 
 * @param ignoredExtensions 
 * @returns 
 */
const filterExtensions = (
  extensions: FhirExtensionInstance[]
): FhirExtensionInstance[] | undefined => {
  const result = extensions.filter(
    ext => !ignoredExtensions.includes(ext.url)
  );
  return result.length > 0 ? result : undefined;
};

/**
 * If an inherited constraint does not have a source, add the source URL to it.
 * If it already has one, preserve it.
 * @param constraints 
 * @param sourceUrl 
 * @returns 
 */
const addSourceToConstraints = (
  constraints: ElementConstraint[],
  sourceUrl: string
): ElementConstraint[] => {
  return constraints.map(constraint => ({ source: sourceUrl, ...constraint }));
};

/**
 * Prepares an ElementDefinition array for inheritance into derived profiles.
 * @param elements 
 * @param sourceUrl - The URL of the source StructureDefinition, used to determine if it is from the base FHIR spec and to add `source` to inherited constraints.
 * @returns 
 */
export const migrateElements = (elements: ElementDefinition[], sourceUrl: string): ElementDefinition[] => {
  return elements.map((el: ElementDefinition, index) => {
    const updated: ElementDefinition = { ...el };
    // Top-level elements may have extensions that should not be inherited
    if (index === 0 && el.extension) {
      const filteredExtensions = filterExtensions(el.extension);
      if (filteredExtensions) {
        updated.extension = filteredExtensions;
      } else {
        delete updated.extension; // remove the extension array if empty
      }
    }
    // if source URL is the base FHIR namespace, replace relative links in markdown fields
    if (sourceUrl.startsWith('http://hl7.org/fhir')) {
      for (const key of markdownKeys) {
        const value = el[key];
        if (typeof value === 'string') {
          updated[key] = replaceRelativeLinks(value);
        }
      }
    }
    // if constraints exist, add the source URL to them
    if (el.constraint) {
      updated.constraint = addSourceToConstraints(el.constraint, sourceUrl);
    }
    return updated;
  });
};