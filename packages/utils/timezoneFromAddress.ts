import {
  COUNTRY_PRIMARY_TIMEZONE,
  STATE_TIMEZONES,
} from "./timezoneData.ts";

/**
 * Derive a canonical IANA timezone from the structured address fields a
 * business provides. The address stores free-text `country` and `state`, so we
 * accept either ISO 3166 codes or English names (case/accent/punctuation
 * insensitive).
 *
 * Resolution order: country + state override -> country primary zone ->
 * `undefined` (the caller falls back to UTC).
 */

const STATE_NAME_TO_CODE: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  US: {
    alabama: "AL",
    alaska: "AK",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    delaware: "DE",
    "district of columbia": "DC",
    "washington dc": "DC",
    "washington d c": "DC",
    florida: "FL",
    georgia: "GA",
    hawaii: "HI",
    idaho: "ID",
    illinois: "IL",
    indiana: "IN",
    iowa: "IA",
    kansas: "KS",
    kentucky: "KY",
    louisiana: "LA",
    maine: "ME",
    maryland: "MD",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    mississippi: "MS",
    missouri: "MO",
    montana: "MT",
    nebraska: "NE",
    nevada: "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    ohio: "OH",
    oklahoma: "OK",
    oregon: "OR",
    pennsylvania: "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    tennessee: "TN",
    texas: "TX",
    utah: "UT",
    vermont: "VT",
    virginia: "VA",
    washington: "WA",
    "west virginia": "WV",
    wisconsin: "WI",
    wyoming: "WY",
    "puerto rico": "PR",
    "us virgin islands": "VI",
    "u s virgin islands": "VI",
    guam: "GU",
    "american samoa": "AS",
    "northern mariana islands": "MP",
  },
  CA: {
    alberta: "AB",
    "british columbia": "BC",
    manitoba: "MB",
    "new brunswick": "NB",
    "newfoundland and labrador": "NL",
    newfoundland: "NL",
    "nova scotia": "NS",
    "northwest territories": "NT",
    nunavut: "NU",
    ontario: "ON",
    "prince edward island": "PE",
    quebec: "QC",
    saskatchewan: "SK",
    yukon: "YT",
  },
  AU: {
    "australian capital territory": "ACT",
    "new south wales": "NSW",
    "northern territory": "NT",
    queensland: "QLD",
    "south australia": "SA",
    tasmania: "TAS",
    victoria: "VIC",
    "western australia": "WA",
  },
  BR: {
    acre: "AC",
    alagoas: "AL",
    amapa: "AP",
    amazonas: "AM",
    bahia: "BA",
    ceara: "CE",
    "distrito federal": "DF",
    "espirito santo": "ES",
    goias: "GO",
    maranhao: "MA",
    "mato grosso": "MT",
    "mato grosso do sul": "MS",
    "minas gerais": "MG",
    para: "PA",
    paraiba: "PB",
    parana: "PR",
    pernambuco: "PE",
    piaui: "PI",
    "rio de janeiro": "RJ",
    "rio grande do norte": "RN",
    "rio grande do sul": "RS",
    rondonia: "RO",
    roraima: "RR",
    "santa catarina": "SC",
    "sao paulo": "SP",
    sergipe: "SE",
    tocantins: "TO",
  },
  MX: {
    aguascalientes: "AGU",
    "baja california": "BCN",
    "baja california sur": "BCS",
    campeche: "CAM",
    chiapas: "CHP",
    chihuahua: "CHH",
    "ciudad de mexico": "CMX",
    "mexico city": "CMX",
    coahuila: "COA",
    colima: "COL",
    durango: "DUR",
    guanajuato: "GUA",
    guerrero: "GRO",
    hidalgo: "HID",
    jalisco: "JAL",
    mexico: "MEX",
    "estado de mexico": "MEX",
    michoacan: "MIC",
    morelos: "MOR",
    nayarit: "NAY",
    "nuevo leon": "NLE",
    oaxaca: "OAX",
    puebla: "PUE",
    queretaro: "QUE",
    "quintana roo": "ROO",
    "san luis potosi": "SLP",
    sinaloa: "SIN",
    sonora: "SON",
    tabasco: "TAB",
    tamaulipas: "TAM",
    tlaxcala: "TLA",
    veracruz: "VER",
    yucatan: "YUC",
    zacatecas: "ZAC",
  },
  ES: {
    canarias: "CN",
    "canary islands": "CN",
    "las palmas": "GC",
    "santa cruz de tenerife": "TF",
  },
  PT: {
    azores: "20",
    madeira: "30",
  },
  NZ: {
    "chatham islands": "CIT",
    chatham: "CIT",
  },
};

