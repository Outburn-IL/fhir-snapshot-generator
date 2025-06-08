Extension: ComplexLiberalExtension
Description: "An extension that defines two liberal child elements"
* ^status = #draft
* extension contains
    childA 0..1 and
    childB 0..*
* extension[childA].url = "childA" (exactly)
* extension[childB].url = "childB" (exactly)