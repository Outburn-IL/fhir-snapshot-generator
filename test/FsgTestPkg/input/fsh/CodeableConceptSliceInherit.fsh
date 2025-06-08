Alias: $data-absent-reason = http://hl7.org/fhir/StructureDefinition/data-absent-reason
Alias: $language = http://hl7.org/fhir/StructureDefinition/language

Profile: CodeableConceptSliceInherit
Parent: CodeableConcept
Id: CodeableConceptSliceInherit
Title: "CodeableConcept.coding with extension on all slices and another on a slice"
Description: "For testing slice inheritace from head and addition of slices with a small SD"
* ^status = #draft
* coding ^slicing.discriminator.type = #value
* coding ^slicing.discriminator.path = "system"
* coding ^slicing.rules = #open
* coding.extension contains $data-absent-reason named ext1 0..1
* coding contains SliceA 0..*
* coding[SliceA].extension contains
    $language named ext2 1..1
* coding[SliceA].extension[ext2].value[x] = #de (exactly)