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
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (sendErr) {
    // Swallow to avoid cascading failures — but log locally
    // eslint-disable-next-line no-console
    console.error('Failed to send Slack notification', sendErr);
  }
}
