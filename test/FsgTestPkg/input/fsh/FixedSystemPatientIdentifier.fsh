// This is a simple example of a FSH file.
// This file can be renamed, and additional FSH files can be added.
// SUSHI will look for definitions in any file using the .fsh ending.
Profile: FixedSystemPatientIdentifier
Parent: Patient
Description: "A test profile of the Patient resource with fixed identifier system on all slices."
Id: fixed-system-patient-identifier
* identifier 1..2
* identifier.system = "http://example.org/fixed-system" (exactly)
* identifier.value 1..1 MS