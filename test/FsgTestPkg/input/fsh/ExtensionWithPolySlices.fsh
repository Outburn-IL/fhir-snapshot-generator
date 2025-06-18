Extension: ExtensionWithPolySlices
Description: "An extension with slices on value[x]"
* ^status = #draft
* value[x] only string or code or boolean // Allowing three types
* valueString = "A fixed string value" (exactly) // slice for one type
* valueCode = #some-code (exactly) // slice for a second type
// no slice for boolean, yet it is still a valid option for value[x]