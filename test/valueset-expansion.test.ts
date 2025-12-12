import { describe, it, expect, beforeAll } from 'vitest';
import { FhirSnapshotGenerator } from '../src/index';

// Helper to deeply flatten expansion.contains (handles abstract groups)
function flattenContains(contains: any[] | undefined): Array<{ system?: string; code?: string; display?: string }> {
  const out: Array<{ system?: string; code?: string; display?: string }> = [];
  const walk = (list: any[] | undefined) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (item && item.code) {
        const flattened: any = { system: item.system, code: item.code };
        if ('display' in item) {
          flattened.display = item.display;
        }
        out.push(flattened);
      }
      if (Array.isArray(item.contains)) walk(item.contains);
    }
  };
  walk(contains);
  return out;
}

describe('ValueSet expansion (integration)', () => {
  const cachePath = './test/.test-cache';
  const context = ['il.core.fhir.r4#0.17.0', 'fsg.test.pkg#0.1.0'];
  let fsg: FhirSnapshotGenerator;

  beforeAll(async () => {
    fsg = await FhirSnapshotGenerator.create({ cachePath, context, cacheMode: 'none' });
  });

  it('administrative-gender: include by system (CodeSystem complete)', async () => {
    const vs = await fsg.expandValueSet('administrative-gender');
    expect(vs?.expansion?.contains).toBeTruthy();
    const flat = flattenContains(vs.expansion.contains);
    const system = 'http://hl7.org/fhir/administrative-gender';
    const codes = flat.filter(c => c.system === system).map(c => c.code);
    expect(codes).toEqual(expect.arrayContaining(['male','female','other','unknown']));
    // expect exactly these 4
    expect(codes.length).toBe(4);
  });

  it('immunization-route: explicit include.concept without filters', async () => {
    const expectedCodes = ['IDINJ','IM','NASINHLC','IVINJ','PO','SQ','TRNSDERM'];
    const vs = await fsg.expandValueSet('immunization-route');
    expect(vs?.expansion?.contains).toBeTruthy();
    const flat = flattenContains(vs.expansion.contains);
    const system = 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration';
    const codes = flat.filter(c => c.system === system).map(c => c.code);
    expect(codes.length).toBe(expectedCodes.length);
    expect(codes).toEqual(expect.arrayContaining(expectedCodes));
  });

  it('observation-interpretation: include by v3 system (complete)', async () => {
    const vs = await fsg.expandValueSet('observation-interpretation');
    expect(vs?.expansion?.contains).toBeTruthy();
    const flat = flattenContains(vs.expansion.contains);
    const system = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';
    const codes = flat.filter(c => c.system === system).map(c => c.code);
    expect(codes.length).toBeGreaterThan(0);
  });

  it('example-intensional: throws on unsupported filter', async () => {
    await expect(fsg.expandValueSet('example-intensional')).rejects.toThrow();
  });

  it('example-expansion: falls back to original expansion when generation fails', async () => {
    const vs = await fsg.expandValueSet('example-expansion');
    // Should return original resource (with existing expansion)
    expect(vs?.expansion?.contains).toBeTruthy();
    const flat = flattenContains(vs.expansion.contains);
    // Known LOINC codes from the packaged example expansion
    expect(flat.some(c => c.system === 'http://loinc.org' && c.code === '14647-2')).toBe(true);
    expect(flat.some(c => c.system === 'http://loinc.org' && c.code === '2093-3')).toBe(true);
  });

  it('all-languages: successfully expands using BCP 47 implicit code system', async () => {
    const result = await fsg.expandValueSet('all-languages');
    
    expect(result).toBeDefined();
    expect(result.expansion).toBeDefined();
    expect(result.expansion.total).toBeGreaterThan(400); // Should have many language codes
    expect(result.expansion.contains.length).toBeGreaterThan(400);
    
    // Check for common language codes
    const codes = result.expansion.contains.map((c: any) => c.code);
    expect(codes).toContain('en');
    expect(codes).toContain('fr');
    expect(codes).toContain('de');
    expect(codes).toContain('es');
    expect(codes).toContain('zh');
    expect(codes).toContain('ja');
    expect(codes).toContain('ar');
    
    // Check for regional variants
    expect(codes).toContain('en-US');
    expect(codes).toContain('en-GB');
    expect(codes).toContain('fr-CA');
    expect(codes).toContain('zh-CN');
    
    // Check underscore variants are also included
    expect(codes).toContain('en_US');
    expect(codes).toContain('fr_CA');
    
    // Verify display names are present
    const enUsCode = result.expansion.contains.find((c: any) => c.code === 'en-US');
    expect(enUsCode.display).toBe('English (United States)');
    
    const frCaCode = result.expansion.contains.find((c: any) => c.code === 'fr-CA');
    expect(frCaCode.display).toBe('French (Canada)');
  });

  it('ucum-common: large explicit include.concept list (no CodeSystem lookup required)', async () => {
    const vs = await fsg.expandValueSet('ucum-common');
    expect(vs?.expansion?.contains).toBeTruthy();
    const flat = flattenContains(vs.expansion.contains);
    const system = 'http://unitsofmeasure.org';
    const codes = new Set(flat.filter(c => c.system === system).map(c => String(c.code)));
    // Spot-check a few well-known UCUM codes present in the file
    expect(codes.has('%')).toBe(true);
    expect(codes.has('mg')).toBe(true);
    expect(codes.has('mm[Hg]')).toBe(true);
  });

  it('ucum-bodytemp: body temperature units from UCUM', async () => {
    const vs = await fsg.expandValueSet('http://hl7.org/fhir/ValueSet/ucum-bodytemp');
    expect(vs?.expansion?.contains).toBeTruthy();
    const flat = flattenContains(vs.expansion.contains);
    const system = 'http://unitsofmeasure.org';
    const codes = flat.filter(c => c.system === system);
    
    // Verify the expected codes are present
    const codeValues = codes.map(c => c.code);
    expect(codeValues).toEqual(expect.arrayContaining(['Cel', '[degF]']));
    
    // Verify the displays are omitted when CodeSystem lookup fails (no display property should be present)
    const celEntry = codes.find(c => c.code === 'Cel');
    const degFEntry = codes.find(c => c.code === '[degF]');
    expect(celEntry?.display).toBeUndefined();
    expect(degFEntry?.display).toBeUndefined();
    
    // Verify that display property is not present at all (not just undefined)
    expect('display' in celEntry!).toBe(false);
    expect('display' in degFEntry!).toBe(false);
    
    // Should contain exactly these 2 codes
    expect(codes.length).toBe(2);
  });
});

