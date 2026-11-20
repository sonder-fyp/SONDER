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

export type AttemptRule = "single" | "repeat";
export type AssignmentStatus = "open" | "closed";

/** An assignment as its class teacher sees it (sonder.class_assignments). */
export type TeacherAssignment = {
  assignment_id: string;
  class_id: string;
  title: string;
  unit_code: string;
  unit_name: string;
  version_code: string;
  status: AssignmentStatus;
  attempt_rule: AttemptRule;
  created_at: string;
};

/** An open assignment as a member student sees it (sonder.student_assignments). */
export type StudentAssignment = {
  assignment_id: string;
  class_id: string;
  class_name: string;
  title: string;
  unit_code: string;
  unit_name: string;
  attempt_rule: AttemptRule;
  created_at: string;
};

export type CreateAssignmentRequest = { unit_id: string; title: string; attempt_rule: AttemptRule };

/** A unit the running diagnostic service offers, for the assign form. */
export type AssignableUnit = { unit_id: string; name: string };
