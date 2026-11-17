/** A class as its teacher sees it (sonder.teacher_classes). */
export type TeacherClass = {
  class_id: string;
  name: string;
  note: string;
  join_code: string;
  grade_level: number;
  status: "active" | "archived";
  student_count: number;
  created_at: string;
};

export type CreateClassRequest = { name: string; note: string };
