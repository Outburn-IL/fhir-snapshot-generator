Profile: PractitionerQualificationSlices
Parent: Practitioner
Description: "Practitioner with complex Qualification slices"
* identifier 1..
* identifier ^slicing.discriminator.type = #value
* identifier ^slicing.discriminator.path = "system"
* identifier ^slicing.rules = #open
* identifier.assigner only Reference(OrganizationBasicProfile)
* identifier contains
    sliceA 0..1 MS and
    sliceB 0..1 MS
* identifier[sliceA].system = "http://practitioners.slices.net/A" (exactly)
* identifier[sliceB].system 1..
* identifier[sliceB].system = "http://practitioners.slices.net/B" (exactly)
* qualification ^slicing.discriminator.type = #pattern
* qualification ^slicing.discriminator.path = "code"
* qualification ^slicing.rules = #open
* qualification ^definition = "The official certifications, training, and licenses that authorize or otherwise pertain to the provision of care by the practitioner. For example, a medical license issued by a medical board authorizing the practitioner to practice medicine within a certian locality.\n\n<mark>Note:</mark> \n\n<b><u>Certificates of all professions except nursing</b></u>\n\n• For temporary license (slice: [moh-temp-practitioner-license]): code = 1; SHALL have identifier, consisting of profession code, a hyphen (\\\"-\\\"), followed by a number. Example - 1-1111;\n \n• For permanent license (slice: [moh-practitioner-license]): code = 2; SHALL have identifier, consisting of profession code, a hyphen (\\\"-\\\"), followed by a number. Example - 1-1111;\n \n• For certificate of expertise (slice: [moh-expertise]): code = 5; SHOULD (if available, not mandatory) have identifier, consisting of a number. Example - 12345;\n \n• For instructor certificate (slice: [moh-instructor]): code = 13; SHOULD (if available, not mandatory) have identifier, consisting of a number. Example - 12345;\n \nCheck each slice for more specific details."
* qualification contains
    sliceC 0..* and
    sliceD 0..*
* qualification[sliceC].code = #C
* qualification[sliceD].code = #D
* qualification[sliceC].identifier 1..
* qualification[sliceC].identifier.assigner only Reference(OrganizationBasicProfile)
* qualification[sliceD].issuer only Reference(OrganizationBasicProfile)
* qualification[sliceD].identifier ^slicing.discriminator.path = "system"
* qualification[sliceD].identifier ^slicing.discriminator.type = #value
* qualification[sliceD].identifier ^slicing.rules = #open
* qualification[sliceD].identifier contains
    sliceE 0..* and
    sliceF 0..*
* qualification[sliceD].identifier[sliceE].system = "http://practitioners.slices.net/E" (exactly)
* qualification[sliceD].identifier[sliceE].assigner only Reference(OrganizationBasicProfile)
* qualification[sliceD].identifier[sliceF].system = "http://practitioners.slices.net/F" (exactly)
