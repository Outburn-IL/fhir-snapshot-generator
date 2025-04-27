Profile: PatientIdentifierDeepDiff
Parent: Patient
Description: "A test profile of the Patient resource with a deep diff on all slices of identifier."
* identifier 1..1
* identifier.value.extension 1..1
* identifier.assigner.identifier.system = "urn:oid:123456789" (exactly)