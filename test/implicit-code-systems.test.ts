/**
 * Test for implicit code systems functionality
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import path from 'path';

const cachePath = path.join(process.cwd(), 'test', '.test-cache');

describe('Implicit Code Systems', async () => {
  let fsg: FhirSnapshotGenerator;

  beforeEach(async () => {
    fsg = await FhirSnapshotGenerator.create({
      cachePath,
      context: ['hl7.fhir.r4.core#4.0.1'],
      cacheMode: 'none'
    });
  });

  test('should expand ISO 3166 country codes through implicit code system', async () => {
    // Create a mock ValueSet that includes all ISO 3166 codes
    const mockValueSet = {
      resourceType: 'ValueSet',
      id: 'test-iso3166',
      url: 'http://test.com/ValueSet/test-iso3166',
      status: 'active',
      compose: {
        include: [
          {
            system: 'urn:iso:std:iso:3166'
          }
        ]
      }
    };

    // Directly test the expandInclude method with our mock ValueSet
    const includeResult = await (fsg as any).expandInclude(
      mockValueSet.compose.include[0],
      { id: 'test', version: '1.0.0' },
      new Map()
    );

    expect(includeResult).toBeDefined();
    expect(includeResult.size).toBe(1); // One system
    
    const iso3166Codes = includeResult.get('urn:iso:std:iso:3166');
    expect(iso3166Codes).toBeDefined();
    expect(iso3166Codes!.size).toBeGreaterThan(450); // Should have both alpha-2 and alpha-3 codes (~468 total)
    
    // Check for some well-known countries (alpha-2 codes)
    expect(iso3166Codes!.has('US')).toBe(true);
    expect(iso3166Codes!.has('GB')).toBe(true);
    expect(iso3166Codes!.has('IL')).toBe(true);
    expect(iso3166Codes!.has('DE')).toBe(true);
    
    // Check for some well-known countries (alpha-3 codes)
    expect(iso3166Codes!.has('USA')).toBe(true);
    expect(iso3166Codes!.has('GBR')).toBe(true);
    expect(iso3166Codes!.has('ISR')).toBe(true);
    expect(iso3166Codes!.has('DEU')).toBe(true);
    
    // Check that displays are provided for both formats
    expect(iso3166Codes!.get('US')).toBe('United States of America');
    expect(iso3166Codes!.get('USA')).toBe('United States of America');
    expect(iso3166Codes!.get('IL')).toBe('Israel');
    expect(iso3166Codes!.get('ISR')).toBe('Israel');
  });

  test('should handle implicit code systems in resolveCompleteCodeSystem', async () => {
    const cs = await (fsg as any).resolveCompleteCodeSystem(
      'urn:iso:std:iso:3166',
      { id: 'test', version: '1.0.0' }
    );

    expect(cs).toBeDefined();
    expect(cs.resourceType).toBe('CodeSystem');
    expect(cs.url).toBe('urn:iso:std:iso:3166');
    expect(cs.status).toBe('active');
    expect(cs.content).toBe('complete');
    expect(Array.isArray(cs.concept)).toBe(true);
    expect(cs.concept.length).toBeGreaterThan(450); // Should have both alpha-2 and alpha-3 codes
    
    // Check for some well-known countries in the concepts (alpha-2)
    const usCountry = cs.concept.find((c: any) => c.code === 'US');
    expect(usCountry).toBeDefined();
    expect(usCountry.display).toBe('United States of America');
    
    // Check for some well-known countries in the concepts (alpha-3)
    const usaCountry = cs.concept.find((c: any) => c.code === 'USA');
    expect(usaCountry).toBeDefined();
    expect(usaCountry.display).toBe('United States of America');
    
    const israelCountry = cs.concept.find((c: any) => c.code === 'IL');
    expect(israelCountry).toBeDefined();
    expect(israelCountry.display).toBe('Israel');
    
    const israelAlpha3Country = cs.concept.find((c: any) => c.code === 'ISR');
    expect(israelAlpha3Country).toBeDefined();
    expect(israelAlpha3Country.display).toBe('Israel');
  });

  test('should expand BCP 47 language codes through implicit code system', async () => {
    // Create a mock ValueSet that includes all BCP 47 language codes
    const mockValueSet = {
      resourceType: 'ValueSet',
      id: 'test-bcp47',
      url: 'http://test.com/ValueSet/test-bcp47',
      status: 'active',
      compose: {
        include: [
          {
            system: 'urn:ietf:bcp:47'
          }
        ]
      }
    };

    // Directly test the expandInclude method with our mock ValueSet
    const includeResult = await (fsg as any).expandInclude(
      mockValueSet.compose.include[0],
      { id: 'test', version: '1.0.0' },
      new Map()
    );

    expect(includeResult).toBeDefined();
    expect(includeResult.size).toBe(1); // One system
    
    const bcp47Codes = includeResult.get('urn:ietf:bcp:47');
    expect(bcp47Codes).toBeDefined();
    expect(bcp47Codes!.size).toBeGreaterThan(200); // Should have many language codes
    
    // Check common primary language codes
    expect(bcp47Codes!.has('en')).toBe(true);
    expect(bcp47Codes!.has('fr')).toBe(true);
    expect(bcp47Codes!.has('de')).toBe(true);
    expect(bcp47Codes!.has('es')).toBe(true);
    expect(bcp47Codes!.has('zh')).toBe(true);
    expect(bcp47Codes!.has('ja')).toBe(true);
    expect(bcp47Codes!.has('ar')).toBe(true);
    
    // Check common language-region combinations
    expect(bcp47Codes!.has('en-US')).toBe(true);
    expect(bcp47Codes!.has('en-GB')).toBe(true);
    expect(bcp47Codes!.has('fr-CA')).toBe(true);
    expect(bcp47Codes!.has('es-MX')).toBe(true);
    expect(bcp47Codes!.has('zh-CN')).toBe(true);
    
    // Check underscore variants are supported
    expect(bcp47Codes!.has('en_US')).toBe(true);
    expect(bcp47Codes!.has('fr_CA')).toBe(true);
    
    // Check that displays are provided
    expect(bcp47Codes!.get('en')).toBe('English');
    expect(bcp47Codes!.get('en-US')).toBe('English (United States)');
    expect(bcp47Codes!.get('fr-CA')).toBe('French (Canada)');
  });

  test('should handle BCP 47 language codes in resolveCompleteCodeSystem', async () => {
    const cs = await (fsg as any).resolveCompleteCodeSystem(
      'urn:ietf:bcp:47',
      { id: 'test', version: '1.0.0' }
    );

    expect(cs).toBeDefined();
    expect(cs.resourceType).toBe('CodeSystem');
    expect(cs.url).toBe('urn:ietf:bcp:47');
    expect(cs.status).toBe('active');
    expect(cs.content).toBe('complete');
    expect(Array.isArray(cs.concept)).toBe(true);
    expect(cs.concept.length).toBeGreaterThan(200); // Should have many language codes
    
    // Check for some well-known language codes
    const englishCode = cs.concept.find((c: any) => c.code === 'en');
    expect(englishCode).toBeDefined();
    expect(englishCode.display).toBe('English');
    
    const frenchCanadaCode = cs.concept.find((c: any) => c.code === 'fr-CA');
    expect(frenchCanadaCode).toBeDefined();
    expect(frenchCanadaCode.display).toBe('French (Canada)');
    
    const chineseCode = cs.concept.find((c: any) => c.code === 'zh');
    expect(chineseCode).toBeDefined();
    expect(chineseCode.display).toBe('Chinese');
    
    // Check underscore variants are also included
    const enUsUnderscoreCode = cs.concept.find((c: any) => c.code === 'en_US');
    expect(enUsUnderscoreCode).toBeDefined();
    expect(enUsUnderscoreCode.display).toBe('English (United States)');
  });

  test('should fallback to implicit code systems when regular resolution fails', async () => {
    // This tests the specific use case from the wip.ts script
    // The ISO 3166 CodeSystem should be resolved as an implicit code system
    // when the regular FHIR package resolution fails
    
    try {
      const cs = await (fsg as any).resolveCompleteCodeSystem(
        'urn:iso:std:iso:3166',
        { id: 'hl7.fhir.r4.core', version: '4.0.1' }
      );
      
      expect(cs).toBeDefined();
      expect(cs.resourceType).toBe('CodeSystem');
      expect(cs.content).toBe('complete');
      expect(cs.concept.length).toBeGreaterThan(450); // Should have both alpha-2 and alpha-3 codes
    } catch (error) {
      // If it still fails, make sure it's not the original "not-present" error
      expect(error).not.toMatch(/content='not-present'/);
      throw error;
    }
  });
});