describe('ValueSet expansion - R5 (integration)', () => {
  const cachePath = './test/.test-cache';
  let fsgR5: FhirSnapshotGenerator;

  beforeAll(async () => {
    fsgR5 = await FhirSnapshotGenerator.create({ 
      cachePath, 
      context: [], 
      fhirVersion: 'R5',
      cacheMode: 'none' 
    });
  }, 60000);

  it('encounter-class: R5 encounter class value set expansion', async () => {
    const vs = await fsgR5.expandValueSet('http://terminology.hl7.org/ValueSet/encounter-class');
    
    expect(vs).toBeDefined();
    expect(vs.expansion).toBeDefined();
    expect(vs.expansion.contains).toBeTruthy();
    
    const flat = flattenContains(vs.expansion.contains);
    expect(flat.length).toBeGreaterThan(0);
    
    // Check for common encounter class codes that should be present
    const codes = flat.map(c => c.code);
    expect(codes).toEqual(expect.arrayContaining(['AMB', 'EMER', 'IMP', 'HH', 'OBSENC', 'VR']));
    
    // Verify system is correct
    const v3ActCode = flat.filter(c => c.system === 'http://terminology.hl7.org/CodeSystem/v3-ActCode');
    expect(v3ActCode.length).toBeGreaterThan(0);
    
    console.log('R5 encounter-class expansion contains', flat.length, 'codes');
  });
});
