Alias: $sct = http://snomed.info/sct
Alias: $patient-disability = http://hl7.org/fhir/StructureDefinition/patient-disability

Profile: HearingLossDisability
Parent: $patient-disability
Id: ext-hearing-loss
* ^status = #draft
* value[x].coding 1..
* value[x].coding = $sct#15188001 "Hearing loss (disorder)" (exactly)