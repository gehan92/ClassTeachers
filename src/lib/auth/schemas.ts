import { z } from "zod";
import { signupRoles } from "@/types/signup-role";
import { academicTitles } from "@/types/academic-title";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2),
    email: z.email(),
    phone: z.string().trim().optional(),
    password: z.string().min(8),
    role: z.enum(signupRoles),
    // Teacher only — see the superRefine below.
    subject: z.string().trim().optional(),
    headline: z.string().trim().optional(),
    description: z.string().trim().optional(),
    inPerson: z.boolean().optional(),
    online: z.boolean().optional(),
    // Campus Lecturer only — see the superRefine below.
    institution: z.string().trim().optional(),
    academicTitle: z.enum(academicTitles).optional(),
    qualification: z.string().trim().optional(),
    onCampus: z.boolean().optional(),
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
  });
