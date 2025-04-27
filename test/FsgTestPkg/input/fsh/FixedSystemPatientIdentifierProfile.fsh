// This is a simple example of a FSH file.
// This file can be renamed, and additional FSH files can be added.
// SUSHI will look for definitions in any file using the .fsh ending.
Profile: FixedSystemPatientIdentifierProfile
Parent: Patient
Description: "A test profile of the Patient resource with identifier profiles for all slices."
* identifier 1..*
* identifier only FixedSystemIdentifier