// This is a simple example of a FSH file.
// This file can be renamed, and additional FSH files can be added.
// SUSHI will look for definitions in any file using the .fsh ending.
Profile: SimpleCardinalityPatient
Parent: Patient
Description: "A test profile of the Patient resource with simple cardinality diffs only."
* name 1..* MS
* birthDate 1..1
* address 0..0