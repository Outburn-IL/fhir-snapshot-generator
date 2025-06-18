Extension: ExtensionWithPolySlice
Description: "An extension with one slice on value[x]"
* ^status = #draft
* value[x] only string or boolean // Allowing two types
* valueString = "A fixed string value" (exactly) // slice for one type
// no slice for boolean, yet it is still a valid option for value[x]