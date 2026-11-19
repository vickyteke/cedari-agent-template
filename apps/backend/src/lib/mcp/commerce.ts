import { z } from "zod";
import { productIdSchema } from "./identity";

export const cartSchema = z.object({ items: z.array(z.object({ productId: productIdSchema, quantity: z.number().int().min(1).max(20) }).strict()).min(1).max(50) }).strict();
export class CommerceError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
