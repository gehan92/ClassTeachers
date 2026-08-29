import { z } from "zod";
import { signupRoles } from "@/types/signup-role";
import { academicTitles } from "@/types/academic-title";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const requestPasswordResetSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2),
    email: z.email(),
    phone: z.string().trim().optional(),
    password: z.string().min(8),
    role: z.enum(signupRoles),
    // Shared by Teacher/Lecturer/Class — see the superRefine below.
    subject: z.string().trim().optional(),
    online: z.boolean().optional(),
    // Teacher only.
    headline: z.string().trim().optional(),
    description: z.string().trim().optional(),
    inPerson: z.boolean().optional(),
    // Campus Lecturer only.
    institution: z.string().trim().optional(),
    academicTitle: z.enum(academicTitles).optional(),
    qualification: z.string().trim().optional(),
    onCampus: z.boolean().optional(),
    // Class / Institute only.
    instituteName: z.string().trim().optional(),
    location: z.string().trim().optional(),
    physical: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "teacher") {
      if (!data.subject) {
        ctx.addIssue({ code: "custom", path: ["subject"], message: "Subject is required" });
      }
      if (!data.headline) {
        ctx.addIssue({ code: "custom", path: ["headline"], message: "Ad headline is required" });
      }
      if (!data.description) {
        ctx.addIssue({ code: "custom", path: ["description"], message: "Description is required" });
      }
      if (!data.inPerson && !data.online) {
        ctx.addIssue({ code: "custom", path: ["inPerson"], message: "Pick at least one lesson format" });
      }
    }

    if (data.role === "lecturer") {
      if (!data.institution) {
        ctx.addIssue({ code: "custom", path: ["institution"], message: "Institution is required" });
      }
      if (!data.academicTitle) {
        ctx.addIssue({ code: "custom", path: ["academicTitle"], message: "Academic title is required" });
      }
      if (!data.qualification) {
        ctx.addIssue({ code: "custom", path: ["qualification"], message: "Qualification is required" });
      }
      if (!data.subject) {
        ctx.addIssue({ code: "custom", path: ["subject"], message: "Subject is required" });
      }
      if (!data.onCampus && !data.online) {
        ctx.addIssue({ code: "custom", path: ["onCampus"], message: "Pick at least one teaching mode" });
      }
    }

    if (data.role === "class") {
      if (!data.instituteName) {
        ctx.addIssue({ code: "custom", path: ["instituteName"], message: "Institute name is required" });
      }
      if (!data.subject) {
        ctx.addIssue({ code: "custom", path: ["subject"], message: "Subject is required" });
      }
      if (!data.location) {
        ctx.addIssue({ code: "custom", path: ["location"], message: "Location is required" });
      }
      if (!data.physical && !data.online) {
        ctx.addIssue({ code: "custom", path: ["physical"], message: "Pick at least one class type" });
      }
    }
  });
