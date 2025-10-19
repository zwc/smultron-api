export async function notifySlackOnError(lambdaName: string, error: any) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    // No webhook configured — skip notification
    return;
  }

  const workspace = 'secondbaseworkspace';
  const channel = 'alerts';

  const text = `:rotating_light: Error in lambda *${lambdaName}*\n*Workspace:* ${workspace}\n*Channel:* #${channel}\n*Error:* ${
    error && error.stack ? error.stack : String(error)
  }`;

  try {
    // Redact full webhook in logs but show prefix to help debugging
    const redacted = webhook.replace(/(https:\/\/hooks\.slack\.com\/services\/[^\/]+\/)[^\s]+/, '$1<redacted>');
    // eslint-disable-next-line no-console
    console.log(`Sending Slack notification to ${redacted} for lambda ${lambdaName}`);

    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    // Log the response status for debugging; non-2xx indicates failure
    // eslint-disable-next-line no-console
    console.log(`Slack webhook response: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const body = await res.text();
      // eslint-disable-next-line no-console
      console.error('Slack webhook error body:', body);
    }
  } catch (sendErr) {
    // Swallow to avoid cascading failures — but log locally
    // eslint-disable-next-line no-console
    console.error('Failed to send Slack notification', sendErr);
  }
}
