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
export type ProfileStatus = "pending" | "approved" | "rejected" | "suspended";
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
          grade_level: string | null;
          bio: string | null;
          education_level: "school" | "campus" | "graduated" | null;
          institution_name: string | null;
          qualifications: string[] | null;
          work_experience: string[] | null;
          subjects: string[] | null;
          languages: string[] | null;
          share_phone_with_teachers: boolean;
          date_of_birth: string | null;
          location: string | null;
          learning_goals: string | null;
          preferred_mode: "online" | "in_person" | "both" | null;
          achievements: string[] | null;
          interests: string[] | null;
          availability: string | null;
          notification_prefs: Json;
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
          grade_level?: string | null;
          bio?: string | null;
          education_level?: "school" | "campus" | "graduated" | null;
          institution_name?: string | null;
          qualifications?: string[] | null;
          work_experience?: string[] | null;
          subjects?: string[] | null;
          languages?: string[] | null;
          share_phone_with_teachers?: boolean;
          date_of_birth?: string | null;
          location?: string | null;
          learning_goals?: string | null;
          preferred_mode?: "online" | "in_person" | "both" | null;
          achievements?: string[] | null;
          interests?: string[] | null;
          availability?: string | null;
          notification_prefs?: Json;
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
          grade_level?: string | null;
          bio?: string | null;
          education_level?: "school" | "campus" | "graduated" | null;
          institution_name?: string | null;
          qualifications?: string[] | null;
          work_experience?: string[] | null;
          subjects?: string[] | null;
          languages?: string[] | null;
          share_phone_with_teachers?: boolean;
          date_of_birth?: string | null;
          location?: string | null;
          learning_goals?: string | null;
          preferred_mode?: "online" | "in_person" | "both" | null;
          achievements?: string[] | null;
          interests?: string[] | null;
          availability?: string | null;
          notification_prefs?: Json;
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
          qualifications: string[] | null;
          work_experience: string[] | null;
          experience_years: number | null;
          class_type: "physical" | "online" | "both";
          location: string | null;
          photo_url: string | null;
          institution: string | null;
          academic_title: string | null;
          institution_verified: boolean;
          publications: string[] | null;
          verification_document_path: string | null;
          verification_submitted_at: string | null;
          status: ProfileStatus;
          owner_published: boolean;
          contact_mode: "phone" | "messaging_only";
          languages: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          headline?: string | null;
          bio?: string | null;
          qualifications?: string[] | null;
          work_experience?: string[] | null;
          experience_years?: number | null;
          class_type?: "physical" | "online" | "both";
          location?: string | null;
          photo_url?: string | null;
          institution?: string | null;
          academic_title?: string | null;
          institution_verified?: boolean;
          publications?: string[] | null;
          verification_document_path?: string | null;
          verification_submitted_at?: string | null;
          status?: ProfileStatus;
          owner_published?: boolean;
          contact_mode?: "phone" | "messaging_only";
          languages?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          headline?: string | null;
          bio?: string | null;
          qualifications?: string[] | null;
          work_experience?: string[] | null;
          experience_years?: number | null;
          class_type?: "physical" | "online" | "both";
          location?: string | null;
          photo_url?: string | null;
          institution?: string | null;
          academic_title?: string | null;
          institution_verified?: boolean;
          publications?: string[] | null;
          verification_document_path?: string | null;
          verification_submitted_at?: string | null;
          status?: ProfileStatus;
          owner_published?: boolean;
          contact_mode?: "phone" | "messaging_only";
          languages?: string[] | null;
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
          established: string | null;
          class_type: "physical" | "online" | "both" | null;
          status: ProfileStatus;
          owner_published: boolean;
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
          established?: string | null;
          class_type?: "physical" | "online" | "both" | null;
          status?: ProfileStatus;
          owner_published?: boolean;
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
          established?: string | null;
          class_type?: "physical" | "online" | "both" | null;
          status?: ProfileStatus;
          owner_published?: boolean;
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
          is_public: boolean;
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
          is_public?: boolean;
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
          is_public?: boolean;
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
          class_size_type: "group" | "individual";
          location: string | null;
          schedule_note: string | null;
          teacher_label: string | null;
          grade_band: GradeBand | null;
          status: "active" | "upcoming" | "closed";
          hourly_rate: number | null;
          monthly_rate: number | null;
          course_code: string | null;
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
          class_size_type?: "group" | "individual";
          location?: string | null;
          schedule_note?: string | null;
          teacher_label?: string | null;
          grade_band?: GradeBand | null;
          status?: "active" | "upcoming" | "closed";
          hourly_rate?: number | null;
          monthly_rate?: number | null;
          course_code?: string | null;
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
          class_size_type?: "group" | "individual";
          location?: string | null;
          schedule_note?: string | null;
          teacher_label?: string | null;
          grade_band?: GradeBand | null;
          status?: "active" | "upcoming" | "closed";
          hourly_rate?: number | null;
          monthly_rate?: number | null;
          course_code?: string | null;
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
          type: "mcq" | "essay";
          difficulty: "easy" | "medium" | "hard";
          correct_answer: string | null;
          topic: string | null;
          marks: number;
          grade_band: "1-5" | "6-9" | "10-11" | "12-13" | "campus" | null;
          batch_id: string | null;
          language: "en" | "si" | "ta";
          options: Json | null;
          correct_option_id: string | null;
          correct_option_ids: string[];
          question_image_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id?: string | null;
          question_text: string;
          type: "mcq" | "essay";
          difficulty?: "easy" | "medium" | "hard";
          correct_answer?: string | null;
          topic?: string | null;
          marks?: number;
          grade_band?: "1-5" | "6-9" | "10-11" | "12-13" | "campus" | null;
          batch_id?: string | null;
          language?: "en" | "si" | "ta";
          options?: Json | null;
          correct_option_id?: string | null;
          correct_option_ids?: string[];
          question_image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          subject_id?: string | null;
          question_text?: string;
          type?: "mcq" | "essay";
          difficulty?: "easy" | "medium" | "hard";
          correct_answer?: string | null;
          topic?: string | null;
          marks?: number;
          grade_band?: "1-5" | "6-9" | "10-11" | "12-13" | "campus" | null;
          batch_id?: string | null;
          language?: "en" | "si" | "ta";
          options?: Json | null;
          question_image_path?: string | null;
          correct_option_id?: string | null;
          correct_option_ids?: string[];
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
          batch_id: string | null;
          title: string;
          question_ids: string[];
          duration_minutes: number;
          scheduled_at: string | null;
          published: boolean;
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
          question_ids?: string[];
          duration_minutes: number;
          scheduled_at?: string | null;
          published?: boolean;
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
          question_ids?: string[];
          duration_minutes?: number;
          scheduled_at?: string | null;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      exam_participants: {
        Row: {
          exam_id: string;
          student_id: string;
        };
        Insert: {
          exam_id: string;
          student_id: string;
        };
        Update: {
          exam_id?: string;
          student_id?: string;
        };
        Relationships: [];
      };

      exam_submissions: {
        Row: {
          id: string;
          exam_id: string;
          student_id: string;
          photo_urls: string[];
          compiled_pdf_path: string | null;
          mcq_answers: Record<string, string[]>;
          mcq_score: number | null;
          mcq_max_score: number | null;
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
          mcq_answers?: Record<string, string[]>;
          mcq_score?: number | null;
          mcq_max_score?: number | null;
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
          mcq_answers?: Record<string, string[]>;
          mcq_score?: number | null;
          mcq_max_score?: number | null;
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

      assignments: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          batch_id: string | null;
          lesson_id: string | null;
          title: string;
          file_path: string;
          due_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          batch_id?: string | null;
          lesson_id?: string | null;
          title: string;
          file_path: string;
          due_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          batch_id?: string | null;
          lesson_id?: string | null;
          title?: string;
          file_path?: string;
          due_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      assignment_submissions: {
        Row: {
          id: string;
          assignment_id: string;
          student_id: string;
          photo_urls: string[];
          status: "pending" | "graded";
          grade: number | null;
          feedback: string | null;
          submitted_at: string;
          graded_at: string | null;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          student_id: string;
          photo_urls?: string[];
          status?: "pending" | "graded";
          grade?: number | null;
          feedback?: string | null;
          submitted_at?: string;
          graded_at?: string | null;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          student_id?: string;
          photo_urls?: string[];
          status?: "pending" | "graded";
          grade?: number | null;
          feedback?: string | null;
          submitted_at?: string;
          graded_at?: string | null;
        };
        Relationships: [];
      };

      live_classes: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          subject_id: string | null;
          batch_id: string | null;
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
          batch_id?: string | null;
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
          batch_id?: string | null;
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

      live_class_participants: {
        Row: {
          live_class_id: string;
          student_id: string;
        };
        Insert: {
          live_class_id: string;
          student_id: string;
        };
        Update: {
          live_class_id?: string;
          student_id?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      live_class_reminders: {
        Row: {
          live_class_id: string;
          student_id: string;
          created_at: string;
        };
        Insert: {
          live_class_id: string;
          student_id: string;
          created_at?: string;
        };
        Update: {
          live_class_id?: string;
          student_id?: string;
          created_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      attendance_records: {
        Row: {
          id: string;
          live_class_id: string;
          student_id: string;
          status: "present" | "absent" | "late";
          marked_at: string;
        };
        Insert: {
          id?: string;
          live_class_id: string;
          student_id: string;
          status?: "present" | "absent" | "late";
          marked_at?: string;
        };
        Update: {
          id?: string;
          live_class_id?: string;
          student_id?: string;
          status?: "present" | "absent" | "late";
          marked_at?: string;
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
          status: "pending" | "accepted" | "declined";
          joined_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          owner_type: OwnerType;
          owner_id: string;
          batch_id?: string | null;
          status?: "pending" | "accepted" | "declined";
          joined_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          batch_id?: string | null;
          status?: "pending" | "accepted" | "declined";
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
          subject_id: string | null;
          batch_id: string | null;
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
          subject_id?: string | null;
          batch_id?: string | null;
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
          subject_id?: string | null;
          batch_id?: string | null;
          starts_at?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        // No embedded-resource typing yet (e.g. `.select('*, exams(*)')`) —
        // every table declares no relationships rather than a guessed one.
        Relationships: [];
      };

      wanted_ads: {
        Row: {
          id: string;
          student_id: string;
          looking_for: "teacher" | "institute";
          subject_id: string | null;
          mode: "online" | "physical" | "both" | null;
          grade_level: string | null;
          title: string;
          description: string | null;
          status: "active" | "closed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          looking_for: "teacher" | "institute";
          subject_id?: string | null;
          mode?: "online" | "physical" | "both" | null;
          grade_level?: string | null;
          title: string;
          description?: string | null;
          status?: "active" | "closed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          looking_for?: "teacher" | "institute";
          subject_id?: string | null;
          mode?: "online" | "physical" | "both" | null;
          grade_level?: string | null;
          title?: string;
          description?: string | null;
          status?: "active" | "closed";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      wanted_ad_responses: {
        Row: {
          id: string;
          wanted_ad_id: string;
          responder_type: "teacher" | "class";
          responder_id: string;
          message: string;
          status: "new" | "read";
          created_at: string;
        };
        Insert: {
          id?: string;
          wanted_ad_id: string;
          responder_type: "teacher" | "class";
          responder_id: string;
          message: string;
          status?: "new" | "read";
          created_at?: string;
        };
        Update: {
          id?: string;
          wanted_ad_id?: string;
          responder_type?: "teacher" | "class";
          responder_id?: string;
          message?: string;
          status?: "new" | "read";
          created_at?: string;
        };
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

      inquiries: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          inquirer_id: string | null;
          sender_name: string;
          sender_contact: string;
          message: string;
          status: "new" | "read";
          reply: string | null;
          replied_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          inquirer_id?: string | null;
          sender_name: string;
          sender_contact: string;
          message: string;
          status?: "new" | "read";
          reply?: string | null;
          replied_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: OwnerType;
          owner_id?: string;
          inquirer_id?: string | null;
          sender_name?: string;
          sender_contact?: string;
          message?: string;
          status?: "new" | "read";
          reply?: string | null;
          replied_at?: string | null;
          created_at?: string;
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

      platform_settings: {
        Row: {
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: string;
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
      is_enrolled_in_live_class: {
        Args: { p_live_class_id: string };
        Returns: boolean;
      };
      visible_live_class_ids: {
        Args: { p_ids: string[] };
        Returns: string[];
      };
      is_enrolled_in_exam: {
        Args: { p_exam_id: string };
        Returns: boolean;
      };
      visible_exam_ids: {
        Args: { p_ids: string[] };
        Returns: string[];
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
      get_class_contact: {
        Args: { p_class_id: string };
        Returns: string | null;
      };
      get_enrolled_teacher_names: {
        Args: { p_teacher_ids: string[] };
        Returns: { id: string; full_name: string; is_campus_lecturer: boolean }[];
      };
      get_roster_student_info: {
        Args: { p_student_ids: string[] };
        Returns: { id: string; full_name: string; phone: string | null }[];
      };
      get_linked_teacher_names: {
        Args: { p_class_id: string; p_teacher_ids: string[] };
        Returns: { id: string; full_name: string }[];
      };
      find_teacher_by_email: {
        Args: { p_email: string };
        Returns: { id: string; full_name: string }[];
      };
      submit_inquiry: {
        Args: {
          p_owner_type: string;
          p_owner_id: string;
          p_sender_name: string;
          p_sender_contact: string;
          p_message: string;
        };
        Returns: undefined;
      };
      rejoin_after_decline: {
        Args: { p_batch_id: string };
        Returns: undefined;
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
          grade_bands: string[];
          online: boolean;
          teacher_count: number;
        }[];
      };
      resolve_subject: {
        Args: { subject_name: string };
        Returns: string;
      };
      get_public_teacher_profile: {
        Args: { p_teacher_id: string };
        Returns: {
          id: string;
          display_name: string | null;
          headline: string | null;
          bio: string | null;
          location: string | null;
          class_type: string;
          experience_years: number | null;
          qualifications: string[] | null;
          work_experience: string[] | null;
          photo_url: string | null;
          hourly_rate: number | null;
          monthly_rate: number | null;
          rating: number;
          review_count: number;
          notes_count: number;
          subjects: string[];
          grade_band: string | null;
          contact_mode: string;
          languages: string[] | null;
          is_campus_lecturer: boolean;
          institution: string | null;
          academic_title: string | null;
          institution_verified: boolean;
          publications: string[] | null;
        }[];
      };
      list_public_reviews: {
        Args: { p_target_type: string; p_target_id: string };
        Returns: {
          id: string;
          author: string | null;
          rating: number;
          body: string | null;
          reply: string | null;
          created_at: string;
        }[];
      };
      list_teacher_ads: {
        Args: Record<string, never>;
        Returns: {
          ad_id: string;
          teacher_id: string;
          display_name: string | null;
          photo_url: string | null;
          ad_title: string;
          ad_content: string | null;
          subject: string | null;
          grade_band: string | null;
          location: string | null;
          mode: string;
          hourly_rate: number | null;
          monthly_rate: number | null;
          rating: number;
          review_count: number;
          is_campus_lecturer: boolean;
          institution: string | null;
          academic_title: string | null;
          institution_verified: boolean;
          course_code: string | null;
        }[];
      };
      get_public_ad: {
        Args: { p_ad_id: string };
        Returns: {
          ad_id: string;
          teacher_id: string;
          batch_id: string;
          display_name: string | null;
          photo_url: string | null;
          ad_title: string;
          ad_content: string | null;
          subject: string | null;
          grade_band: string | null;
          location: string | null;
          mode: string;
          schedule_note: string | null;
          hourly_rate: number | null;
          monthly_rate: number | null;
          rating: number;
          review_count: number;
          is_campus_lecturer: boolean;
          course_code: string | null;
        }[];
      };
      list_public_wanted_ads: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          looking_for: string;
          subject: string | null;
          mode: string | null;
          grade_level: string | null;
          title: string;
          description: string | null;
          created_at: string;
        }[];
      };
      get_public_wanted_ad: {
        Args: { p_id: string };
        Returns: {
          id: string;
          looking_for: string;
          subject: string | null;
          mode: string | null;
          grade_level: string | null;
          title: string;
          description: string | null;
          created_at: string;
        }[];
      };
      list_wanted_ads_for_responder: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          looking_for: string;
          subject: string | null;
          mode: string | null;
          grade_level: string | null;
          title: string;
          description: string | null;
          created_at: string;
          my_response: string | null;
        }[];
      };
      list_wanted_ad_responses_for_student: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          wanted_ad_id: string;
          responder_type: string;
          responder_name: string | null;
          message: string;
          status: string;
          created_at: string;
        }[];
      };
    };

    Enums: Record<string, never>;

    CompositeTypes: Record<string, never>;
  };
};
