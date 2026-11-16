"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { studentContentApi, studentEnrollmentApi } from "@/lib/api";
import styles from "./student-dashboard.module.css";

interface Course {
  course_id: number;
  title: string;
  description?: string;
  course_type: string;
}

interface EnrollmentInfo {
  enrollment_id: number;
  course_id: number;
  course_title: string;
  approval_status: string;
  enrollment_date?: string;
}

interface WeekItem {
  id: number;
  order: number;
  item_type: string;
  title: string;
  description?: string | null;
  video_url?: string | null;
  pre_quiz_form_url?: string | null;
  post_quiz_form_url?: string | null;
  is_required: boolean;
}

interface ProgramWeek {
  id: number;
  week_number: number;
  title: string;
  is_visible: boolean;
  is_unlocked: boolean;
  items: WeekItem[];
}

interface DashboardItemRow {
  item: WeekItem;
  completed: boolean;
  steps?: LectureSteps | null;
}

interface LectureSteps {
  watched: boolean;
  notes_written: boolean;
  sent_to_bot: boolean;
}

interface DashboardData {
  course_title: string | null;
  current_week: {
    id: number;
    week_number: number;
    title: string;
    required_total: number;
    required_done: number;
    percent: number;
    items: DashboardItemRow[];
  } | null;
  overdue_items: { week_number: number; week_title: string; item: WeekItem }[];
  next_workshop: { weekday: string; time: string | null; date: string; days_remaining: number } | null;
}

const ITEM_TYPE_META: Record<string, { icon: string; label: string }> = {
  lecture: { icon: "🎥", label: "محاضرة" },
  reading: { icon: "📖", label: "قراءة" },
  listening: { icon: "🎧", label: "سماع" },
  mini_circle_exam: { icon: "📝", label: "الدائرة الصغرى" },
};


