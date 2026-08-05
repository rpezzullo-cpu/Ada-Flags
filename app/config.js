/* Ada Hub site configuration.
 *
 * ENTRA_CLIENT_ID enables real "Sign in with Microsoft" (Suitsupply accounts
 * only). Until it is filled in, the app falls back to self-declared identity
 * and the admin console shows an "unverified" warning.
 *
 * To enable (one-time, ~5 minutes, no admin consent needed):
 *   1. portal.azure.com -> Microsoft Entra ID -> App registrations -> New.
 *      Name: "Ada Hub". Supported account types: Single tenant.
 *   2. Authentication -> Add a platform -> Single-page application ->
 *      Redirect URI: https://rpezzullo-cpu.github.io/Ada-Flags/
 *   3. Copy the Application (client) ID and paste it below.
 *   4. Commit this file (or edit it directly on GitHub) - the site redeploys
 *      automatically.
 *
 * The client ID is public by design (it identifies the app, it is not a
 * secret). The tenant ID pins sign-in to suitsupply.com accounts.
 */
window.ADA_CONFIG = {
  TENANT_ID: 'fbe43f29-18b2-46ca-a741-bcc4672ba19c',
  ENTRA_CLIENT_ID: '',
  JIRA_BROWSE_URL: 'https://suitsupply.atlassian.net/browse/'
};
