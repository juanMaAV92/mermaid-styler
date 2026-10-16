/** Matches `theme` or `themeVariables` used as a key (quoted or not); the trailing `:` keeps `themeCSS` out. */
const THEME_KEY = /(?:^|[\s{,])["']?(?:theme|themeVariables)["']?\s*:/m;

/** Same shape Mermaid uses to detect leading YAML frontmatter. */
const FRONTMATTER = /^-{3}\s*[\n\r](.*?)[\n\r]-{3}\s*[\n\r]+/s;

/** `%%{init: …}%%` / `%%{initialize: …}%%` directives, possibly spanning lines. */
const INIT_DIRECTIVE = /%%\{\s*init(?:ialize)?\s*:([\s\S]*?)\}%%/g;

const frontmatterSetsTheme = (frontmatter: string): boolean => {
  const lines = frontmatter.split(/\r?\n|\r/);
  let configIndent: number | undefined;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (configIndent === undefined) {
      if (/^\s*["']?config["']?\s*:\s*$/.test(line)) configIndent = indent;
      continue;
    }
    if (indent <= configIndent) {
      configIndent = undefined;
      if (/^\s*["']?config["']?\s*:\s*$/.test(line)) configIndent = indent;
      continue;
    }
    if (/^\s*["']?(?:theme|themeVariables)["']?\s*:/.test(line)) return true;
  }
  return false;
};

/**
 * True when the source sets its own theme via a `%%{init}%%` directive or leading YAML frontmatter `config:`.
 * A text heuristic for the UI notice only; the renderer blocks these keys through Mermaid's `secure` list.
 */
export const hasThemeDirective = (source: string): boolean => {
  const frontmatter = FRONTMATTER.exec(source);
  if (frontmatter?.[1] && frontmatterSetsTheme(frontmatter[1])) return true;
  for (const match of source.matchAll(INIT_DIRECTIVE)) {
    if (THEME_KEY.test(match[1] ?? '')) return true;
  }
  return false;
};

/** Longest value considered at all; checked before any regex so matching cost stays bounded. */
const MAX_THEME_VALUE_LENGTH = 64;

const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
/** A bounded number: up to 3 integer and 3 fraction digits, optional `%` or `deg`. */
const NUM = String.raw`[-+]?(?:\d{1,3}(?:\.\d{1,3})?|\.\d{1,3})(?:%|deg)?`;
/**
 * Supported grammar: `rgb|rgba|hsl|hsla(` three numbers separated by `,` or whitespace, an optional fourth
 * (alpha) after `,` or `/`, then `)`. Every repetition needs a separator, so there is no ambiguous backtracking.
 */
/** `,` with optional spaces, or whitespace alone; the two branches never match the same text. */
const SEP = String.raw`(?:\s*,\s*|\s+)`;
const FUNCTIONAL_COLOR = new RegExp(
  String.raw`^(?:rgba?|hsla?)\(\s*${NUM}(?:${SEP}${NUM}){2}(?:\s*[,/]\s*${NUM})?\s*\)$`,
  'i',
);
const FONT_SIZE = /^\d{1,3}(?:\.\d{1,2})?(?:px)?$/;

/** CSS named colours (CSS Color 4) plus `transparent`, lower-cased. */
const NAMED_COLORS = new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue
darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred
darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green
greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon
lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon
lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta
maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab
orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna
silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet
wheat white whitesmoke yellow yellowgreen transparent`.split(/\s+/));

/** Keys never re-fed from the source, whatever their value (CSS/font injection surfaces and secure keys). */
const NEVER_FROM_SOURCE = new Set(['themeCSS', 'fontFamily', 'altFontFamily', 'secure', 'securityLevel', 'startOnLoad',
  'maxTextSize', 'suppressErrorRendering', 'maxEdges', '__proto__', 'constructor', 'prototype']);

const isColor = (value: string) => HEX_COLOR.test(value) || FUNCTIONAL_COLOR.test(value)
  || NAMED_COLORS.has(value.toLowerCase());

/**
 * D1 defense in depth: the source themeVariables the app re-feeds into `mermaid.initialize` when the author opts
 * into the source theme. Only plain colour values pass (plus a numeric `fontSize`); font, CSS and any other key
 * or value shape is dropped, whatever Mermaid's own sanitizer let through.
 */
export const pickSourceThemeVariables = (themeVariables: unknown): Record<string, string> => {
  if (typeof themeVariables !== 'object' || themeVariables === null || Array.isArray(themeVariables)) return {};
  const picked: Record<string, string> = {};
  for (const [key, raw] of Object.entries(themeVariables)) {
    if (typeof raw !== 'string') continue;
    if (raw.length > MAX_THEME_VALUE_LENGTH) continue;
    const value = raw.trim();
    if (key === 'fontSize') {
      if (FONT_SIZE.test(value)) picked[key] = value;
    } else if (!NEVER_FROM_SOURCE.has(key) && isColor(value)) {
      picked[key] = value;
    }
  }
  return picked;
};
