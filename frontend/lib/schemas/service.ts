import { z } from "zod";

export const serviceCreateSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(64, "Slug must be 64 characters or fewer")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, digits, and hyphens"),
  display_name: z
    .string()
    .min(1, "Display name is required")
    .max(200, "Display name must be 200 characters or fewer"),
  public_visible: z.boolean().default(true),
  expected_interval_seconds: z
    .number()
    .int("Must be a whole number")
    .min(10, "Minimum 10 seconds")
    .max(3600, "Maximum 3600 seconds")
    .optional(),
});

export type ServiceCreateValues = z.infer<typeof serviceCreateSchema>;
