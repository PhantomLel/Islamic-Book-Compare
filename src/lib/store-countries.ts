const storeCountries: Record<string, string> = {
    "Dar Al-Muttaqin": "UK",
    "Maktabah Al-Hidayah": "NA",
    "Ismaeel Books": "UK",
    "Al-Badr": "UK",
    "Al-Balagh": "NA",
    "Al-Kunuz": "UK",
    "Qurtuba": "UK",
    "Sifatu Safwa": "UK",
    "Zakariyya Books": "UK",
    "Salafi Books": "UK",
    "UmmahSpot": "NA",
    "Al-Hidayaah": "UK",
    "Buraq Books": "UK",
    "Kastntinya": "TUR",
    "Maktabah Abu Hanifah": "UK",
    "Irfan Books": "NA",
    "JQU Bookstore": "NA",
    "Irsad": "TUR",
    "Darul Hikmah Bookstore": "NA",
    "Darul Iman Books" : "NA",
    "Kunuz" : "UK",
    "Osman Books" : "UK",
    "Tahsil Yayinevi" : "TUR",
    "Anadolu Kitabevi" : "TUR",
    "Safinat Ul-Najat": "UK",
    "Islamic Bookstore": "NA",
    "Jarir Books USA": "NA",
    "Mecca Books": "NA",
    "Turath Publishing": "UK",
    "White Thread Press": "UK",
    "Imam Ghazali Publishing": "NA",
    "Mawlana Books": "NA",
}

/** Region code for a store name (`UK`, `NA`, `TUR`), or undefined when unmapped. */
export function storeCountryLabel(source: string | undefined): string | undefined {
    if (!source) return undefined;
    return storeCountries[source];
}

export { storeCountries };
