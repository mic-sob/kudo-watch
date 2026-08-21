import { z } from "zod";
import { nonEmptyString, parseJson } from "../utils/validation.js";

const discordInteractionSchema = z.object({
  type: z.number().int(),
  guild_id: nonEmptyString.optional(),
  data: z
    .object({
      name: nonEmptyString.optional(),
      options: z
        .array(
          z.object({
            type: z.number().int().optional(),
            name: nonEmptyString.optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  member: z
    .object({
      nick: z.string().nullable().optional(),
      user: z
        .object({
          id: nonEmptyString,
          username: nonEmptyString,
          global_name: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type DiscordInteraction = z.infer<typeof discordInteractionSchema>;

export function parseDiscordInteraction(body: string): DiscordInteraction {
  return parseJson(discordInteractionSchema, body);
}

export function isStravaConnectCommand(
  interaction: DiscordInteraction,
): boolean {
  return (
    interaction.type === 2 &&
    interaction.data?.name === "strava" &&
    interaction.data.options?.some(
      (option) => option.type === 1 && option.name === "connect",
    ) === true
  );
}

export function discordDisplayName(interaction: DiscordInteraction): string {
  const user = interaction.member?.user;
  if (user === undefined) {
    throw new Error("The Discord interaction does not contain a user.");
  }

  return interaction.member?.nick ?? user.global_name ?? user.username;
}
