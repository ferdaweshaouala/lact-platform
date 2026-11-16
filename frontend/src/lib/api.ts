import axios from "axios";

const api = axios.create({
  // Use relative URL so requests go through Next.js proxy (next.config.js rewrites).
  // This fixes httpOnly cookie issues when accessing from phones or other devices.
  baseURL: "",
  withCredentials: true,
});

// No request interceptor needed — the browser sends the httpOnly cookie automatically.
// We intentionally do NOT read the token from JS (it's httpOnly and inaccessible).

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(null)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config as typeof err.config & { _retry?: boolean };
    const path = window.location.pathname;
    const isPublicPath = path === "/login" || path === "/register" || path.startsWith("/invite") || path.startsWith("/forgot-password");    const isRefreshCall = originalRequest?.url?.includes("/auth/refresh");

    if (err.response?.status === 401 && !originalRequest._retry && !isPublicPath && !isRefreshCall) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((e) => Promise.reject(e));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post("/api/auth/refresh");
        processQueue(null);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr);
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return api.post("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  logout: () => api.post("/api/auth/logout"),
  me: () => api.get("/api/auth/me"),
  acceptInvite: (token: string, password: string) =>
    api.post("/api/auth/accept-invite", { token, password }),
  forgotPassword: (email: string) =>
    api.post("/api/auth/forgot-password", { email }),
};

export const usersApi = {
  list: () => api.get("/api/users/"),
  get: (id: number) => api.get(`/api/users/${id}`),
  create: (data: object) => api.post("/api/users/", data),
  update: (id: number, data: object) => api.patch(`/api/users/${id}`, data),
  delete: (id: number) => api.delete(`/api/users/${id}`),
  createInvite: (userId: number, reset = false) => api.post(`/api/users/${userId}/invite?reset=${reset}`),
};