const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  america: "US",
  "united states of america": "US",
  usa: "US",
  "u s a": "US",
  "u s": "US",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "united kingdom of great britain and northern ireland": "GB",
  uae: "AE",
  emirates: "AE",
  korea: "KR",
  "republic of korea": "KR",
  "russian federation": "RU",
  holland: "NL",
  brasil: "BR",
  "czech republic": "CZ",
  "ivory coast": "CI",
  burma: "MM",
  swaziland: "SZ",
  "east timor": "TL",
  "cape verde": "CV",
  "dr congo": "CD",
  "democratic republic of the congo": "CD",
  "republic of the congo": "CG",
  "vatican city": "VA",
  "macedonia": "MK",
  "the gambia": "GM",
  "the bahamas": "BS",
};

const COUNTRY_NAME_TO_CODE: Readonly<Record<string, string>> = (() => {
  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  const map: Record<string, string> = {};
  for (const code of Object.keys(COUNTRY_PRIMARY_TIMEZONE)) {
    const name = displayNames.of(code);
    if (name) map[normalizeToken(name)] = code;
  }
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    map[normalizeToken(alias)] = code;
  }
  return map;
})();

/** Lower-case, strip accents, and collapse anything non-alphanumeric to spaces. */
function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveCountryCode(country: unknown): string | undefined {
  if (typeof country !== "string") return undefined;
  const raw = country.trim();
  if (raw.length === 0) return undefined;

  const upper = raw.toUpperCase();
  if (upper.length === 2 && COUNTRY_PRIMARY_TIMEZONE[upper]) return upper;

  const token = normalizeToken(raw);
  if (!token) return undefined;
  return COUNTRY_NAME_TO_CODE[token];
}

function resolveStateZone(
  countryCode: string,
  state: unknown,
): string | undefined {
  const countryStates = STATE_TIMEZONES[countryCode];
  if (!countryStates || typeof state !== "string") return undefined;

  const trimmed = state.trim();
  if (trimmed.length === 0) return undefined;

  const byCode = countryStates[trimmed.toUpperCase()];
  if (byCode) return byCode;

  const token = normalizeToken(trimmed);
  if (!token) return undefined;

  const code =
    STATE_NAME_TO_CODE[countryCode]?.[token] ??
    STATE_NAME_TO_CODE[countryCode]?.[stripStateSuffix(token)];
  return code ? countryStates[code] : undefined;
}

function stripStateSuffix(token: string): string {
  return token.replace(/^(state|province|department|region) of /, "");
}

export type AddressLike = {
  country?: unknown;
  state?: unknown;
};

/**
 * Resolve the canonical IANA timezone for a business address, or `undefined`
 * when the country/state cannot be mapped (caller falls back to UTC).
 */
export function resolveTimezoneFromAddress(
  address: AddressLike | null | undefined,
): string | undefined {
  if (!address) return undefined;
  const countryCode = resolveCountryCode(address.country);
  if (!countryCode) return undefined;
  return (
    resolveStateZone(countryCode, address.state) ??
    COUNTRY_PRIMARY_TIMEZONE[countryCode]
  );
}
