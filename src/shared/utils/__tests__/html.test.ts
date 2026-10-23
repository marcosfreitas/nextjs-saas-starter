/**
 * @jest-environment node
 */
import { escapeHtml, renderTemplate } from '../html';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes an ampersand once, not twice', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('defuses a script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Olá, Marcos')).toBe('Olá, Marcos');
  });
});

describe('renderTemplate', () => {
  it('escapes every interpolated value', () => {
    const html = renderTemplate('<p>Oi {{name}}</p>', { name: '<img onerror=alert(1)>' });
    expect(html).toBe('<p>Oi &lt;img onerror=alert(1)&gt;</p>');
  });

  it('accepts whitespace inside the placeholder', () => {
    expect(renderTemplate('{{ name }}', { name: 'ok' })).toBe('ok');
  });

  it('renders a number', () => {
    expect(renderTemplate('{{n}} itens', { n: 3 })).toBe('3 itens');
  });

  it('passes rawVars through as markup', () => {
    const html = renderTemplate('{{body}}', {}, { body: '<strong>oi</strong>' });
    expect(html).toBe('<strong>oi</strong>');
  });

  it('throws when a placeholder has no value', () => {
    expect(() => renderTemplate('{{missing}}', {})).toThrow(/no value for placeholder/);
  });

  it('throws when a key is both escaped and raw', () => {
    expect(() => renderTemplate('{{x}}', { x: 'a' }, { x: 'b' })).toThrow(/both escaped and raw/);
  });

  it('throws on a value that is neither string nor number', () => {
    const vars = { x: undefined } as unknown as Record<string, string>;
    expect(() => renderTemplate('{{x}}', vars)).toThrow(/not a string or number/);
  });

  it('replaces every occurrence, not only the first', () => {
    expect(renderTemplate('{{a}}-{{a}}', { a: 'x' })).toBe('x-x');
  });
});