export const studentsApi = {
  // Returns { total, skip, limit, items } — use .data.items for the student array
  // and .data.total to detect truncation / render pagination.
  list: (params?: { skip?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.set("skip", String(params.skip));
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    const qs = q.toString();
    return api.get(`/api/students/${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => api.get(`/api/students/${id}`),
  create: (data: object) => api.post("/api/students/", data),
  update: (id: number, data: object) => api.patch(`/api/students/${id}`, data),
  delete: (id: number) => api.delete(`/api/students/${id}`),
  grades: (id: number) => api.get(`/api/grades/student/${id}`),
  attendanceSummary: (id: number) => api.get(`/api/students/${id}/attendance-summary`),
  submissions: (id: number) => api.get(`/api/students/${id}/submissions/`),
  search: (q: string) => api.get(`/api/students/search?q=${encodeURIComponent(q)}`),
  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/students/import-csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const coursesApi = {
  list: () => api.get("/api/courses/"),
  get: (id: number) => api.get(`/api/courses/${id}`),
  create: (data: object) => api.post("/api/courses/", data),
  update: (id: number, data: object) => api.patch(`/api/courses/${id}`, data),
  delete: (id: number) => api.delete(`/api/courses/${id}`),
};

export const gradebookApi = {
  get: (courseId: number) => api.get(`/api/courses/${courseId}/gradebook/`),
};

export const attendanceApi = {
  forDate: (courseId: number, sessionDate: string) =>
    api.get(`/api/courses/${courseId}/attendance/?session_date=${sessionDate}`),
  sessions: (courseId: number) => api.get(`/api/courses/${courseId}/attendance/`),
  trend: (courseId: number) => api.get(`/api/courses/${courseId}/attendance/trend`),
  save: (courseId: number, sessionDate: string, records: Array<{ enrollment_id: number; status: string; notes?: string | null }>) =>
    api.post(`/api/courses/${courseId}/attendance/`, { session_date: sessionDate, records }),
};

export const curriculumApi = {
  list: (courseId: number) => api.get(`/api/courses/${courseId}/curriculum/`),
  create: (courseId: number, data: object) => api.post(`/api/courses/${courseId}/curriculum/`, data),
  update: (courseId: number, id: number, data: object) => api.patch(`/api/courses/${courseId}/curriculum/${id}`, data),
  delete: (courseId: number, id: number) => api.delete(`/api/courses/${courseId}/curriculum/${id}`),
  importTemplate: (courseId: number) => api.post(`/api/courses/${courseId}/curriculum/import-template`),
  parsePdf: (courseId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/api/courses/${courseId}/curriculum/parse-pdf`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importPdf: (courseId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/api/courses/${courseId}/curriculum/import-pdf`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAttendance: (courseId: number, sessionId: number) =>
    api.get(`/api/courses/${courseId}/curriculum/${sessionId}/attendance`),
  saveAttendance: (courseId: number, sessionId: number, records: Array<{ enrollment_id: number; status: string; notes?: string | null }>, dateRecorded?: string) =>
    api.post(`/api/courses/${courseId}/curriculum/${sessionId}/attendance`, { date_recorded: dateRecorded, records }),
  stats: (courseId: number) => api.get(`/api/courses/${courseId}/curriculum/stats`),
  lastSession: (courseId: number) => api.get(`/api/courses/${courseId}/curriculum/last-session`),
  weeklySuivi: (courseId: number) => api.get(`/api/courses/${courseId}/curriculum/weekly-suivi`),
  toggleFollowUp: (courseId: number, sessionId: number, enrollmentId: number, followedUp: boolean, notes?: string) =>
    api.patch(`/api/courses/${courseId}/curriculum/${sessionId}/attendance/${enrollmentId}/follow-up`, { followed_up: followedUp, notes }),
};

export const notesApi = {
  list: (courseId: number) => api.get(`/api/courses/${courseId}/notes/`),
  create: (courseId: number, content: string, curriculumSessionId?: number | null) =>
    api.post(`/api/courses/${courseId}/notes/`, { content, curriculum_session_id: curriculumSessionId ?? null }),
  reply: (noteId: number, content: string) =>
    api.post(`/api/notes/${noteId}/reply`, { content }),
  delete: (courseId: number, noteId: number) => api.delete(`/api/courses/${courseId}/notes/${noteId}`),
  recent: (limit = 20) => api.get(`/api/notes/recent?limit=${limit}`),
};

export const categoriesApi = {
  list: (courseId: number) => api.get(`/api/courses/${courseId}/categories/`),
  create: (courseId: number, data: object) => api.post(`/api/courses/${courseId}/categories/`, data),
  update: (courseId: number, id: number, data: object) => api.patch(`/api/courses/${courseId}/categories/${id}`, data),
  delete: (courseId: number, id: number) => api.delete(`/api/courses/${courseId}/categories/${id}`),
  copyFrom: (courseId: number, sourceCourseId: number) =>
    api.post(`/api/courses/${courseId}/categories/copy-from`, { source_course_id: sourceCourseId }),
};

export const enrollmentsApi = {
  list: () => api.get("/api/enrollments/"),
  create: (data: object) => api.post("/api/enrollments/", data),
  update: (id: number, data: object) => api.patch(`/api/enrollments/${id}`, data),
  delete: (id: number) => api.delete(`/api/enrollments/${id}`),
};

export const gradesApi = {
  create: (data: object) => api.post("/api/grades/", data),
  delete: (id: number) => api.delete(`/api/grades/${id}`),
};

export const submissionsApi = {
  byCourse: (courseId: number) => api.get(`/api/courses/${courseId}/submissions/`),
  byStudent: (studentId: number) => api.get(`/api/students/${studentId}/submissions/`),
  grade: (id: number, data: { grade: number; feedback?: string }) => api.patch(`/api/submissions/${id}/grade`, data),
};

export const compensationApi = {
  list: (params?: { status?: string; course_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.course_id) q.set('course_id', String(params.course_id));
    return api.get(`/api/compensation-requests/${q.toString() ? `?${q.toString()}` : ''}`);
  },
  review: (id: number, data: { status: 'accepted' | 'rejected'; notes?: string }) =>
    api.patch(`/api/compensation-requests/${id}/review`, data),
};

export const analyticsApi = {
  summary: () => api.get("/api/analytics/summary"),
  teacher: () => api.get("/api/analytics/teacher"),
  inactive: (days = 7) => api.get(`/api/analytics/inactive?days=${days}`),
  courses: () => api.get("/api/analytics/courses"),
  teachers: () => api.get("/api/analytics/teachers"),
  report: (params?: { skip?: number; limit?: number; course_id?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.set("skip", String(params.skip));
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    if (params?.course_id !== undefined) q.set("course_id", String(params.course_id));
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return api.get(`/api/analytics/report${qs ? `?${qs}` : ""}`);
  },
  atRisk: (threshold = 50) => api.get(`/api/analytics/at-risk?threshold=${threshold}`),
  absentYesterday: () => api.get('/api/analytics/absent-yesterday'),
  botSubmissions: () => api.get('/api/analytics/bot/submissions'),
  botCompensation: () => api.get('/api/analytics/bot/compensation'),
  curriculumStats: () => api.get('/api/analytics/curriculum-stats'),
};

export const predictionApi = {
  studentRisk: (studentId: number, courseId: number) =>
    api.get(`/api/students/${studentId}/dropout-risk?course_id=${courseId}`),
  courseRisk: (courseId: number) =>
    api.get(`/api/courses/${courseId}/dropout-risk`),
};

export const exportApi = {
  enrollments: (params?: { course_id?: number; date_from?: string; date_to?: string; lang?: string }) => {
    const q = new URLSearchParams();
    if (params?.course_id) q.set('course_id', String(params.course_id));
    if (params?.date_from) q.set('date_from', params.date_from);
    if (params?.date_to) q.set('date_to', params.date_to);
    if (params?.lang) q.set('lang', params.lang);
    return api.get(`/api/export/enrollments?${q.toString()}`, { responseType: 'blob' });
  },
};

export const importApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/api/import/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  commit: (data: object) => api.post("/api/import/commit", data),
};

export const studentAuthApi = {
  register: (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    phone_number?: string;
    city?: string;
  }) => api.post("/api/student/register", data),
};

export const studentEnrollmentApi = {
  availableCourses: () => api.get("/api/student/available-courses"),
  myEnrollment: () => api.get("/api/student/me/enrollment"),
  enroll: (courseId: number) => api.post("/api/student/enroll", { course_id: courseId }),
};

export const studentContentApi = {
  weeks: () => api.get("/api/student/weeks"),
  weekProgress: (weekId: number) => api.get(`/api/student/weeks/${weekId}/progress`),
  dashboard: () => api.get("/api/student/dashboard"),
  updateLectureStep: (itemId: number, step: "watched" | "notes_written" | "sent_to_bot" | "all", completed = true) =>
    api.patch(`/api/student/items/${itemId}/steps`, { step, completed }),
  completeItem: (itemId: number) => api.post(`/api/student/items/${itemId}/complete`),
  uncompleteItem: (itemId: number) => api.post(`/api/student/items/${itemId}/uncomplete`),
};

export const courseScheduleApi = {
  setWorkshopSchedule: (courseId: number, data: { workshop_day?: string; workshop_time?: string }) =>
    api.patch(`/api/courses/${courseId}/workshop-schedule`, data),
};

export const supervisorStudentApi = {
  create: (data: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    city?: string;
    course_id?: number;
  }) => api.post("/api/student/create-by-supervisor", data),
    resetPassword: (userId: number) => api.post(`/api/student/${userId}/reset-password`),
};
