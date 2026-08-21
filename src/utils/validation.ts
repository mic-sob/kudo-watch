import { z, type ZodType } from "zod";

export const nonEmptyString = z.string().min(1);

export function parseJson<T>(schema: ZodType<T>, json: string): T {
  return schema.parse(JSON.parse(json));
}
