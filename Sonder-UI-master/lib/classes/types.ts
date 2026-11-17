export type ClassStatus = "active" | "archived";

/** A class as its teacher sees it (sonder.teacher_classes). */
export type TeacherClass = {
  class_id: string;
  name: string;
  note: string;
  join_code: string;
  grade_level: number;
  status: ClassStatus;
  student_count: number;
  created_at: string;
};

export type CreateClassRequest = { name: string; note: string };

/** A class as a member student sees it (sonder.student_classes): no join code. */
export type StudentClass = {
  class_id: string;
  name: string;
  grade_level: number;
  teacher_names: string;
  joined_at: string;
};

/** One active student on a class roster (display name only). */
export type RosterStudent = { student_id: string; display_name: string; joined_at: string };
