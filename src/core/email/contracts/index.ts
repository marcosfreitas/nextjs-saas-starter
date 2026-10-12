/**
 * Email port.
 *
 * Declared here because sending mail is a domain decision; which provider
 * delivers it is not. `infrastructure/email/` implements this.
 */

export interface EmailPayload {
  to: string | string[];
  subject: string;
  /**
   * Sent to the provider verbatim, so this field is an HTML sink: every
   * interpolated value must already be escaped by the caller. Building it with
   * a template string and a raw user value is a stored-XSS path into whatever
   * client renders the message.
   */
  html: string;
  text?: string;
  from?: string;
}

export interface IEmailProvider {
  send(payload: EmailPayload): Promise<void>;
}
