import type { DiscordEmbed } from "../messages/activity-message.js";

export async function publishDiscordActivity(input: {
  readonly webhookUrl: string;
  readonly embed: DiscordEmbed;
}): Promise<void> {
  const url = new URL(input.webhookUrl);
  url.searchParams.set("wait", "true");

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "KudoWatch",
      embeds: [input.embed],
      allowed_mentions: { parse: [] },
    }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook rejected the message: ${response.status}.`);
  }
}
