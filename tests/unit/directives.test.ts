import { describe, expect, it } from 'vitest';
import { hasThemeDirective, pickSourceThemeVariables } from '../../src/lib/mermaid/directives';

describe('hasThemeDirective', () => {
  it.each([
    ['init with double-quoted themeVariables', '%%{init: {"themeVariables": {"primaryColor": "#ff0000"}}}%%\nflowchart LR\n  A --> B'],
    ['init with single-quoted theme', "%%{init: {'theme':'dark'}}%%\nflowchart LR\n  A --> B"],
    ['initialize with whitespace', "  %%{ initialize : { 'theme' : 'forest' } }%%\ngraph TD\n  A --> B"],
    ['init with unquoted theme key', '%%{init: {theme: "dark"}}%%\nflowchart LR\n  A --> B'],
    ['multi-line init', '%%{\n  init: {\n    "themeVariables": {\n      "lineColor": "#f00"\n    }\n  }\n}%%\nflowchart LR\n  A --> B'],
    ['frontmatter config.theme', '---\nconfig:\n  theme: dark\n---\nflowchart LR\n  A --> B'],
    ['frontmatter config.themeVariables', '---\ntitle: Demo\nconfig:\n  themeVariables:\n    primaryColor: "#ff0000"\n---\nflowchart LR\n  A --> B'],
    ['frontmatter with CRLF and quoted key', '---\r\nconfig:\r\n  "theme": dark\r\n---\r\nflowchart LR\r\n  A --> B'],
  ])('detects %s', (_name, source) => {
    expect(hasThemeDirective(source)).toBe(true);
  });

  it.each([
    ['plain flowchart', 'flowchart LR\n  A --> B'],
    ['comment mentioning theme', '%% this diagram uses our theme and themeVariables\nflowchart LR\n  A --> B'],
    ['init without theme keys', '%%{init: {"flowchart": {"curve": "basis"}}}%%\nflowchart LR\n  A --> B'],
    ['init with only themeCSS', '%%{init: {"themeCSS": ".node rect { fill: red; }"}}%%\nflowchart LR\n  A --> B'],
    ['node label mentioning theme', 'flowchart LR\n  A["theme: dark"] --> B["themeVariables"]'],
    ['frontmatter without theme config', '---\ntitle: theme ideas\nconfig:\n  flowchart:\n    curve: basis\n---\nflowchart LR\n  A --> B'],
    ['frontmatter theme outside config', '---\ntheme: dark\n---\nflowchart LR\n  A --> B'],
    ['dashes later in the source', 'flowchart LR\n  A --> B\n---\nconfig:\n  theme: dark\n---'],
  ])('ignores %s', (_name, source) => {
    expect(hasThemeDirective(source)).toBe(false);
  });
});

describe('pickSourceThemeVariables', () => {
  it('keeps colour values and a numeric fontSize', () => {
    expect(pickSourceThemeVariables({
      primaryColor: '#ff0000',
      lineColor: '#0f08',
      secondaryColor: 'rgb(1, 2, 3)',
      tertiaryColor: 'hsla(120deg 50% 50% / 0.5)',
      background: 'RebeccaPurple',
      mainBkg: 'transparent',
      fontSize: '18px',
    })).toEqual({
      primaryColor: '#ff0000',
      lineColor: '#0f08',
      secondaryColor: 'rgb(1, 2, 3)',
      tertiaryColor: 'hsla(120deg 50% 50% / 0.5)',
      background: 'RebeccaPurple',
      mainBkg: 'transparent',
      fontSize: '18px',
    });
  });

  it('drops anything that is not a plain colour, plus secure and font keys', () => {
    expect(pickSourceThemeVariables({
      primaryColor: 'url(https://evil.example/a.png)',
      mainBkg: 'url(evilrel1)',
      lineColor: 'red; background: blue',
      nodeBorder: 'expression(alert(1))',
      edgeLabelBackground: 'rgb(var(--x))',
      clusterBkg: '#12345',
      textColor: 'notacolour',
      themeCSS: '.node { fill: red }',
      fontFamily: 'Arial',
      altFontFamily: 'Arial',
      fontSize: '16px; x',
      darkMode: true,
      nested: { primaryColor: '#ff0000' },
      empty: '',
    })).toEqual({});
  });

  it('returns an empty object for non-objects', () => {
    expect(pickSourceThemeVariables(undefined)).toEqual({});
    expect(pickSourceThemeVariables('red')).toEqual({});
    expect(pickSourceThemeVariables(['#fff'])).toEqual({});
  });
});
