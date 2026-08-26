import type { DiscordEmbed } from "../messages/activity-message.js";

export async function publishDiscordActivity(input: {
  readonly webhookUrl: string;
  readonly embed: DiscordEmbed;
  readonly attachment?: {
    readonly data: ArrayBuffer;
    readonly filename: string;
    readonly contentType: string;
  };
}): Promise<void> {
  const url = new URL(input.webhookUrl);
  url.searchParams.set("wait", "true");

  const payload = {
    username: "KudoWatch",
    embeds: [input.embed],
    allowed_mentions: { parse: [] },
  };

  let requestOptions: NonNullable<Parameters<typeof fetch>[1]>;

  if (input.attachment === undefined) {
    requestOptions = {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    };
  } else {
    const formData = new FormData();
    formData.set(
      "payload_json",
      JSON.stringify({
        ...payload,
        attachments: [{ id: 0, filename: input.attachment.filename }],
      }),
    );
    formData.set(
      "files[0]",
      new Blob([input.attachment.data], {
        type: input.attachment.contentType,
      }),
      input.attachment.filename,
    );
    requestOptions = { body: formData };
  }

  const response = await fetch(url, {
    method: "POST",
    ...requestOptions,
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook rejected the message: ${response.status}.`);
  }
}
