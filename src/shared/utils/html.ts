/**
 * HTML escaping for strings that end up inside an HTML sink.
 *
 * The sink this exists for is `EmailPayload.html`, which every provider sends
 * verbatim, but the same rule holds for any string this app builds and another
 * client renders. React escapes for you; a template string does not.
 */

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes the five characters that change the meaning of HTML text and of a
 * quoted attribute value.
 *
 * `&` is replaced first by virtue of being in the same pass: escaping it after
 * the others would turn an already-escaped `&lt;` into `&amp;lt;`, which is how
 * double-escaping bugs read in a mail client.
 *
 * This is safe for element text and for an attribute value that is quoted. It
 * is NOT enough for an unquoted attribute, for a `javascript:` or `data:` URL
 * in `href`/`src`, or for anything inside `<script>` or `<style>`. Those need
 * the value validated, not escaped.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

export type TemplateVars = Record<string, string | number>;

/**
 * Fills `{{name}}` placeholders in an HTML template.
 *
 * Everything in `vars` is escaped. Anything that must stay as markup goes in
 * `rawVars` instead, which is deliberately a separate argument: an escaping
 * helper whose escape can be switched off per value by a flag ends up called
 * with the flag on, and the call site reads the same either way. Here the
 * dangerous choice is a different object, so it shows up in review.
 *
 * Fails closed in three ways, because every one of them is a silent bug
 * otherwise:
 *
 * - a placeholder with no value throws, instead of shipping the literal
 *   `{{name}}` to a customer;
 * - a key present in both `vars` and `rawVars` throws, because which one wins
 *   would decide whether the value is escaped;
 * - a value that is neither string nor number throws, since `undefined` would
 *   otherwise render as the word "undefined" and an object as
 *   "[object Object]".
 */
export function renderTemplate(
  template: string,
  vars: TemplateVars,
  rawVars: Record<string, string> = {}
): string {
  const collisions = Object.keys(vars).filter((key) => key in rawVars);
  if (collisions.length > 0) {
    throw new Error(
      `renderTemplate: ${collisions.join(', ')} given as both escaped and raw.`
    );
  }

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    if (key in rawVars) return rawVars[key];

    if (!(key in vars)) {
      throw new Error(`renderTemplate: no value for placeholder '${key}'.`);
    }

    const value = vars[key];
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`renderTemplate: value for '${key}' is not a string or number.`);
    }

    return escapeHtml(String(value));
  });
}