export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<EnrollmentInfo | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
  
  const [completedMap, setCompletedMap] = useState<Record<number, Set<number>>>({});
  const [lectureStepsMap, setLectureStepsMap] = useState<Record<number, LectureSteps>>({});
 
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [markingItemId, setMarkingItemId] = useState<number | null>(null);
  const [journeyWeekId, setJourneyWeekId] = useState<number | null>(null);
  const journeyRef = useRef<HTMLDivElement>(null);

  const loadWeekProgress = async (weekId: number) => {
    try {
      const res = await studentContentApi.weekProgress(weekId);
      const doneIds = new Set<number>(
        (res.data as DashboardItemRow[]).filter((r) => r.completed).map((r) => r.item.id)
      );
      setCompletedMap((prev) => ({ ...prev, [weekId]: doneIds }));
      setLectureStepsMap((prev) => {
        const next = { ...prev };
        (res.data as DashboardItemRow[]).forEach((row) => {
          if (row.item.item_type === "lecture") {
            next[row.item.id] = row.steps ?? { watched: false, notes_written: false, sent_to_bot: false };
          }
        });
        return next;
      });
    } catch { /* ignore */ }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const enrRes = await studentEnrollmentApi.myEnrollment();
      setEnrollment(enrRes.data);

      if (enrRes.data?.approval_status === "approved") {
        const [dashRes, weeksRes] = await Promise.all([
          studentContentApi.dashboard(),
          studentContentApi.weeks(),
        ]);
        setDashboard(dashRes.data);
        const weeksData: ProgramWeek[] = weeksRes.data;
        setWeeks(weeksData);
        weeksData.filter((w) => w.is_unlocked).forEach((w) => loadWeekProgress(w.id));
      } else {
        setDashboard(null);
        setWeeks([]);
        setCompletedMap({});
        setLectureStepsMap({});
      }

      if (!enrRes.data) {
        const coursesRes = await studentEnrollmentApi.availableCourses();
        setCourses(coursesRes.data);
      }
    } catch {
      setError("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleEnroll = async () => {
    if (!selectedCourseId) return;
    setSubmitting(true);
    setError("");
    try {
      await studentEnrollmentApi.enroll(Number(selectedCourseId));
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "تعذّر إرسال طلب التسجيل");
    } finally {
      setSubmitting(false);
    }
  };
  useEffect(() => {
  const node = journeyRef.current?.querySelector('[data-current="true"]');
  if (!node) return;
  const y = window.scrollY;
  (node as HTMLElement).scrollIntoView({ inline: "center", block: "nearest" });
  window.scrollTo(0, y);
}, [weeks.length, dashboard?.current_week?.id]);

  const handleToggleComplete = async (weekId: number, itemId: number, alreadyDone: boolean) => {
    setMarkingItemId(itemId);
    try {
      if (alreadyDone) {
        await studentContentApi.uncompleteItem(itemId);
      } else {
        await studentContentApi.completeItem(itemId);
      }
      const dashRes = await studentContentApi.dashboard();
      setDashboard(dashRes.data);
      setCompletedMap((prev) => {
        const next = new Set(prev[weekId] ?? []);
        if (alreadyDone) next.delete(itemId); else next.add(itemId);
        return { ...prev, [weekId]: next };
      });
    } catch {
      setError("تعذّر تحديث حالة الإكمال، حاولي مرة أخرى");
    } finally {
      setMarkingItemId(null);
    }
  };

  const handleLectureStep = async (
    weekId: number,
    itemId: number,
    step: "watched" | "notes_written" | "sent_to_bot" | "all",
    completed: boolean,
  ) => {
    setMarkingItemId(itemId);
    setError("");
    try {
      const response = await studentContentApi.updateLectureStep(itemId, step, completed);
      setLectureStepsMap((prev) => ({ ...prev, [itemId]: response.data.steps }));
      setCompletedMap((prev) => {
        const next = new Set(prev[weekId] ?? []);
        if (response.data.completed) next.add(itemId); else next.delete(itemId);
        return { ...prev, [weekId]: next };
      });
      const [dashRes, weeksRes] = await Promise.all([
        studentContentApi.dashboard(),
        studentContentApi.weeks(),
      ]);
      setDashboard(dashRes.data);
      setWeeks(weeksRes.data);
    } catch {
      setError("تعذّر حفظ خطوات المحاضرة، حاولي مرة أخرى");
    } finally {
      setMarkingItemId(null);
    }
  };

  const renderTask = (item: WeekItem, isDone: boolean, weekId: number) => {
    const meta = ITEM_TYPE_META[item.item_type] ?? { icon: "📄", label: item.item_type };
    const lectureSteps = lectureStepsMap[item.id] ?? { watched: false, notes_written: false, sent_to_bot: false };
    const isLecture = item.item_type === "lecture";
    return (
      <article key={item.id} className={`${styles.taskCard} ${isDone ? styles.taskDone : ""}`}>
        <div className={styles.taskHeading}>
          <span className={styles.taskIcon} aria-hidden="true">{meta.icon}</span>
          <div className={styles.taskCopy}>
            <h3 className={styles.taskTitle}>{item.title}</h3>
            <p className={styles.muted}>{meta.label}{!item.is_required && <> · <span className={styles.optional}>اختياري</span></>}</p>
          </div>
          {isDone && <span className={styles.doneMark} aria-label="مكتملة">✓</span>}
        </div>
        {item.description && <p className={styles.description}>{item.description}</p>}
        <div className={styles.actionGroup}>
          {item.video_url && <a className={`${styles.actionButton} ${styles.primaryAction}`} href={item.video_url} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span> مشاهدة المحاضرة</a>}
          {isLecture && <div className={styles.lectureChecklist} aria-label="خطوات إتمام المحاضرة">
            <button type="button" className={`${styles.checklistStep} ${lectureSteps.watched ? styles.stepComplete : ""}`} aria-pressed={lectureSteps.watched} disabled={markingItemId === item.id} onClick={() => handleLectureStep(weekId, item.id, "watched", !lectureSteps.watched)}>
              <span className={styles.stepCheck} aria-hidden="true">{lectureSteps.watched ? "✓" : ""}</span><span>تمت المشاهدة</span>
            </button>
            <button type="button" className={`${styles.checklistStep} ${lectureSteps.notes_written ? styles.stepComplete : ""}`} aria-pressed={lectureSteps.notes_written} disabled={markingItemId === item.id} onClick={() => handleLectureStep(weekId, item.id, "notes_written", !lectureSteps.notes_written)}>
              <span className={styles.stepCheck} aria-hidden="true">{lectureSteps.notes_written ? "✓" : ""}</span><span>تمت كتابة رؤوس أقلام</span>
            </button>
            <button type="button" className={`${styles.checklistStep} ${lectureSteps.sent_to_bot ? styles.stepComplete : ""}`} aria-pressed={lectureSteps.sent_to_bot} disabled={markingItemId === item.id} onClick={() => handleLectureStep(weekId, item.id, "sent_to_bot", !lectureSteps.sent_to_bot)}>
              <span className={styles.stepCheck} aria-hidden="true">{lectureSteps.sent_to_bot ? "✓" : ""}</span><span>تم إرسال رؤوس الأقلام على البوت</span>
            </button>
            <button type="button" className={`${styles.actionButton} ${styles.allStepsAction}`} disabled={markingItemId === item.id || isDone} onClick={() => handleLectureStep(weekId, item.id, "all", true)}>
              {markingItemId === item.id ? "جارٍ الحفظ…" : isDone ? "✓ اكتملت جميع الخطوات" : "تم الجميع"}
            </button>
          </div>}
          {(item.pre_quiz_form_url || item.post_quiz_form_url) && <div className={styles.quizRow}>
            {item.pre_quiz_form_url && <a className={`${styles.actionButton} ${styles.quizAction}`} href={item.pre_quiz_form_url} target="_blank" rel="noopener noreferrer">اختبار قبلي</a>}
            {item.post_quiz_form_url && <a className={`${styles.actionButton} ${styles.quizAction}`} href={item.post_quiz_form_url} target="_blank" rel="noopener noreferrer">اختبار بعدي</a>}
          </div>}
          {!isLecture && <button className={`${styles.actionButton} ${isDone ? styles.completedAction : styles.completeAction}`} onClick={() => handleToggleComplete(weekId, item.id, isDone)} disabled={markingItemId === item.id}>
            {markingItemId === item.id ? "جارٍ الحفظ…" : isDone ? "✓ مكتملة — اضغطي للتراجع" : "○ تحديد كمكتملة"}
          </button>}
        </div>
      </article>
    );
  };

  const cw = dashboard?.current_week ?? null;
  const remaining = cw ? cw.required_total - cw.required_done : 0;

  return (
    <DashboardLayout>
      <main className={styles.dashboard} dir="rtl">
        <header className={styles.topbar}>
          <div className={styles.avatar} aria-hidden="true">{user?.first_name?.slice(0, 1) || "ط"}</div>
          <div className={styles.welcome}>
            <p className={styles.eyebrow}>مساحة التعلّم الخاصة بكِ</p>
            <h1>مرحباً، {user?.first_name || "يا بطلة"} 🌷</h1>
            <p className={styles.muted}>خطوة صغيرة اليوم تصنع إنجازاً كبيراً</p>
          </div>
        </header>

        {loading ? <div className={styles.loading} role="status">جارٍ تجهيز لوحة التعلّم…</div> : enrollment ? (
          <div className={styles.content}>
            <section className={styles.programBanner}>
              <span className={styles.bannerArt} aria-hidden="true">📚</span>
              <div className={styles.bannerText}>
                <p className={styles.bannerEyebrow}>برنامجكِ الحالي</p>
                <h2>{enrollment.course_title}</h2>
                <p>رحلتكِ التعليمية تبدأ من هنا</p>
              </div>
              <span className={styles.bannerFlower} aria-hidden="true">✿</span>
            </section>

            {enrollment.approval_status === "pending" && <section className={`${styles.notice} ${styles.pending}`}>
              <span className={styles.noticeIcon} aria-hidden="true">◷</span><div><h2>طلبكِ قيد المراجعة</h2><p>ستظهر مهام الدورة هنا بعد موافقة الإدارة.</p></div>
            </section>}
            {enrollment.approval_status === "rejected" && <section className={`${styles.notice} ${styles.rejected}`} role="alert">
              <span className={styles.noticeIcon} aria-hidden="true">!</span><div><h2>تعذّر قبول طلب التسجيل</h2><p>تواصلي مع الإدارة لمعرفة الخطوة التالية.</p></div>
            </section>}

            {enrollment.approval_status === "approved" && dashboard && <>
              <section className={styles.overviewGrid}>
                {cw && <article className={`${styles.panel} ${styles.progressPanel}`}>
                  <div className={styles.panelHeading}><span className={styles.panelIcon} aria-hidden="true">✦</span><div><p className={styles.eyebrow}>تقدمكِ هذا الأسبوع</p><h2>{cw.title}</h2></div></div>
                  <div className={styles.progressLine}><span className={styles.progressPercent}>{cw.percent}%</span><span className={styles.progressCount}>{cw.required_done} من {cw.required_total} مهام</span></div>
                  <div className={styles.progressTrack} role="progressbar" aria-label="نسبة إنجاز مهام الأسبوع" aria-valuenow={cw.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${cw.percent}%` }} /></div>
                  <p className={styles.progressMessage}>{remaining === 0 ? "أحسنتِ! أنجزتِ كل المطلوب لهذا الأسبوع 🌟" : `بقيت ${remaining} ${remaining === 1 ? "مهمة" : "مهام"} لتكملي أسبوعكِ`}</p>
                </article>}
                {dashboard.next_workshop && <article className={`${styles.panel} ${styles.workshopPanel}`}>
                  <span className={styles.workshopIcon} aria-hidden="true">◷</span><p className={styles.eyebrow}>موعد الورشة القادمة</p>
                  <h2>{dashboard.next_workshop.days_remaining === 0 ? "اليوم" : `${dashboard.next_workshop.days_remaining} يوم`}</h2>
                  <p>{dashboard.next_workshop.weekday}{dashboard.next_workshop.time ? ` · ${dashboard.next_workshop.time}` : ""}</p>
                </article>}
              </section>

              {weeks.length > 0 && <section className={styles.panel}>
                <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>كل خطوة تقرّبكِ</p><h2>رحلتكِ في البرنامج</h2></div><span className={styles.sectionIcon} aria-hidden="true">⌁</span></div>
                <div className={styles.journey} ref={journeyRef} aria-label="أسابيع البرنامج">
                  {weeks.map((week) => {
                    const doneSet = completedMap[week.id] ?? new Set<number>();
                    const total = week.items.length;
                    const doneCount = week.items.filter((it) => doneSet.has(it.id)).length;
                    const isLocked = !week.is_unlocked;
                    const isCurrent = week.id === cw?.id;
                    const allDone = total > 0 && doneCount === total;
                    const state = isLocked ? styles.weekLocked : allDone ? styles.weekDone : isCurrent ? styles.weekCurrent : "";
                    const stateText = isLocked ? "مقفل" : allDone ? "مكتمل" : isCurrent ? "أنتِ هنا" : `${doneCount}/${total}`;
                    return <button key={week.id} className={`${styles.weekNode} ${state}`} data-current={isCurrent} disabled={isLocked} aria-pressed={journeyWeekId === week.id} onClick={() => {
                      if (isCurrent) { setJourneyWeekId(null); document.getElementById("k-current-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
                      else setJourneyWeekId(journeyWeekId === week.id ? null : week.id);
                    }}><span className={styles.weekDot}>{isLocked ? "⌑" : allDone ? "✓" : isCurrent ? "●" : week.week_number}</span><span className={styles.weekLabel}>الأسبوع {week.week_number}</span><span className={styles.weekState}>{stateText}</span></button>;
                  })}
                </div>
                {(() => {
                  const w = weeks.find((x) => x.id === journeyWeekId && x.is_unlocked);
                  if (!w) return null;
                  const doneSet = completedMap[w.id] ?? new Set<number>();
                  return <div className={styles.weekDetails}><h3>{w.title}</h3>{w.items.map((item) => renderTask(item, doneSet.has(item.id), w.id))}<button className={styles.closeButton} onClick={() => setJourneyWeekId(null)}>إغلاق تفاصيل الأسبوع</button></div>;
                })()}
              </section>}

              {dashboard.overdue_items.length > 0 && <section className={`${styles.panel} ${styles.overdue}`}>
                <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>لإبقائكِ على المسار</p><h2>مهام تحتاج إلى متابعة</h2></div><span className={styles.sectionIcon} aria-hidden="true">!</span></div>
                <div className={styles.overdueList}>{dashboard.overdue_items.map(({ week_number, item }) => <div className={styles.overdueRow} key={item.id}><span aria-hidden="true">{ITEM_TYPE_META[item.item_type]?.icon ?? "📄"}</span><strong>{item.title}</strong><span>الأسبوع {week_number}</span></div>)}</div>
              </section>}

              {cw && <section id="k-current-tasks" className={styles.tasksSection}>
                <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>جاهزة للإنجاز؟</p><h2>مهام هذا الأسبوع</h2></div><span className={styles.taskCount}>{cw.required_done}/{cw.required_total}</span></div>
                {cw.items.some((row) => !row.completed)
                  ? <div className={styles.taskList}>{cw.items.filter((row) => !row.completed).map((row) => renderTask(row.item, row.completed, cw.id))}</div>
                  : <div className={styles.allDoneMessage}><span aria-hidden="true">✿</span><strong>أحسنتِ! أكملتِ جميع مهام هذا الأسبوع.</strong><p>سيظهر الأسبوع التالي في رحلتكِ عند توفره.</p></div>}
              </section>}
            </>}
          </div>
        ) : <section className={`${styles.panel} ${styles.enrollPanel}`}>
          <span className={styles.enrollIcon} aria-hidden="true">✿</span><p className={styles.eyebrow}>ابدئي رحلتكِ</p><h2>اختاري دورتكِ التعليمية</h2><p className={styles.muted}>اختاري الدورة المناسبة لكِ لإرسال طلب التسجيل.</p>
          <select className={styles.courseSelect} value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : "")} aria-label="اختيار الدورة">
            <option value="">— اختاري دورة —</option>{courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
          </select>
          <button className={`${styles.actionButton} ${styles.primaryAction}`} onClick={handleEnroll} disabled={!selectedCourseId || submitting}>{submitting ? "جارٍ إرسال الطلب…" : "إرسال طلب التسجيل ←"}</button>
        </section>}
        {error && <p className={styles.errorMessage} role="alert">{error}</p>}
      </main>
    </DashboardLayout>
  );
}
