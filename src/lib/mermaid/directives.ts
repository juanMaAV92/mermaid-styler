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
