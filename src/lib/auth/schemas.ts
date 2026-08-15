import { z } from "zod";
import { signupRoles } from "@/types/signup-role";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.email(),
  phone: z.string().trim().optional(),
  password: z.string().min(8),
  role: z.enum(signupRoles),
});
