const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH_RECIPIENT_DEFAULT = 'andreas.franz@ecily.com';
const GRAPH_REQUEST_TIMEOUT_MS = 10000;

async function fetchGraph(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Graph mail service timed out');
      timeoutError.code = 'GRAPH_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    const error = new Error('Graph mail configuration is incomplete');
    error.code = 'GRAPH_NOT_CONFIGURED';
    throw error;
  }
  return value;
}
function getGraphConfig() {
  return {
    tenantId: requiredEnv('GRAPH_TENANT_ID'),
    clientId: requiredEnv('GRAPH_CLIENT_ID'),
    clientSecret: requiredEnv('GRAPH_CLIENT_SECRET'),
    sender: requiredEnv('GRAPH_SENDER_USER'),
    recipient: String(process.env.GRAPH_RECIPIENT_EMAIL || GRAPH_RECIPIENT_DEFAULT).trim(),
  };
}

export async function sendTesterKeyRequestEmail({ subject, content }) {
  const config = getGraphConfig();
  const tokenResponse = await fetchGraph(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: GRAPH_SCOPE,
        grant_type: 'client_credentials',
      }),
    },
  );

  if (!tokenResponse.ok) {
    throw new Error(`Graph token request failed with status ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken = String(tokenData?.access_token || '').trim();
  if (!accessToken) throw new Error('Graph token response did not contain an access token');

  const mailResponse = await fetchGraph(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.sender)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content },
          toRecipients: [{ emailAddress: { address: config.recipient } }],
        },
        saveToSentItems: false,
      }),
    },
  );

  if (!mailResponse.ok) {
    throw new Error(`Graph sendMail request failed with status ${mailResponse.status}`);
  }
}
