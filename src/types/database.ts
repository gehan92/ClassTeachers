/**
 * Types for the schema in supabase/migrations (0001-0019), hand-written to
 * match those files exactly rather than machine-generated — this project
 * doesn't have the Supabase CLI authenticated against the hosted project,
 * so `supabase gen types typescript` isn't runnable here. If that ever
 * changes, regenerating is a straight swap:
 *
 *   npx supabase gen types typescript --project-id ktiygwsrpamqpdxmrlot > src/types/database.ts
 *
 * Until then, whoever adds or edits a migration should update the matching
 * table below in the same change.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type OwnerType = "teacher" | "class";
type ProfileStatus = "pending" | "approved" | "rejected" | "suspended";
type GradeBand = "1-5" | "6-9" | "10-11" | "12-13" | "campus";

export type Database = {
  public: {
    Tables: {
      locales: {
        Row: {
          code: string;
          label: string;
          native_label: string;
          is_active: boolean;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          code: string;
          label: string;
          native_label: string;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          code?: string;
          label?: string;
          native_label?: string;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          role: "student" | "teacher" | "class" | "campus_lecturer" | "admin";
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          preferred_locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: "student" | "teacher" | "class" | "campus_lecturer" | "admin";
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "student" | "teacher" | "class" | "campus_lecturer" | "admin";
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      teacher_profiles: {
        Row: {
          id: string;
          headline: string | null;
          bio: string | null;
          qualifications: string | null;
          experience_years: number | null;
          class_type: "physical" | "online" | "both";
          location: string | null;
          photo_url: string | null;
          status: ProfileStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          headline?: string | null;
          bio?: string | null;
          qualifications?: string | null;
          experience_years?: number | null;
          class_type?: "physical" | "online" | "both";
          location?: string | null;
          photo_url?: string | null;
          status?: ProfileStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          headline?: string | null;
          bio?: string | null;
          qualifications?: string | null;
          experience_years?: number | null;
          class_type?: "physical" | "online" | "both";
          location?: string | null;
          photo_url?: string | null;
          status?: ProfileStatus;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      class_profiles: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          ad_content: string | null;
          photo_url: string | null;
          location: string | null;
          status: ProfileStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          ad_content?: string | null;
          photo_url?: string | null;
          location?: string | null;
          status?: ProfileStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          ad_content?: string | null;
          photo_url?: string | null;
          location?: string | null;
          status?: ProfileStatus;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      class_teachers: {
        Row: {
          class_id: string;
          teacher_id: string;
          is_visible: boolean;
          joined_at: string;
        };
        Insert: {
          class_id: string;
          teacher_id: string;
          is_visible?: boolean;
          joined_at?: string;
        };
        Update: {
          class_id?: string;
          teacher_id?: string;
          is_visible?: boolean;
          joined_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      subjects: {
        Row: {
          id: string;
          slug: string;
          translations: Json;
          grade_band: GradeBand | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          translations?: Json;
          grade_band?: GradeBand | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          translations?: Json;
          grade_band?: GradeBand | null;
          created_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      subject_links: {
        Row: {
          owner_type: OwnerType;
          owner_id: string;
          subject_id: string;
        };
        Insert: {
          owner_type: OwnerType;
          owner_id: string;
          subject_id: string;
        };
        Update: {
          owner_type?: OwnerType;
          owner_id?: string;
          subject_id?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      notes: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id: string | null;
          batch_id: string | null;
          title: string;
          translations: Json;
          file_path: string;
          page_count: number | null;
          watermark_settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id?: string | null;
          batch_id?: string | null;
          title: string;
          translations?: Json;
          file_path: string;
          page_count?: number | null;
          watermark_settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          subject_id?: string | null;
          batch_id?: string | null;
          title?: string;
          translations?: Json;
          file_path?: string;
          page_count?: number | null;
          watermark_settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      batches: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id: string | null;
          title: string;
          mode: "online" | "physical";
          location: string | null;
          schedule_note: string | null;
          teacher_label: string | null;
          grade_band: GradeBand | null;
          status: "active" | "upcoming" | "closed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id?: string | null;
          title: string;
          mode: "online" | "physical";
          location?: string | null;
          schedule_note?: string | null;
          teacher_label?: string | null;
          grade_band?: GradeBand | null;
          status?: "active" | "upcoming" | "closed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          subject_id?: string | null;
          title?: string;
          mode?: "online" | "physical";
          location?: string | null;
          schedule_note?: string | null;
          teacher_label?: string | null;
          grade_band?: GradeBand | null;
          status?: "active" | "upcoming" | "closed";
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      question_bank_items: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id: string | null;
          question_text: string;
          type: "theory" | "practical";
          difficulty: "easy" | "medium" | "hard";
          correct_answer: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id?: string | null;
          question_text: string;
          type: "theory" | "practical";
          difficulty?: "easy" | "medium" | "hard";
          correct_answer?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          subject_id?: string | null;
          question_text?: string;
          type?: "theory" | "practical";
          difficulty?: "easy" | "medium" | "hard";
          correct_answer?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      exams: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id: string | null;
          title: string;
          question_ids: string[];
          duration_minutes: number;
          scheduled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id?: string | null;
          title: string;
          question_ids?: string[];
          duration_minutes: number;
          scheduled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          subject_id?: string | null;
          title?: string;
          question_ids?: string[];
          duration_minutes?: number;
          scheduled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      exam_submissions: {
        Row: {
          id: string;
          exam_id: string;
          student_id: string;
          photo_urls: string[];
          compiled_pdf_path: string | null;
          status: "pending" | "graded";
          grade: number | null;
          feedback: string | null;
          submitted_at: string;
          graded_at: string | null;
        };
        Insert: {
          id?: string;
          exam_id: string;
          student_id: string;
          photo_urls?: string[];
          compiled_pdf_path?: string | null;
          status?: "pending" | "graded";
          grade?: number | null;
          feedback?: string | null;
          submitted_at?: string;
          graded_at?: string | null;
        };
        Update: {
          id?: string;
          exam_id?: string;
          student_id?: string;
          photo_urls?: string[];
          compiled_pdf_path?: string | null;
          status?: "pending" | "graded";
          grade?: number | null;
          feedback?: string | null;
          submitted_at?: string;
          graded_at?: string | null;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      live_classes: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id: string | null;
          title: string;
          mode: "online" | "physical";
          location: string | null;
          scheduled_at: string;
          duration_minutes: number;
          status: "scheduled" | "live" | "completed" | "cancelled";
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id?: string | null;
          title: string;
          mode: "online" | "physical";
          location?: string | null;
          scheduled_at: string;
          duration_minutes?: number;
          status?: "scheduled" | "live" | "completed" | "cancelled";
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          subject_id?: string | null;
          title?: string;
          mode?: "online" | "physical";
          location?: string | null;
          scheduled_at?: string;
          duration_minutes?: number;
          status?: "scheduled" | "live" | "completed" | "cancelled";
          created_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      live_class_links: {
        Row: {
          live_class_id: string;
          join_link: string;
        };
        Insert: {
          live_class_id: string;
          join_link: string;
        };
        Update: {
          live_class_id?: string;
          join_link?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      enrollments: {
        Row: {
          id: string;
          student_id: string;
          owner_type: OwnerType;
          owner_id: string;
          batch_id: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          owner_type: OwnerType;
          owner_id: string;
          batch_id?: string | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          batch_id?: string | null;
          joined_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      advertisements: {
        Row: {
          id: string;
          owner_type: "teacher" | "class" | "standalone" | "site";
          owner_id: string | null;
          purchased_by: string | null;
          title: string;
          content: string | null;
          placement: "own_profile" | "search_results" | "homepage_banner" | "homepage_spotlight";
          plan: "basic" | "featured" | "homepage_spotlight";
          status: "active" | "expired" | "removed";
          starts_at: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_type: "teacher" | "class" | "standalone" | "site";
          owner_id?: string | null;
          purchased_by?: string | null;
          title: string;
          content?: string | null;
          placement?: "own_profile" | "search_results" | "homepage_banner" | "homepage_spotlight";
          plan: "basic" | "featured" | "homepage_spotlight";
          status?: "active" | "expired" | "removed";
          starts_at?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: "teacher" | "class" | "standalone" | "site";
          owner_id?: string | null;
          purchased_by?: string | null;
          title?: string;
          content?: string | null;
          placement?: "own_profile" | "search_results" | "homepage_banner" | "homepage_spotlight";
          plan?: "basic" | "featured" | "homepage_spotlight";
          status?: "active" | "expired" | "removed";
          starts_at?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      reviews: {
        Row: {
          id: string;
          reviewer_id: string;
          target_type: "teacher" | "class" | "teacher_in_class";
          target_id: string;
          rating: number;
          comment: string | null;
          reply_text: string | null;
          is_flagged: boolean;
          flagged_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reviewer_id: string;
          target_type: "teacher" | "class" | "teacher_in_class";
          target_id: string;
          rating: number;
          comment?: string | null;
          reply_text?: string | null;
          is_flagged?: boolean;
          flagged_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reviewer_id?: string;
          target_type?: "teacher" | "class" | "teacher_in_class";
          target_id?: string;
          rating?: number;
          comment?: string | null;
          reply_text?: string | null;
          is_flagged?: boolean;
          flagged_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      prices: {
        Row: {
          id: string;
          owner_type: "teacher" | "class" | "teacher_in_class";
          owner_id: string;
          hourly_rate: number | null;
          monthly_rate: number | null;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: "teacher" | "class" | "teacher_in_class";
          owner_id: string;
          hourly_rate?: number | null;
          monthly_rate?: number | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: "teacher" | "class" | "teacher_in_class";
          owner_id?: string;
          hourly_rate?: number | null;
          monthly_rate?: number | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      platform_subscriptions: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          plan: "free" | "standard" | "premium";
          status: "active" | "past_due" | "canceled";
          renews_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          plan?: "free" | "standard" | "premium";
          status?: "active" | "past_due" | "canceled";
          renews_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          plan?: "free" | "standard" | "premium";
          status?: "active" | "past_due" | "canceled";
          renews_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_owner: {
        Args: { p_owner_type: string; p_owner_id: string };
        Returns: boolean;
      };
      is_enrolled: {
        Args: { p_owner_type: string; p_owner_id: string };
        Returns: boolean;
      };
      resolve_owner_type: {
        Args: { p_owner_type: string };
        Returns: string;
      };
      mask_display_name: {
        Args: { full_name: string };
        Returns: string | null;
      };
      get_teacher_contact: {
        Args: { p_teacher_id: string };
        Returns: string | null;
      };
      owns_exam: {
        Args: { p_exam_id: string };
        Returns: boolean;
      };
      list_public_teachers: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          role: string;
          display_name: string | null;
          headline: string | null;
          location: string | null;
          class_type: string;
          hourly_rate: number | null;
          monthly_rate: number | null;
          rating: number;
          review_count: number;
          subjects: string[];
          grade_band: string | null;
        }[];
      };
      list_public_classes: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          location: string | null;
          hourly_rate: number | null;
          monthly_rate: number | null;
          rating: number;
          review_count: number;
          subjects: string[];
          grade_band: string | null;
          online: boolean;
          teacher_count: number;
        }[];
      };
    };

    Enums: Record<string, never>;

    CompositeTypes: Record<string, never>;
  };
};
