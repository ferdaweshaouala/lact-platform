--
-- PostgreSQL database dump
--

\restrict 2iP0LHuyLo9hGih8SrWbThKE4yh3xTmNFrYYbfwJ3ZuQsgFu5ALNTfHN3Ia4gVE

-- Dumped from database version 15.19 (Debian 15.19-1.pgdg13+2)
-- Dumped by pg_dump version 15.19 (Debian 15.19-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO dtms_user;

--
-- Name: answers; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.answers (
    answer_id integer NOT NULL,
    question_id integer NOT NULL,
    course_id integer NOT NULL,
    student_id integer NOT NULL,
    teacher_id integer NOT NULL,
    answer_text text,
    file_id character varying,
    media_group_id character varying,
    answered_at character varying NOT NULL
);


ALTER TABLE public.answers OWNER TO dtms_user;

--
-- Name: answers_answer_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.answers_answer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.answers_answer_id_seq OWNER TO dtms_user;

--
-- Name: answers_answer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.answers_answer_id_seq OWNED BY public.answers.answer_id;


--
-- Name: apscheduler_jobs; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.apscheduler_jobs (
    id character varying(191) NOT NULL,
    next_run_time double precision,
    job_state bytea NOT NULL
);


ALTER TABLE public.apscheduler_jobs OWNER TO dtms_user;

--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.attendance_records (
    id integer NOT NULL,
    enrollment_id integer NOT NULL,
    session_date date NOT NULL,
    status character varying NOT NULL,
    notes text,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.attendance_records OWNER TO dtms_user;

--
-- Name: attendance_records_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.attendance_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.attendance_records_id_seq OWNER TO dtms_user;

--
-- Name: attendance_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.attendance_records_id_seq OWNED BY public.attendance_records.id;


--
-- Name: compensation_requests; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.compensation_requests (
    id integer NOT NULL,
    student_id integer NOT NULL,
    course_id integer NOT NULL,
    content_id integer,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp without time zone,
    reviewed_by integer,
    notes text,
    telegram_id bigint
);


ALTER TABLE public.compensation_requests OWNER TO dtms_user;

--
-- Name: compensation_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.compensation_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.compensation_requests_id_seq OWNER TO dtms_user;

--
-- Name: compensation_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.compensation_requests_id_seq OWNED BY public.compensation_requests.id;


--
-- Name: content; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.content (
    id integer NOT NULL,
    name character varying NOT NULL,
    content_type character varying NOT NULL,
    course_id integer NOT NULL,
    week integer,
    content_order integer NOT NULL,
    CONSTRAINT ck_content_type CHECK (((content_type)::text = ANY ((ARRAY['lecture'::character varying, 'article'::character varying, 'audio'::character varying, 'workshop'::character varying])::text[])))
);


ALTER TABLE public.content OWNER TO dtms_user;

--
-- Name: COLUMN content.content_type; Type: COMMENT; Schema: public; Owner: dtms_user
--

COMMENT ON COLUMN public.content.content_type IS 'lecture | article | audio | workshop';


--
-- Name: content_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.content_id_seq OWNER TO dtms_user;

--
-- Name: content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.content_id_seq OWNED BY public.content.id;


--
-- Name: course_notes; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.course_notes (
    id integer NOT NULL,
    course_id integer NOT NULL,
    author_id integer NOT NULL,
    curriculum_session_id integer,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    parent_id integer
);


ALTER TABLE public.course_notes OWNER TO dtms_user;

--
-- Name: course_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.course_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.course_notes_id_seq OWNER TO dtms_user;

--
-- Name: course_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.course_notes_id_seq OWNED BY public.course_notes.id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.courses (
    course_id integer NOT NULL,
    title character varying NOT NULL,
    description text,
    start_date date,
    end_date date,
    status character varying DEFAULT 'Active'::character varying,
    teacher_id integer,
    supervisor_id integer,
    course_type character varying DEFAULT 'onsite'::character varying NOT NULL,
    total_sessions integer,
    workshop_day character varying
);


ALTER TABLE public.courses OWNER TO dtms_user;

--
-- Name: courses_course_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.courses_course_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.courses_course_id_seq OWNER TO dtms_user;

--
-- Name: courses_course_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.courses_course_id_seq OWNED BY public.courses.course_id;


--
-- Name: curriculum_attendance; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.curriculum_attendance (
    id integer NOT NULL,
    enrollment_id integer NOT NULL,
    curriculum_session_id integer NOT NULL,
    status character varying NOT NULL,
    notes text,
    date_recorded date,
    followed_up boolean DEFAULT false NOT NULL
);


ALTER TABLE public.curriculum_attendance OWNER TO dtms_user;

--
-- Name: curriculum_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.curriculum_attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.curriculum_attendance_id_seq OWNER TO dtms_user;

--
-- Name: curriculum_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.curriculum_attendance_id_seq OWNED BY public.curriculum_attendance.id;


--
-- Name: curriculum_sessions; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.curriculum_sessions (
    id integer NOT NULL,
    course_id integer NOT NULL,
    week_number integer NOT NULL,
    session_type character varying NOT NULL,
    title character varying NOT NULL,
    order_index integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.curriculum_sessions OWNER TO dtms_user;

--
-- Name: curriculum_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.curriculum_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.curriculum_sessions_id_seq OWNER TO dtms_user;

--
-- Name: curriculum_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.curriculum_sessions_id_seq OWNED BY public.curriculum_sessions.id;


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.enrollments (
    enrollment_id integer NOT NULL,
    student_id integer NOT NULL,
    course_id integer NOT NULL,
    enrollment_date date,
    completion_status character varying DEFAULT 'Ongoing'::character varying,
    absences integer DEFAULT 0 NOT NULL,
    attendance_count integer DEFAULT 0 NOT NULL,
    makeup_count integer DEFAULT 0 NOT NULL,
    approval_status character varying DEFAULT 'approved'::character varying NOT NULL,
    CONSTRAINT ck_enrollment_approval_status CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.enrollments OWNER TO dtms_user;

--
-- Name: enrollments_enrollment_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.enrollments_enrollment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.enrollments_enrollment_id_seq OWNER TO dtms_user;

--
-- Name: enrollments_enrollment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.enrollments_enrollment_id_seq OWNED BY public.enrollments.enrollment_id;


--
-- Name: grade_categories; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.grade_categories (
    id integer NOT NULL,
    course_id integer NOT NULL,
    name character varying NOT NULL,
    max_value double precision NOT NULL,
    kind character varying DEFAULT 'regular'::character varying NOT NULL,
    order_index integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.grade_categories OWNER TO dtms_user;

--
-- Name: grade_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.grade_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.grade_categories_id_seq OWNER TO dtms_user;

--
-- Name: grade_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.grade_categories_id_seq OWNED BY public.grade_categories.id;


--
-- Name: grades; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.grades (
    grade_id integer NOT NULL,
    enrollment_id integer NOT NULL,
    type character varying,
    value double precision NOT NULL,
    date_recorded date,
    max_value double precision,
    source character varying DEFAULT 'manual'::character varying,
    session_number integer,
    category_id integer
);


ALTER TABLE public.grades OWNER TO dtms_user;

--
-- Name: grades_grade_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.grades_grade_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.grades_grade_id_seq OWNER TO dtms_user;

--
-- Name: grades_grade_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.grades_grade_id_seq OWNED BY public.grades.grade_id;


--
-- Name: invite_tokens; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.invite_tokens (
    id integer NOT NULL,
    token character varying NOT NULL,
    user_id integer NOT NULL,
    used boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.invite_tokens OWNER TO dtms_user;

--
-- Name: invite_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.invite_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.invite_tokens_id_seq OWNER TO dtms_user;

--
-- Name: invite_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.invite_tokens_id_seq OWNED BY public.invite_tokens.id;


--
-- Name: program_catalog; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.program_catalog (
    id integer NOT NULL,
    name character varying NOT NULL,
    category character varying DEFAULT 'adult'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer,
    CONSTRAINT ck_program_catalog_category CHECK (((category)::text = ANY ((ARRAY['adult'::character varying, 'children'::character varying, 'youth'::character varying])::text[])))
);


ALTER TABLE public.program_catalog OWNER TO dtms_user;

--
-- Name: COLUMN program_catalog.category; Type: COMMENT; Schema: public; Owner: dtms_user
--

COMMENT ON COLUMN public.program_catalog.category IS 'adult | children | youth';


--
-- Name: program_catalog_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.program_catalog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.program_catalog_id_seq OWNER TO dtms_user;

--
-- Name: program_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.program_catalog_id_seq OWNED BY public.program_catalog.id;


--
-- Name: program_weeks; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.program_weeks (
    id integer NOT NULL,
    course_id integer NOT NULL,
    week_number integer NOT NULL,
    title character varying NOT NULL,
    opens_at date,
    is_visible boolean DEFAULT true NOT NULL
);


ALTER TABLE public.program_weeks OWNER TO dtms_user;

--
-- Name: program_weeks_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.program_weeks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.program_weeks_id_seq OWNER TO dtms_user;

--
-- Name: program_weeks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.program_weeks_id_seq OWNED BY public.program_weeks.id;


--
-- Name: questions; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.questions (
    question_id integer NOT NULL,
    student_id integer NOT NULL,
    course_id integer NOT NULL,
    question_text text NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    created_at character varying NOT NULL,
    CONSTRAINT ck_question_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'answered'::character varying])::text[])))
);


ALTER TABLE public.questions OWNER TO dtms_user;

--
-- Name: questions_question_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.questions_question_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.questions_question_id_seq OWNER TO dtms_user;

--
-- Name: questions_question_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.questions_question_id_seq OWNED BY public.questions.question_id;


--
-- Name: quiz_options; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.quiz_options (
    id integer NOT NULL,
    question_id integer NOT NULL,
    option_text character varying NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    "order" integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.quiz_options OWNER TO dtms_user;

--
-- Name: quiz_options_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.quiz_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quiz_options_id_seq OWNER TO dtms_user;

--
-- Name: quiz_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.quiz_options_id_seq OWNED BY public.quiz_options.id;


--
-- Name: quiz_questions; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.quiz_questions (
    id integer NOT NULL,
    item_id integer NOT NULL,
    phase character varying NOT NULL,
    question_text text NOT NULL,
    "order" integer DEFAULT 1 NOT NULL,
    CONSTRAINT ck_quiz_question_phase CHECK (((phase)::text = ANY ((ARRAY['pre'::character varying, 'post'::character varying])::text[])))
);


ALTER TABLE public.quiz_questions OWNER TO dtms_user;

--
-- Name: quiz_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.quiz_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quiz_questions_id_seq OWNER TO dtms_user;

--
-- Name: quiz_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.quiz_questions_id_seq OWNED BY public.quiz_questions.id;


--
-- Name: recommendation_feedback; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.recommendation_feedback (
    id integer NOT NULL,
    student_id integer NOT NULL,
    content_id integer NOT NULL,
    course_id integer NOT NULL,
    content_type character varying NOT NULL,
    is_mandatory integer DEFAULT 1 NOT NULL,
    reaction character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_rec_reaction CHECK (((reaction)::text = ANY ((ARRAY['shown'::character varying, 'started'::character varying, 'skipped'::character varying, 'why_this'::character varying])::text[])))
);


ALTER TABLE public.recommendation_feedback OWNER TO dtms_user;

--
-- Name: recommendation_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.recommendation_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.recommendation_feedback_id_seq OWNER TO dtms_user;

--
-- Name: recommendation_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.recommendation_feedback_id_seq OWNED BY public.recommendation_feedback.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    jti character varying NOT NULL,
    user_id integer NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.refresh_tokens OWNER TO dtms_user;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.refresh_tokens_id_seq OWNER TO dtms_user;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: religious_content; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.religious_content (
    id integer NOT NULL,
    text_ar text NOT NULL,
    reference character varying,
    theme character varying NOT NULL,
    CONSTRAINT ck_religious_theme CHECK (((theme)::text = ANY ((ARRAY['patience'::character varying, 'effort'::character varying, 'reward'::character varying, 'focus'::character varying])::text[])))
);


ALTER TABLE public.religious_content OWNER TO dtms_user;

--
-- Name: religious_content_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.religious_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.religious_content_id_seq OWNER TO dtms_user;

--
-- Name: religious_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.religious_content_id_seq OWNED BY public.religious_content.id;


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.schedules (
    id integer NOT NULL,
    course_id integer NOT NULL,
    content_id integer,
    date date,
    start_time character varying,
    link character varying,
    type character varying NOT NULL,
    status character varying DEFAULT 'closed'::character varying NOT NULL,
    CONSTRAINT ck_schedule_status CHECK (((status)::text = ANY ((ARRAY['closed'::character varying, 'open'::character varying])::text[]))),
    CONSTRAINT ck_schedule_type CHECK (((type)::text = ANY ((ARRAY['exam'::character varying, 'workshop'::character varying])::text[])))
);


ALTER TABLE public.schedules OWNER TO dtms_user;

--
-- Name: schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.schedules_id_seq OWNER TO dtms_user;

--
-- Name: schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.schedules_id_seq OWNED BY public.schedules.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.sessions (
    session_id integer NOT NULL,
    course_id integer NOT NULL,
    session_date date,
    duration character varying,
    teacher_id integer
);


ALTER TABLE public.sessions OWNER TO dtms_user;

--
-- Name: sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sessions_session_id_seq OWNER TO dtms_user;

--
-- Name: sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.sessions_session_id_seq OWNED BY public.sessions.session_id;


--
-- Name: staged_imports; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.staged_imports (
    id character varying NOT NULL,
    row_data text NOT NULL,
    headers text NOT NULL,
    filename character varying,
    row_count integer NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.staged_imports OWNER TO dtms_user;

--
-- Name: status_change_log; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.status_change_log (
    id integer NOT NULL,
    enrollment_id integer NOT NULL,
    old_status character varying,
    new_status character varying NOT NULL,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.status_change_log OWNER TO dtms_user;

--
-- Name: status_change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.status_change_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.status_change_log_id_seq OWNER TO dtms_user;

--
-- Name: status_change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.status_change_log_id_seq OWNED BY public.status_change_log.id;


--
-- Name: student_item_progress; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.student_item_progress (
    id integer NOT NULL,
    enrollment_id integer NOT NULL,
    item_id integer NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    pre_quiz_score integer,
    post_quiz_score integer,
    completed_at timestamp without time zone
);


ALTER TABLE public.student_item_progress OWNER TO dtms_user;

--
-- Name: student_item_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.student_item_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.student_item_progress_id_seq OWNER TO dtms_user;

--
-- Name: student_item_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.student_item_progress_id_seq OWNED BY public.student_item_progress.id;


--
-- Name: students; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.students (
    student_id integer NOT NULL,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    date_of_birth date,
    student_number character varying NOT NULL,
    email character varying,
    phone_number character varying,
    city character varying,
    profession character varying,
    telegram_id bigint,
    last_active date,
    streak integer DEFAULT 0 NOT NULL,
    user_id integer
);


ALTER TABLE public.students OWNER TO dtms_user;

--
-- Name: students_student_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.students_student_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.students_student_id_seq OWNER TO dtms_user;

--
-- Name: students_student_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.students_student_id_seq OWNED BY public.students.student_id;


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.submissions (
    id integer NOT NULL,
    student_id integer NOT NULL,
    course_id integer NOT NULL,
    content_id integer,
    file_id character varying NOT NULL,
    file_name character varying,
    submitted_at timestamp without time zone NOT NULL,
    grade double precision,
    feedback text,
    graded_at timestamp without time zone,
    media_group_id character varying
);


ALTER TABLE public.submissions OWNER TO dtms_user;

--
-- Name: submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.submissions_id_seq OWNER TO dtms_user;

--
-- Name: submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.submissions_id_seq OWNED BY public.submissions.id;


--
-- Name: task_progress; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.task_progress (
    id integer NOT NULL,
    student_id integer NOT NULL,
    task_id integer NOT NULL,
    action character varying NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT ck_task_progress_action CHECK (((action)::text = ANY ((ARRAY['started'::character varying, 'completed'::character varying, 'skipped'::character varying, 'resumed'::character varying])::text[])))
);


ALTER TABLE public.task_progress OWNER TO dtms_user;

--
-- Name: task_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.task_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.task_progress_id_seq OWNER TO dtms_user;

--
-- Name: task_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.task_progress_id_seq OWNED BY public.task_progress.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    plan_id integer NOT NULL,
    student_id integer NOT NULL,
    course_id integer NOT NULL,
    title character varying NOT NULL,
    type character varying NOT NULL,
    day character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    priority character varying DEFAULT 'medium'::character varying NOT NULL,
    metadata text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    CONSTRAINT ck_task_day CHECK (((day)::text = ANY ((ARRAY['monday'::character varying, 'tuesday'::character varying, 'wednesday'::character varying, 'thursday'::character varying, 'friday'::character varying, 'saturday'::character varying, 'sunday'::character varying, 'daily'::character varying])::text[]))),
    CONSTRAINT ck_task_priority CHECK (((priority)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT ck_task_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'done'::character varying, 'skipped'::character varying])::text[]))),
    CONSTRAINT ck_task_type CHECK (((type)::text = ANY ((ARRAY['lecture'::character varying, 'homework'::character varying, 'revision'::character varying, 'exam'::character varying, 'exercise'::character varying])::text[])))
);


ALTER TABLE public.tasks OWNER TO dtms_user;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tasks_id_seq OWNER TO dtms_user;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: telegram_groups; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.telegram_groups (
    id integer NOT NULL,
    course_id integer NOT NULL,
    telegram_group_id bigint NOT NULL,
    group_name character varying
);


ALTER TABLE public.telegram_groups OWNER TO dtms_user;

--
-- Name: telegram_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.telegram_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.telegram_groups_id_seq OWNER TO dtms_user;

--
-- Name: telegram_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.telegram_groups_id_seq OWNED BY public.telegram_groups.id;


--
-- Name: transcripts; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.transcripts (
    transcript_id integer NOT NULL,
    course_id integer NOT NULL,
    content_id integer NOT NULL,
    content text,
    file_path character varying,
    created_at character varying
);


ALTER TABLE public.transcripts OWNER TO dtms_user;

--
-- Name: transcripts_transcript_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.transcripts_transcript_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.transcripts_transcript_id_seq OWNER TO dtms_user;

--
-- Name: transcripts_transcript_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.transcripts_transcript_id_seq OWNED BY public.transcripts.transcript_id;


--
-- Name: user_progress; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.user_progress (
    id integer NOT NULL,
    student_id integer NOT NULL,
    content_id integer NOT NULL,
    completed boolean DEFAULT true NOT NULL,
    completed_at character varying
);


ALTER TABLE public.user_progress OWNER TO dtms_user;

--
-- Name: user_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.user_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_progress_id_seq OWNER TO dtms_user;

--
-- Name: user_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.user_progress_id_seq OWNED BY public.user_progress.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    email character varying NOT NULL,
    role character varying NOT NULL,
    password_hash character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_user_role CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'teacher'::character varying, 'supervisor'::character varying, 'student'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO dtms_user;

--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_user_id_seq OWNER TO dtms_user;

--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: week_items; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.week_items (
    id integer NOT NULL,
    week_id integer NOT NULL,
    "order" integer NOT NULL,
    item_type character varying NOT NULL,
    title character varying NOT NULL,
    description text,
    video_url character varying,
    has_pre_quiz boolean DEFAULT false NOT NULL,
    has_post_quiz boolean DEFAULT false NOT NULL,
    pre_quiz_form_url character varying,
    post_quiz_form_url character varying,
    CONSTRAINT ck_week_item_type CHECK (((item_type)::text = ANY ((ARRAY['lecture'::character varying, 'reading'::character varying, 'listening'::character varying, 'mini_circle_exam'::character varying])::text[])))
);


ALTER TABLE public.week_items OWNER TO dtms_user;

--
-- Name: week_items_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.week_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.week_items_id_seq OWNER TO dtms_user;

--
-- Name: week_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.week_items_id_seq OWNED BY public.week_items.id;


--
-- Name: weekly_plans; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.weekly_plans (
    id integer NOT NULL,
    student_id integer NOT NULL,
    course_id integer NOT NULL,
    week_start date NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    expires_at date,
    raw_text text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.weekly_plans OWNER TO dtms_user;

--
-- Name: weekly_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.weekly_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.weekly_plans_id_seq OWNER TO dtms_user;

--
-- Name: weekly_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.weekly_plans_id_seq OWNED BY public.weekly_plans.id;


--
-- Name: workshop_attendance; Type: TABLE; Schema: public; Owner: dtms_user
--

CREATE TABLE public.workshop_attendance (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    student_id integer NOT NULL,
    attended_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workshop_attendance OWNER TO dtms_user;

--
-- Name: workshop_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: dtms_user
--

CREATE SEQUENCE public.workshop_attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.workshop_attendance_id_seq OWNER TO dtms_user;

--
-- Name: workshop_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dtms_user
--

ALTER SEQUENCE public.workshop_attendance_id_seq OWNED BY public.workshop_attendance.id;


--
-- Name: answers answer_id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.answers ALTER COLUMN answer_id SET DEFAULT nextval('public.answers_answer_id_seq'::regclass);


--
-- Name: attendance_records id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.attendance_records ALTER COLUMN id SET DEFAULT nextval('public.attendance_records_id_seq'::regclass);


--
-- Name: compensation_requests id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.compensation_requests ALTER COLUMN id SET DEFAULT nextval('public.compensation_requests_id_seq'::regclass);


--
-- Name: content id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.content ALTER COLUMN id SET DEFAULT nextval('public.content_id_seq'::regclass);


--
-- Name: course_notes id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.course_notes ALTER COLUMN id SET DEFAULT nextval('public.course_notes_id_seq'::regclass);


--
-- Name: courses course_id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.courses ALTER COLUMN course_id SET DEFAULT nextval('public.courses_course_id_seq'::regclass);


--
-- Name: curriculum_attendance id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.curriculum_attendance ALTER COLUMN id SET DEFAULT nextval('public.curriculum_attendance_id_seq'::regclass);


--
-- Name: curriculum_sessions id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.curriculum_sessions ALTER COLUMN id SET DEFAULT nextval('public.curriculum_sessions_id_seq'::regclass);


--
-- Name: enrollments enrollment_id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.enrollments ALTER COLUMN enrollment_id SET DEFAULT nextval('public.enrollments_enrollment_id_seq'::regclass);


--
-- Name: grade_categories id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.grade_categories ALTER COLUMN id SET DEFAULT nextval('public.grade_categories_id_seq'::regclass);


--
-- Name: grades grade_id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.grades ALTER COLUMN grade_id SET DEFAULT nextval('public.grades_grade_id_seq'::regclass);


--
-- Name: invite_tokens id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.invite_tokens ALTER COLUMN id SET DEFAULT nextval('public.invite_tokens_id_seq'::regclass);


--
-- Name: program_catalog id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.program_catalog ALTER COLUMN id SET DEFAULT nextval('public.program_catalog_id_seq'::regclass);


--
-- Name: program_weeks id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.program_weeks ALTER COLUMN id SET DEFAULT nextval('public.program_weeks_id_seq'::regclass);


--
-- Name: questions question_id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.questions ALTER COLUMN question_id SET DEFAULT nextval('public.questions_question_id_seq'::regclass);


--
-- Name: quiz_options id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.quiz_options ALTER COLUMN id SET DEFAULT nextval('public.quiz_options_id_seq'::regclass);


--
-- Name: quiz_questions id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.quiz_questions ALTER COLUMN id SET DEFAULT nextval('public.quiz_questions_id_seq'::regclass);


--
-- Name: recommendation_feedback id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.recommendation_feedback ALTER COLUMN id SET DEFAULT nextval('public.recommendation_feedback_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: religious_content id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.religious_content ALTER COLUMN id SET DEFAULT nextval('public.religious_content_id_seq'::regclass);


--
-- Name: schedules id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.schedules ALTER COLUMN id SET DEFAULT nextval('public.schedules_id_seq'::regclass);


--
-- Name: sessions session_id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.sessions ALTER COLUMN session_id SET DEFAULT nextval('public.sessions_session_id_seq'::regclass);


--
-- Name: status_change_log id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.status_change_log ALTER COLUMN id SET DEFAULT nextval('public.status_change_log_id_seq'::regclass);


--
-- Name: student_item_progress id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.student_item_progress ALTER COLUMN id SET DEFAULT nextval('public.student_item_progress_id_seq'::regclass);


--
-- Name: students student_id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.students ALTER COLUMN student_id SET DEFAULT nextval('public.students_student_id_seq'::regclass);


--
-- Name: submissions id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.submissions ALTER COLUMN id SET DEFAULT nextval('public.submissions_id_seq'::regclass);


--
-- Name: task_progress id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.task_progress ALTER COLUMN id SET DEFAULT nextval('public.task_progress_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: telegram_groups id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.telegram_groups ALTER COLUMN id SET DEFAULT nextval('public.telegram_groups_id_seq'::regclass);


--
-- Name: transcripts transcript_id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.transcripts ALTER COLUMN transcript_id SET DEFAULT nextval('public.transcripts_transcript_id_seq'::regclass);


--
-- Name: user_progress id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.user_progress ALTER COLUMN id SET DEFAULT nextval('public.user_progress_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Name: week_items id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.week_items ALTER COLUMN id SET DEFAULT nextval('public.week_items_id_seq'::regclass);


--
-- Name: weekly_plans id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.weekly_plans ALTER COLUMN id SET DEFAULT nextval('public.weekly_plans_id_seq'::regclass);


--
-- Name: workshop_attendance id; Type: DEFAULT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.workshop_attendance ALTER COLUMN id SET DEFAULT nextval('public.workshop_attendance_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.alembic_version (version_num) FROM stdin;
029
\.


--
-- Data for Name: answers; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.answers (answer_id, question_id, course_id, student_id, teacher_id, answer_text, file_id, media_group_id, answered_at) FROM stdin;
\.


--
-- Data for Name: apscheduler_jobs; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.apscheduler_jobs (id, next_run_time, job_state) FROM stdin;
weekly_inactivity_digest	1791187200	\\x80059556040000000000007d94288c0776657273696f6e944b018c026964948c187765656b6c795f696e61637469766974795f646967657374948c0466756e63948c2b6170702e636f72652e7363686564756c65723a5f73656e645f696e61637469766974795f64696765737473948c0774726967676572948c1961707363686564756c65722e74726967676572732e63726f6e948c0b43726f6e547269676765729493942981947d942868014b028c0874696d657a6f6e65948c086275696c74696e73948c07676574617474729493948c087a6f6e65696e666f948c085a6f6e65496e666f9493948c095f756e7069636b6c6594869452948c074574632f555443944b01869452948c0a73746172745f64617465944e8c08656e645f64617465944e8c066669656c6473945d94288c2061707363686564756c65722e74726967676572732e63726f6e2e6669656c6473948c09426173654669656c649493942981947d94288c046e616d65948c0479656172948c0a69735f64656661756c7494888c0b65787072657373696f6e73945d948c2561707363686564756c65722e74726967676572732e63726f6e2e65787072657373696f6e73948c0d416c6c45787072657373696f6e9493942981947d948c0473746570944e7362617562681d8c0a4d6f6e74684669656c649493942981947d942868228c056d6f6e74689468248868255d9468292981947d94682c4e7362617562681d8c0f4461794f664d6f6e74684669656c649493942981947d942868228c036461799468248868255d9468292981947d94682c4e7362617562681d8c095765656b4669656c649493942981947d942868228c047765656b9468248868255d9468292981947d94682c4e7362617562681d8c0e4461794f665765656b4669656c649493942981947d942868228c0b6461795f6f665f7765656b9468248968255d9468278c165765656b64617952616e676545787072657373696f6e9493942981947d9428682c4e8c056669727374944b008c046c617374944b007562617562681f2981947d942868228c04686f75729468248968255d9468278c0f52616e676545787072657373696f6e9493942981947d9428682c4e684f4b0868504b087562617562681f2981947d942868228c066d696e7574659468248968255d9468562981947d9428682c4e684f4b0068504b007562617562681f2981947d942868228c067365636f6e649468248868255d9468562981947d9428682c4e684f4b0068504b007562617562658c066a6974746572944e75628c086578656375746f72948c0764656661756c74948c046172677394298c066b7761726773947d9468228c185f73656e645f696e61637469766974795f64696765737473948c126d6973666972655f67726163655f74696d65944d100e8c08636f616c6573636594888c0d6d61785f696e7374616e636573944b018c0d6e6578745f72756e5f74696d65948c086461746574696d65948c086461746574696d65949394430a07ea0a0508000000000094681886945294752e
nightly_auto_complete_courses	1790643600	\\x80059533040000000000007d94288c0776657273696f6e944b018c026964948c1d6e696768746c795f6175746f5f636f6d706c6574655f636f7572736573948c0466756e63948c296170702e636f72652e7363686564756c65723a5f6175746f5f636f6d706c6574655f636f7572736573948c0774726967676572948c1961707363686564756c65722e74726967676572732e63726f6e948c0b43726f6e547269676765729493942981947d942868014b028c0874696d657a6f6e65948c086275696c74696e73948c07676574617474729493948c087a6f6e65696e666f948c085a6f6e65496e666f9493948c095f756e7069636b6c6594869452948c074574632f555443944b01869452948c0a73746172745f64617465944e8c08656e645f64617465944e8c066669656c6473945d94288c2061707363686564756c65722e74726967676572732e63726f6e2e6669656c6473948c09426173654669656c649493942981947d94288c046e616d65948c0479656172948c0a69735f64656661756c7494888c0b65787072657373696f6e73945d948c2561707363686564756c65722e74726967676572732e63726f6e2e65787072657373696f6e73948c0d416c6c45787072657373696f6e9493942981947d948c0473746570944e7362617562681d8c0a4d6f6e74684669656c649493942981947d942868228c056d6f6e74689468248868255d9468292981947d94682c4e7362617562681d8c0f4461794f664d6f6e74684669656c649493942981947d942868228c036461799468248868255d9468292981947d94682c4e7362617562681d8c095765656b4669656c649493942981947d942868228c047765656b9468248868255d9468292981947d94682c4e7362617562681d8c0e4461794f665765656b4669656c649493942981947d942868228c0b6461795f6f665f7765656b9468248868255d9468292981947d94682c4e7362617562681f2981947d942868228c04686f75729468248968255d9468278c0f52616e676545787072657373696f6e9493942981947d9428682c4e8c056669727374944b018c046c617374944b017562617562681f2981947d942868228c066d696e7574659468248968255d9468522981947d9428682c4e68554b0068564b007562617562681f2981947d942868228c067365636f6e649468248868255d9468522981947d9428682c4e68554b0068564b007562617562658c066a6974746572944e75628c086578656375746f72948c0764656661756c74948c046172677394298c066b7761726773947d9468228c165f6175746f5f636f6d706c6574655f636f7572736573948c126d6973666972655f67726163655f74696d65944d100e8c08636f616c6573636594888c0d6d61785f696e7374616e636573944b018c0d6e6578745f72756e5f74696d65948c086461746574696d65948c086461746574696d65949394430a07ea091d01000000000094681886945294752e
weekly_refresh_token_purge	1791187500	\\x80059562040000000000007d94288c0776657273696f6e944b018c026964948c1a7765656b6c795f726566726573685f746f6b656e5f7075726765948c0466756e63948c306170702e636f72652e7363686564756c65723a5f70757267655f657870697265645f726566726573685f746f6b656e73948c0774726967676572948c1961707363686564756c65722e74726967676572732e63726f6e948c0b43726f6e547269676765729493942981947d942868014b028c0874696d657a6f6e65948c086275696c74696e73948c07676574617474729493948c087a6f6e65696e666f948c085a6f6e65496e666f9493948c095f756e7069636b6c6594869452948c074574632f555443944b01869452948c0a73746172745f64617465944e8c08656e645f64617465944e8c066669656c6473945d94288c2061707363686564756c65722e74726967676572732e63726f6e2e6669656c6473948c09426173654669656c649493942981947d94288c046e616d65948c0479656172948c0a69735f64656661756c7494888c0b65787072657373696f6e73945d948c2561707363686564756c65722e74726967676572732e63726f6e2e65787072657373696f6e73948c0d416c6c45787072657373696f6e9493942981947d948c0473746570944e7362617562681d8c0a4d6f6e74684669656c649493942981947d942868228c056d6f6e74689468248868255d9468292981947d94682c4e7362617562681d8c0f4461794f664d6f6e74684669656c649493942981947d942868228c036461799468248868255d9468292981947d94682c4e7362617562681d8c095765656b4669656c649493942981947d942868228c047765656b9468248868255d9468292981947d94682c4e7362617562681d8c0e4461794f665765656b4669656c649493942981947d942868228c0b6461795f6f665f7765656b9468248968255d9468278c165765656b64617952616e676545787072657373696f6e9493942981947d9428682c4e8c056669727374944b008c046c617374944b007562617562681f2981947d942868228c04686f75729468248968255d9468278c0f52616e676545787072657373696f6e9493942981947d9428682c4e684f4b0868504b087562617562681f2981947d942868228c066d696e7574659468248968255d9468562981947d9428682c4e684f4b0568504b057562617562681f2981947d942868228c067365636f6e649468248868255d9468562981947d9428682c4e684f4b0068504b007562617562658c066a6974746572944e75628c086578656375746f72948c0764656661756c74948c046172677394298c066b7761726773947d9468228c1d5f70757267655f657870697265645f726566726573685f746f6b656e73948c126d6973666972655f67726163655f74696d65944d100e8c08636f616c6573636594888c0d6d61785f696e7374616e636573944b018c0d6e6578745f72756e5f74696d65948c086461746574696d65948c086461746574696d65949394430a07ea0a0508050000000094681886945294752e
\.


--
-- Data for Name: attendance_records; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.attendance_records (id, enrollment_id, session_date, status, notes, recorded_at) FROM stdin;
\.


--
-- Data for Name: compensation_requests; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.compensation_requests (id, student_id, course_id, content_id, status, created_at, reviewed_at, reviewed_by, notes, telegram_id) FROM stdin;
\.


--
-- Data for Name: content; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.content (id, name, content_type, course_id, week, content_order) FROM stdin;
\.


--
-- Data for Name: course_notes; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.course_notes (id, course_id, author_id, curriculum_session_id, content, created_at, parent_id) FROM stdin;
\.


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.courses (course_id, title, description, start_date, end_date, status, teacher_id, supervisor_id, course_type, total_sessions, workshop_day) FROM stdin;
2	دبلومة العلم و العمل	\N	\N	\N	Active	\N	\N	online	\N	\N
1	دبلومة العلم و العمل	\N	\N	\N	Active	\N	6	online	\N	\N
3	الأسبوع الأول	دبلوممة	2026-10-11	2027-10-11	Active	4	6	online	\N	\N
4	دبلومة العلم و العمل - جويلية 2026	.	2026-06-01	2027-06-01	Active	4	6	online	\N	\N
\.


--
-- Data for Name: curriculum_attendance; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.curriculum_attendance (id, enrollment_id, curriculum_session_id, status, notes, date_recorded, followed_up) FROM stdin;
\.


--
-- Data for Name: curriculum_sessions; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.curriculum_sessions (id, course_id, week_number, session_type, title, order_index) FROM stdin;
\.


--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.enrollments (enrollment_id, student_id, course_id, enrollment_date, completion_status, absences, attendance_count, makeup_count, approval_status) FROM stdin;
1	1	1	2026-09-07	string	0	0	0	pending
2	1	3	2026-09-08	Ongoing	0	0	0	approved
3	2	4	2026-09-11	Ongoing	0	0	0	pending
\.


--
-- Data for Name: grade_categories; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.grade_categories (id, course_id, name, max_value, kind, order_index) FROM stdin;
\.


--
-- Data for Name: grades; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.grades (grade_id, enrollment_id, type, value, date_recorded, max_value, source, session_number, category_id) FROM stdin;
\.


--
-- Data for Name: invite_tokens; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.invite_tokens (id, token, user_id, used, expires_at, created_at) FROM stdin;
2	fHSYyl8jPiiyDkvIvLUpo-Ei9LapRVAJ6eBuj_iutJw	5	f	2026-09-13 18:20:04.929125	2026-09-06 18:20:04.925199
3	ChFANR8W_7-DtWOoQAn5BWh7IBSmM-nWHLmceT7IEX0	4	f	2026-09-06 19:20:09.554514	2026-09-06 18:20:09.533616
4	1Ws45F6qPd7bJmYVggOMNBctGGYd9pzVb-miYc1hW2A	6	f	2026-09-14 20:28:50.515706	2026-09-07 20:28:50.244096
\.


--
-- Data for Name: program_catalog; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.program_catalog (id, name, category, is_active, sort_order) FROM stdin;
1	دبلومة العلم والعمل	adult	t	1
2	صناعة الطفل 1	adult	t	2
3	صناعة الطفل 2	adult	t	3
4	صناعة الطفل 3	adult	t	4
5	بناء الأبناء 1	adult	t	5
6	بناء الأبناء 2	adult	t	6
7	إمداد الفؤاد 1	adult	t	7
8	إمداد الفؤاد 2	adult	t	8
9	منهاج الطالب المسلم	adult	t	9
10	منجيات من فتن الشهوات	adult	t	10
11	إسعاد الأولاد	adult	t	11
\.


--
-- Data for Name: program_weeks; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.program_weeks (id, course_id, week_number, title, opens_at, is_visible) FROM stdin;
5	3	2	الأسبوع الثاني	\N	t
6	3	3	الأسبوع الثالث	\N	t
7	3	4	الأسبوع الرابع	\N	t
4	3	1	الأسبوع الأول	\N	t
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.questions (question_id, student_id, course_id, question_text, status, created_at) FROM stdin;
\.


--
-- Data for Name: quiz_options; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.quiz_options (id, question_id, option_text, is_correct, "order") FROM stdin;
\.


--
-- Data for Name: quiz_questions; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.quiz_questions (id, item_id, phase, question_text, "order") FROM stdin;
\.


--
-- Data for Name: recommendation_feedback; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.recommendation_feedback (id, student_id, content_id, course_id, content_type, is_mandatory, reaction, created_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.refresh_tokens (id, jti, user_id, expires_at, revoked, created_at) FROM stdin;
1	98467182-cf61-4122-83d9-66adb242d617	1	2026-09-13 14:56:45.805554	t	2026-09-06 14:56:45.101765
2	dd3d418e-ecee-4c16-b6c3-47861a8f2e43	1	2026-09-13 17:10:08.65711	t	2026-09-06 17:10:08.450327
3	deecb0a0-c502-4b1d-a9be-991ef3cf7e3a	3	2026-09-13 17:35:39.384349	f	2026-09-06 17:35:39.370365
4	5c4f4c23-b551-4a1a-b6a4-74706ccc2f6e	3	2026-09-13 17:35:52.010368	t	2026-09-06 17:35:51.615535
5	102d6bb9-4008-401d-b172-37a39832eaf9	1	2026-09-13 18:18:44.371625	t	2026-09-06 18:18:43.98225
6	b9197c06-d661-46c5-9332-fc680d5c9698	3	2026-09-13 18:21:04.326664	t	2026-09-06 18:21:03.956447
39	146c4f3b-d982-4788-8269-815d40a69765	3	2026-09-14 18:47:26.477915	t	2026-09-07 18:47:26.437706
40	41293850-17ba-4bb5-bb09-d7b4c81c1c20	3	2026-09-14 18:48:11.957753	t	2026-09-07 18:48:11.652822
41	866bfdda-dc3f-4826-8131-4337f3b04a3f	1	2026-09-14 18:57:12.297971	t	2026-09-07 18:57:11.664411
42	e7591539-bafb-421a-8324-7cbdc5dc8fa3	1	2026-09-14 19:58:49.127309	t	2026-09-07 19:58:49.117749
68	8c0de970-2fc9-4f89-940a-1f920cc93aa5	1	2026-09-16 16:03:28.29009	t	2026-09-09 16:03:27.692746
69	7407b358-fa69-4483-9623-a228df9d4122	1	2026-09-16 16:44:46.424754	t	2026-09-09 16:44:46.395569
70	6941f99f-b5c6-4d9d-b1b4-4728a5f20c18	3	2026-09-16 16:45:52.291947	t	2026-09-09 16:45:51.627316
43	67401530-f8dc-4b7f-a2a0-73e0b15bd68e	3	2026-09-14 20:06:46.741318	t	2026-09-07 20:06:46.347906
44	bdf41853-76b2-461d-97b2-499c35e85238	1	2026-09-14 20:24:22.010777	t	2026-09-07 20:24:21.410641
45	449f322d-be1c-4ef9-91d0-3566a68aa412	1	2026-09-14 20:25:10.659364	t	2026-09-07 20:25:09.825351
46	d0805ccd-ffc6-40b2-b717-59de3ade96ae	6	2026-09-14 20:30:11.926608	t	2026-09-07 20:30:11.32757
47	bc50d971-3839-4eaa-9ee1-c574605bb9f4	3	2026-09-14 20:31:57.174614	t	2026-09-07 20:31:56.600288
48	5f2c73d0-6482-4509-834c-0a5dde51af0d	1	2026-09-14 20:32:42.563041	t	2026-09-07 20:32:42.12316
49	88e01910-7477-469c-a13a-d1d5afb9727b	1	2026-09-15 12:02:03.671681	t	2026-09-08 12:02:03.452412
50	8b541b74-eb1d-416b-98de-566c2884b036	6	2026-09-15 12:06:04.762877	t	2026-09-08 12:06:04.257046
51	771603f9-7a14-442e-8bde-8d4ed032cbd9	3	2026-09-15 12:07:23.168596	t	2026-09-08 12:07:22.618702
52	344d4bc3-ed71-4df2-9ace-eeb44d8345ad	1	2026-09-15 19:11:40.190908	t	2026-09-08 19:11:39.467789
53	f127fe57-f5cd-44fa-8e50-61827d2a8778	6	2026-09-15 19:13:21.4381	f	2026-09-08 19:13:21.006954
54	ef777c80-da4d-4861-baea-676485ec843a	6	2026-09-15 19:40:26.153909	t	2026-09-08 19:40:25.799152
55	a9ea43f9-22ad-4b3a-afed-b3cc73df701c	6	2026-09-15 20:48:40.657935	t	2026-09-08 20:48:40.324497
56	89314e68-ae04-4fe4-9d81-1cf8baa5444f	6	2026-09-15 20:49:27.687107	t	2026-09-08 20:49:27.140397
57	905d97a1-cb87-4a1a-b417-9e72271469c8	1	2026-09-15 20:54:02.787982	t	2026-09-08 20:54:02.227749
58	78a3d1f4-24da-49d5-8409-8ad646e7fa0c	3	2026-09-15 20:55:58.949235	t	2026-09-08 20:55:58.309953
59	469c8b58-d00e-4539-9ba2-9b464b190fac	6	2026-09-15 20:57:08.588457	t	2026-09-08 20:57:08.178909
60	6d0f3b0a-cb26-4407-99cd-0b5b555e8274	3	2026-09-15 21:08:22.166571	t	2026-09-08 21:08:21.576726
61	f8b9e187-88af-41f3-814d-fb560afa9fbd	6	2026-09-15 21:23:20.387816	t	2026-09-08 21:23:19.694842
62	808be41e-a208-409e-957a-4828ff0e7294	1	2026-09-15 21:24:26.895789	t	2026-09-08 21:24:26.322068
63	6739abca-9182-4a67-8ff4-63d4f7affc51	3	2026-09-15 21:25:46.075841	t	2026-09-08 21:25:45.534783
64	441c7bed-6343-4c30-aae5-02ccff60d515	6	2026-09-15 21:31:48.205149	t	2026-09-08 21:31:47.563721
65	10035bb2-b659-41a2-80e6-18d68435ed23	1	2026-09-15 21:32:38.913455	t	2026-09-08 21:32:38.458062
66	1eb7a551-76a7-4b51-8cdb-93c7ba87dd9e	1	2026-09-16 15:41:52.265934	t	2026-09-09 15:41:52.167556
67	cca2ed76-8867-412f-9b5a-b8260b9af7ff	3	2026-09-16 15:42:19.246275	t	2026-09-09 15:42:18.762534
71	70bc4af3-5cf2-4ab3-87b7-70a4c9debe6c	3	2026-09-16 20:59:26.692671	t	2026-09-09 20:59:26.637159
72	3845e1e3-0134-42fe-81ae-a5cb525048f1	3	2026-09-16 21:26:25.594052	t	2026-09-09 21:26:25.567183
73	3b0cf362-6472-47da-91a3-500c9ef7630b	1	2026-09-16 21:27:11.122852	t	2026-09-09 21:27:10.836486
74	0a272c98-4044-482a-8e57-15ceda0682c9	3	2026-09-16 21:41:08.088656	t	2026-09-09 21:41:07.760698
75	c3ee7095-ef65-43de-a129-a1e19b8a7ab8	1	2026-09-16 21:46:14.945206	t	2026-09-09 21:46:14.441891
76	f4311fab-db53-403a-ac33-83a895ec54a3	1	2026-09-18 09:55:06.907736	t	2026-09-11 09:55:06.882312
77	53c05521-9367-45b5-a063-5b52586d7e70	3	2026-09-18 10:08:07.785678	t	2026-09-11 10:08:07.516087
78	249eaa57-6352-427b-9019-bd67cdeacd36	1	2026-09-18 10:16:19.907662	t	2026-09-11 10:16:19.599599
79	bee41ffe-7288-4afb-99a4-9d1397849933	3	2026-09-18 10:22:37.433608	t	2026-09-11 10:22:37.102225
80	a94dbb2d-f4a5-4497-b274-4512055130f0	6	2026-09-18 10:25:42.148525	t	2026-09-11 10:25:41.772505
81	f942c8f0-2621-4cb2-a282-39976c479d2c	1	2026-09-18 10:27:24.211212	t	2026-09-11 10:27:23.807169
82	fcdcd5b4-c7b7-4be0-ac42-40bf053d002b	7	2026-09-18 10:28:44.144663	f	2026-09-11 10:28:44.14052
83	eca2272f-fe57-48be-a942-93a759c87f8b	7	2026-09-18 10:28:54.739404	t	2026-09-11 10:28:54.379412
84	4c1581a2-1cea-48f9-8d30-050955fccd5c	6	2026-09-18 10:29:27.99274	t	2026-09-11 10:29:27.644916
85	561ac35c-3184-4275-9459-652f6de85876	7	2026-09-18 10:30:27.059908	t	2026-09-11 10:30:26.761013
86	232d9606-c7f6-4df6-bdca-15dd0fb78843	3	2026-09-18 10:30:42.846725	t	2026-09-11 10:30:42.523811
87	7a5f5bd9-2b79-4925-8dd5-133e5ccb8a15	1	2026-09-18 10:34:13.593163	t	2026-09-11 10:34:13.298661
88	6d80c798-6905-45bb-9ffa-61981bd1c566	6	2026-09-18 10:34:55.5869	t	2026-09-11 10:34:55.294043
89	6bbaf7ae-81a1-4586-9f0e-c07cbd80c564	7	2026-09-18 10:35:20.178716	t	2026-09-11 10:35:19.892256
90	2150f1f2-78ce-4889-8703-74134d2be4ae	6	2026-09-18 10:35:41.279572	t	2026-09-11 10:35:40.965281
91	25be8c92-25ef-4175-8ac2-7ca1023d89ae	7	2026-09-18 10:36:57.695926	t	2026-09-11 10:36:57.347153
92	44b0b197-caa9-4853-88c0-26be3156cc80	7	2026-09-21 09:20:55.536744	t	2026-09-14 09:20:55.268493
93	131f6beb-c007-45a2-ad53-f2af82c06bb7	3	2026-09-21 09:33:17.892438	t	2026-09-14 09:33:17.470352
94	a7bababb-d388-48b1-b5d5-5756bb9dfddb	1	2026-09-21 09:35:29.58783	t	2026-09-14 09:35:29.19271
95	e1bff547-82a1-4584-adea-7f52ee5209a9	6	2026-09-21 09:41:01.465666	t	2026-09-14 09:41:01.114691
96	7f255f39-a228-46cb-a700-8275cb718f5d	3	2026-09-21 09:42:57.884048	f	2026-09-14 09:42:57.569019
\.


--
-- Data for Name: religious_content; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.religious_content (id, text_ar, reference, theme) FROM stdin;
\.


--
-- Data for Name: schedules; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.schedules (id, course_id, content_id, date, start_time, link, type, status) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.sessions (session_id, course_id, session_date, duration, teacher_id) FROM stdin;
\.


--
-- Data for Name: staged_imports; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.staged_imports (id, row_data, headers, filename, row_count, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: status_change_log; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.status_change_log (id, enrollment_id, old_status, new_status, changed_by, changed_at) FROM stdin;
1	1	Ongoing	string	6	2026-09-08 19:43:20.518615
\.


--
-- Data for Name: student_item_progress; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.student_item_progress (id, enrollment_id, item_id, completed, pre_quiz_score, post_quiz_score, completed_at) FROM stdin;
3	2	13	t	\N	\N	2026-09-11 10:30:58.705641
4	2	14	t	\N	\N	2026-09-11 10:31:07.976516
5	2	3	t	\N	\N	2026-09-11 10:31:09.305527
6	2	2	t	\N	\N	2026-09-11 10:31:10.493092
8	2	11	f	\N	\N	\N
9	2	10	f	\N	\N	\N
10	2	9	f	\N	\N	\N
11	2	8	f	\N	\N	\N
13	2	7	f	\N	\N	\N
12	2	6	f	\N	\N	\N
14	2	5	f	\N	\N	\N
15	2	4	f	\N	\N	\N
2	2	12	t	\N	\N	2026-09-14 09:34:15.494093
1	2	1	t	\N	\N	2026-09-14 09:34:16.187215
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.students (student_id, first_name, last_name, date_of_birth, student_number, email, phone_number, city, profession, telegram_id, last_active, streak, user_id) FROM stdin;
1	fer	dawes	\N	STU000003	ferdawes@gmail.com	5	5	\N	\N	\N	0	3
2	etudiant	ln	\N	STU000007	etud@gmail.com			\N	\N	\N	0	7
\.


--
-- Data for Name: submissions; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.submissions (id, student_id, course_id, content_id, file_id, file_name, submitted_at, grade, feedback, graded_at, media_group_id) FROM stdin;
\.


--
-- Data for Name: task_progress; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.task_progress (id, student_id, task_id, action, "timestamp", notes) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.tasks (id, plan_id, student_id, course_id, title, type, day, status, priority, metadata, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: telegram_groups; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.telegram_groups (id, course_id, telegram_group_id, group_name) FROM stdin;
\.


--
-- Data for Name: transcripts; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.transcripts (transcript_id, course_id, content_id, content, file_path, created_at) FROM stdin;
\.


--
-- Data for Name: user_progress; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.user_progress (id, student_id, content_id, completed, completed_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.users (user_id, first_name, last_name, email, role, password_hash, is_active) FROM stdin;
1	Admin	DTMS	admin@dtms.com	admin	$2b$12$AKH63rcow0FHh3nQD4/LfO7f2N/k07F3VmxHuwf7aW/K9m9mUbH3u	t
3	fer	dawes	ferdawes@gmail.com	student	$2b$12$yML/PjLsDra5pvw9hZK6a.QU6f.HioI7h1tO4vdSIiEkorDvnaRg6	t
4	khawla	an	kh@gm.com	teacher	$2b$12$wGqEp4qXxFcX43ZTQR.iC.ZzW6B42Cx/iVmX.b3FgGQdRlnZh2mGC	t
5	f	f	ferdaweshaoualaa@gmail.com	supervisor	$2b$12$j8edwk0yGbI1wQevLHDj9.GPxCIS0RQOWIozU5F6J8AxWq.D6HAqG	t
6	sup	test	supervisor@test.com	supervisor	$2b$12$Imoa6KsGyhyvDVdueip6veE8XOrtubghBcpzoyzwXHvqmvQJOvuke	t
7	etudiant	ln	etud@gmail.com	student	$2b$12$yHIW6fF8yq2qFiRW1M3pQus0Rv792.Ssp9B6UT9Oa9e.3frdhQH5S	t
\.


--
-- Data for Name: week_items; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.week_items (id, week_id, "order", item_type, title, description, video_url, has_pre_quiz, has_post_quiz, pre_quiz_form_url, post_quiz_form_url) FROM stdin;
2	4	6	listening	الإنسان والطغيان (1)	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
3	4	5	reading	كتاب رحلة اكتشاف ما يقدمه لنا القرآن	قراءة تمهيدية للكتاب كاملاً	\N	f	f	\N	\N
4	5	1	lecture	محاضرة حول مفهوم اقرأ	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	https://docs.google.com/forms/d/e/1FAIpQLSfGWV3Zwe9689NAX9b2sbNW0GIK8nNa-oBDh5qMLHWzj-D9tg/viewform?usp=publish-editor	https://docs.google.com/forms/d/e/1FAIpQLSfGWV3Zwe9689NAX9b2sbNW0GIK8nNa-oBDh5qMLHWzj-D9tg/viewform?usp=publish-editor
5	5	2	lecture	مختارات من محاضرات الربوبية 2	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
6	5	3	lecture	مختارات من محاضرات الربوبية 3	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
7	5	4	lecture	محاضرات فعلًا (الحلقة 1 إلى 4)	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
8	5	5	lecture	محاضرات فعلًا (الحلقة 5 إلى 17)	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
9	5	6	reading	قراءة من كتاب رحلة اكتشاف	من صفحة 3 إلى 6، ثم من صفحة 110 إلى 145	\N	f	f	\N	\N
10	5	7	listening	الإنسان والطغيان (2)	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
11	5	8	reading	تفسير سورة الفاتحة وآية الكرسي	من التفسير الميسر وتفسير السعدي	\N	f	f	\N	\N
12	4	2	lecture	شرح دليل الدبلومة ونظام الدراسة	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
13	4	3	lecture	تدشين الدبلومة	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
14	4	4	mini_circle_exam	الدائرة الصغرى: شرح كتيب اكتشاف	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
16	6	1	lecture	ختمة محبة	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	https://docs.google.com/forms/d/e/1FAIpQLSfGWV3Zwe9689NAX9b2sbNW0GIK8nNa-oBDh5qMLHWzj-D9tg/viewform?usp=publish-editor	https://docs.google.com/forms/d/e/1FAIpQLSfGWV3Zwe9689NAX9b2sbNW0GIK8nNa-oBDh5qMLHWzj-D9tg/viewform?usp=publish-editor
17	6	2	lecture	حدثني عني (الحلقة 1 إلى 15)	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
18	6	3	reading	قراءة من كتاب رحلة اكتشاف	من صفحة 156 إلى 159، ثم من صفحة 179 إلى 183	\N	f	f	\N	\N
19	6	4	listening	الإنسان والطغيان (3)	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
20	6	5	reading	تفسير سورة الكافرون والفلق والناس	من التفسير الميسر وتفسير السعدي	\N	f	f	\N	\N
21	7	1	lecture	حدثني عني (الحلقة 16 إلى 30)	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	https://docs.google.com/forms/d/e/1FAIpQLSfGWV3Zwe9689NAX9b2sbNW0GIK8nNa-oBDh5qMLHWzj-D9tg/viewform?usp=publish-editor	https://docs.google.com/forms/d/e/1FAIpQLSfGWV3Zwe9689NAX9b2sbNW0GIK8nNa-oBDh5qMLHWzj-D9tg/viewform?usp=publish-editor
22	7	2	reading	قراءة من كتاب رحلة اكتشاف	من صفحة 199 إلى 211، ثم من صفحة 228 إلى 244	\N	f	f	\N	\N
23	7	3	reading	تفسير أواخر سورة البقرة	من التفسير الميسر وتفسير السعدي	\N	f	f	\N	\N
1	4	1	lecture	النوايا والبشريات	\N	https://www.youtube.com/watch?v=yrD7fa3AjAs	f	f	\N	\N
\.


--
-- Data for Name: weekly_plans; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.weekly_plans (id, student_id, course_id, week_start, is_active, expires_at, raw_text, created_at) FROM stdin;
\.


--
-- Data for Name: workshop_attendance; Type: TABLE DATA; Schema: public; Owner: dtms_user
--

COPY public.workshop_attendance (id, schedule_id, student_id, attended_at) FROM stdin;
\.


--
-- Name: answers_answer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.answers_answer_id_seq', 1, false);


--
-- Name: attendance_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.attendance_records_id_seq', 1, false);


--
-- Name: compensation_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.compensation_requests_id_seq', 1, false);


--
-- Name: content_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.content_id_seq', 1, false);


--
-- Name: course_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.course_notes_id_seq', 1, false);


--
-- Name: courses_course_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.courses_course_id_seq', 4, true);


--
-- Name: curriculum_attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.curriculum_attendance_id_seq', 1, false);


--
-- Name: curriculum_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.curriculum_sessions_id_seq', 1, false);


--
-- Name: enrollments_enrollment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.enrollments_enrollment_id_seq', 3, true);


--
-- Name: grade_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.grade_categories_id_seq', 1, false);


--
-- Name: grades_grade_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.grades_grade_id_seq', 1, false);


--
-- Name: invite_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.invite_tokens_id_seq', 4, true);


--
-- Name: program_catalog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.program_catalog_id_seq', 11, true);


--
-- Name: program_weeks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.program_weeks_id_seq', 7, true);


--
-- Name: questions_question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.questions_question_id_seq', 1, false);


--
-- Name: quiz_options_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.quiz_options_id_seq', 1, false);


--
-- Name: quiz_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.quiz_questions_id_seq', 1, false);


--
-- Name: recommendation_feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.recommendation_feedback_id_seq', 1, false);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 96, true);


--
-- Name: religious_content_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.religious_content_id_seq', 1, false);


--
-- Name: schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.schedules_id_seq', 1, false);


--
-- Name: sessions_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.sessions_session_id_seq', 1, false);


--
-- Name: status_change_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.status_change_log_id_seq', 1, true);


--
-- Name: student_item_progress_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.student_item_progress_id_seq', 15, true);


--
-- Name: students_student_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.students_student_id_seq', 2, true);


--
-- Name: submissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.submissions_id_seq', 1, false);


--
-- Name: task_progress_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.task_progress_id_seq', 1, false);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.tasks_id_seq', 1, false);


--
-- Name: telegram_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.telegram_groups_id_seq', 1, false);


--
-- Name: transcripts_transcript_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.transcripts_transcript_id_seq', 1, false);


--
-- Name: user_progress_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.user_progress_id_seq', 1, false);


--
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.users_user_id_seq', 7, true);


--
-- Name: week_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.week_items_id_seq', 23, true);


--
-- Name: weekly_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.weekly_plans_id_seq', 1, false);


--
-- Name: workshop_attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dtms_user
--

SELECT pg_catalog.setval('public.workshop_attendance_id_seq', 1, false);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: answers answers_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_pkey PRIMARY KEY (answer_id);


--
-- Name: apscheduler_jobs apscheduler_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.apscheduler_jobs
    ADD CONSTRAINT apscheduler_jobs_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: compensation_requests compensation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.compensation_requests
    ADD CONSTRAINT compensation_requests_pkey PRIMARY KEY (id);


--
-- Name: content content_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_pkey PRIMARY KEY (id);


--
-- Name: course_notes course_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.course_notes
    ADD CONSTRAINT course_notes_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (course_id);


--
-- Name: curriculum_attendance curriculum_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.curriculum_attendance
    ADD CONSTRAINT curriculum_attendance_pkey PRIMARY KEY (id);


--
-- Name: curriculum_sessions curriculum_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.curriculum_sessions
    ADD CONSTRAINT curriculum_sessions_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (enrollment_id);


--
-- Name: grade_categories grade_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.grade_categories
    ADD CONSTRAINT grade_categories_pkey PRIMARY KEY (id);


--
-- Name: grades grades_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_pkey PRIMARY KEY (grade_id);


--
-- Name: invite_tokens invite_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_pkey PRIMARY KEY (id);


--
-- Name: program_catalog program_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.program_catalog
    ADD CONSTRAINT program_catalog_name_key UNIQUE (name);


--
-- Name: program_catalog program_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.program_catalog
    ADD CONSTRAINT program_catalog_pkey PRIMARY KEY (id);


--
-- Name: program_weeks program_weeks_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.program_weeks
    ADD CONSTRAINT program_weeks_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (question_id);


--
-- Name: quiz_options quiz_options_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.quiz_options
    ADD CONSTRAINT quiz_options_pkey PRIMARY KEY (id);


--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);


--
-- Name: recommendation_feedback recommendation_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.recommendation_feedback
    ADD CONSTRAINT recommendation_feedback_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: religious_content religious_content_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.religious_content
    ADD CONSTRAINT religious_content_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (session_id);


--
-- Name: staged_imports staged_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.staged_imports
    ADD CONSTRAINT staged_imports_pkey PRIMARY KEY (id);


--
-- Name: status_change_log status_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.status_change_log
    ADD CONSTRAINT status_change_log_pkey PRIMARY KEY (id);


--
-- Name: student_item_progress student_item_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.student_item_progress
    ADD CONSTRAINT student_item_progress_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (student_id);


--
-- Name: students students_student_number_key; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_number_key UNIQUE (student_number);


--
-- Name: students students_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_telegram_id_key UNIQUE (telegram_id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: task_progress task_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.task_progress
    ADD CONSTRAINT task_progress_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: telegram_groups telegram_groups_course_id_key; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.telegram_groups
    ADD CONSTRAINT telegram_groups_course_id_key UNIQUE (course_id);


--
-- Name: telegram_groups telegram_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.telegram_groups
    ADD CONSTRAINT telegram_groups_pkey PRIMARY KEY (id);


--
-- Name: telegram_groups telegram_groups_telegram_group_id_key; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.telegram_groups
    ADD CONSTRAINT telegram_groups_telegram_group_id_key UNIQUE (telegram_group_id);


--
-- Name: transcripts transcripts_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.transcripts
    ADD CONSTRAINT transcripts_pkey PRIMARY KEY (transcript_id);


--
-- Name: attendance_records uq_attendance_enrollment_date; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT uq_attendance_enrollment_date UNIQUE (enrollment_id, session_date);


--
-- Name: content uq_content_course_type_order; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT uq_content_course_type_order UNIQUE (course_id, content_type, content_order);


--
-- Name: curriculum_attendance uq_cur_att_enr_session; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.curriculum_attendance
    ADD CONSTRAINT uq_cur_att_enr_session UNIQUE (enrollment_id, curriculum_session_id);


--
-- Name: enrollments uq_enrollment_student_course; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT uq_enrollment_student_course UNIQUE (student_id, course_id);


--
-- Name: grade_categories uq_grade_categories_course_name; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.grade_categories
    ADD CONSTRAINT uq_grade_categories_course_name UNIQUE (course_id, name);


--
-- Name: program_weeks uq_program_weeks_course_week; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.program_weeks
    ADD CONSTRAINT uq_program_weeks_course_week UNIQUE (course_id, week_number);


--
-- Name: student_item_progress uq_student_item_progress_enrollment_item; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.student_item_progress
    ADD CONSTRAINT uq_student_item_progress_enrollment_item UNIQUE (enrollment_id, item_id);


--
-- Name: students uq_students_user_id; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT uq_students_user_id UNIQUE (user_id);


--
-- Name: user_progress uq_user_progress_student_content; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT uq_user_progress_student_content UNIQUE (student_id, content_id);


--
-- Name: weekly_plans uq_weekly_plans_student_course_week; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT uq_weekly_plans_student_course_week UNIQUE (student_id, course_id, week_start);


--
-- Name: workshop_attendance uq_workshop_attendance_schedule_student; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.workshop_attendance
    ADD CONSTRAINT uq_workshop_attendance_schedule_student UNIQUE (schedule_id, student_id);


--
-- Name: user_progress user_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: week_items week_items_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.week_items
    ADD CONSTRAINT week_items_pkey PRIMARY KEY (id);


--
-- Name: weekly_plans weekly_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_pkey PRIMARY KEY (id);


--
-- Name: workshop_attendance workshop_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.workshop_attendance
    ADD CONSTRAINT workshop_attendance_pkey PRIMARY KEY (id);


--
-- Name: idx_answers_question; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_answers_question ON public.answers USING btree (question_id);


--
-- Name: idx_comp_requests_course; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_comp_requests_course ON public.compensation_requests USING btree (course_id);


--
-- Name: idx_comp_requests_status; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_comp_requests_status ON public.compensation_requests USING btree (status);


--
-- Name: idx_comp_requests_student; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_comp_requests_student ON public.compensation_requests USING btree (student_id);


--
-- Name: idx_comp_requests_telegram_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_comp_requests_telegram_id ON public.compensation_requests USING btree (telegram_id);


--
-- Name: idx_content_course_type; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_content_course_type ON public.content USING btree (course_id, content_type);


--
-- Name: idx_program_weeks_course; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_program_weeks_course ON public.program_weeks USING btree (course_id);


--
-- Name: idx_questions_course; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_questions_course ON public.questions USING btree (course_id);


--
-- Name: idx_questions_student; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_questions_student ON public.questions USING btree (student_id);


--
-- Name: idx_quiz_options_question; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_quiz_options_question ON public.quiz_options USING btree (question_id);


--
-- Name: idx_quiz_questions_item; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_quiz_questions_item ON public.quiz_questions USING btree (item_id, phase);


--
-- Name: idx_rec_feedback_created; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_rec_feedback_created ON public.recommendation_feedback USING btree (created_at);


--
-- Name: idx_rec_feedback_student_course; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_rec_feedback_student_course ON public.recommendation_feedback USING btree (student_id, course_id);


--
-- Name: idx_schedules_course; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_schedules_course ON public.schedules USING btree (course_id);


--
-- Name: idx_student_item_progress_enrollment; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_student_item_progress_enrollment ON public.student_item_progress USING btree (enrollment_id);


--
-- Name: idx_students_telegram_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_students_telegram_id ON public.students USING btree (telegram_id);


--
-- Name: idx_submissions_course; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_submissions_course ON public.submissions USING btree (course_id);


--
-- Name: idx_submissions_student; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_submissions_student ON public.submissions USING btree (student_id);


--
-- Name: idx_task_progress_student_task; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_task_progress_student_task ON public.task_progress USING btree (student_id, task_id);


--
-- Name: idx_tasks_plan; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_tasks_plan ON public.tasks USING btree (plan_id);


--
-- Name: idx_tasks_student_day; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_tasks_student_day ON public.tasks USING btree (student_id, day, status);


--
-- Name: idx_telegram_groups_course; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_telegram_groups_course ON public.telegram_groups USING btree (course_id);


--
-- Name: idx_transcripts_content; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_transcripts_content ON public.transcripts USING btree (content_id);


--
-- Name: idx_transcripts_course; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_transcripts_course ON public.transcripts USING btree (course_id);


--
-- Name: idx_user_progress_student; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_user_progress_student ON public.user_progress USING btree (student_id);


--
-- Name: idx_week_items_week_order; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_week_items_week_order ON public.week_items USING btree (week_id, "order");


--
-- Name: idx_weekly_plans_active; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_weekly_plans_active ON public.weekly_plans USING btree (student_id, is_active);


--
-- Name: idx_weekly_plans_student_course; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX idx_weekly_plans_student_course ON public.weekly_plans USING btree (student_id, course_id);


--
-- Name: ix_apscheduler_jobs_next_run_time; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_apscheduler_jobs_next_run_time ON public.apscheduler_jobs USING btree (next_run_time);


--
-- Name: ix_attendance_enrollment_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_attendance_enrollment_id ON public.attendance_records USING btree (enrollment_id);


--
-- Name: ix_attendance_records_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_attendance_records_id ON public.attendance_records USING btree (id);


--
-- Name: ix_attendance_session_date; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_attendance_session_date ON public.attendance_records USING btree (session_date);


--
-- Name: ix_course_notes_author_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_course_notes_author_id ON public.course_notes USING btree (author_id);


--
-- Name: ix_course_notes_course_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_course_notes_course_id ON public.course_notes USING btree (course_id);


--
-- Name: ix_course_notes_parent_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_course_notes_parent_id ON public.course_notes USING btree (parent_id);


--
-- Name: ix_courses_course_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_courses_course_id ON public.courses USING btree (course_id);


--
-- Name: ix_curriculum_attendance_curriculum_session_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_curriculum_attendance_curriculum_session_id ON public.curriculum_attendance USING btree (curriculum_session_id);


--
-- Name: ix_curriculum_attendance_enrollment_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_curriculum_attendance_enrollment_id ON public.curriculum_attendance USING btree (enrollment_id);


--
-- Name: ix_curriculum_attendance_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_curriculum_attendance_id ON public.curriculum_attendance USING btree (id);


--
-- Name: ix_curriculum_sessions_course_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_curriculum_sessions_course_id ON public.curriculum_sessions USING btree (course_id);


--
-- Name: ix_curriculum_sessions_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_curriculum_sessions_id ON public.curriculum_sessions USING btree (id);


--
-- Name: ix_enrollments_course_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_enrollments_course_id ON public.enrollments USING btree (course_id);


--
-- Name: ix_enrollments_enrollment_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_enrollments_enrollment_id ON public.enrollments USING btree (enrollment_id);


--
-- Name: ix_enrollments_student_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_enrollments_student_id ON public.enrollments USING btree (student_id);


--
-- Name: ix_grade_categories_course_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_grade_categories_course_id ON public.grade_categories USING btree (course_id);


--
-- Name: ix_grade_categories_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_grade_categories_id ON public.grade_categories USING btree (id);


--
-- Name: ix_grades_category_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_grades_category_id ON public.grades USING btree (category_id);


--
-- Name: ix_grades_enrollment_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_grades_enrollment_id ON public.grades USING btree (enrollment_id);


--
-- Name: ix_grades_grade_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_grades_grade_id ON public.grades USING btree (grade_id);


--
-- Name: ix_invite_tokens_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_invite_tokens_id ON public.invite_tokens USING btree (id);


--
-- Name: ix_invite_tokens_token; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE UNIQUE INDEX ix_invite_tokens_token ON public.invite_tokens USING btree (token);


--
-- Name: ix_refresh_tokens_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_refresh_tokens_id ON public.refresh_tokens USING btree (id);


--
-- Name: ix_refresh_tokens_jti; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE UNIQUE INDEX ix_refresh_tokens_jti ON public.refresh_tokens USING btree (jti);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: ix_sessions_session_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_sessions_session_id ON public.sessions USING btree (session_id);


--
-- Name: ix_status_change_log_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_status_change_log_id ON public.status_change_log USING btree (id);


--
-- Name: ix_students_student_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_students_student_id ON public.students USING btree (student_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_user_id; Type: INDEX; Schema: public; Owner: dtms_user
--

CREATE INDEX ix_users_user_id ON public.users USING btree (user_id);


--
-- Name: answers answers_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: answers answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(question_id) ON DELETE CASCADE;


--
-- Name: answers answers_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: answers answers_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON DELETE CASCADE;


--
-- Name: compensation_requests compensation_requests_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.compensation_requests
    ADD CONSTRAINT compensation_requests_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE SET NULL;


--
-- Name: compensation_requests compensation_requests_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.compensation_requests
    ADD CONSTRAINT compensation_requests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: compensation_requests compensation_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.compensation_requests
    ADD CONSTRAINT compensation_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: compensation_requests compensation_requests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.compensation_requests
    ADD CONSTRAINT compensation_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: content content_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: course_notes course_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.course_notes
    ADD CONSTRAINT course_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: course_notes course_notes_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.course_notes
    ADD CONSTRAINT course_notes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: course_notes course_notes_curriculum_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.course_notes
    ADD CONSTRAINT course_notes_curriculum_session_id_fkey FOREIGN KEY (curriculum_session_id) REFERENCES public.curriculum_sessions(id) ON DELETE SET NULL;


--
-- Name: course_notes course_notes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.course_notes
    ADD CONSTRAINT course_notes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.course_notes(id) ON DELETE CASCADE;


--
-- Name: courses courses_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(user_id);


--
-- Name: courses courses_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(user_id);


--
-- Name: curriculum_attendance curriculum_attendance_curriculum_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.curriculum_attendance
    ADD CONSTRAINT curriculum_attendance_curriculum_session_id_fkey FOREIGN KEY (curriculum_session_id) REFERENCES public.curriculum_sessions(id) ON DELETE CASCADE;


--
-- Name: curriculum_attendance curriculum_attendance_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.curriculum_attendance
    ADD CONSTRAINT curriculum_attendance_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON DELETE CASCADE;


--
-- Name: curriculum_sessions curriculum_sessions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.curriculum_sessions
    ADD CONSTRAINT curriculum_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id);


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id);


--
-- Name: students fk_students_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_students_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: grade_categories grade_categories_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.grade_categories
    ADD CONSTRAINT grade_categories_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: grades grades_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.grade_categories(id) ON DELETE SET NULL;


--
-- Name: grades grades_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id);


--
-- Name: invite_tokens invite_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: program_weeks program_weeks_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.program_weeks
    ADD CONSTRAINT program_weeks_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: questions questions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: questions questions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: quiz_options quiz_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.quiz_options
    ADD CONSTRAINT quiz_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE;


--
-- Name: quiz_questions quiz_questions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.week_items(id) ON DELETE CASCADE;


--
-- Name: recommendation_feedback recommendation_feedback_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.recommendation_feedback
    ADD CONSTRAINT recommendation_feedback_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE CASCADE;


--
-- Name: recommendation_feedback recommendation_feedback_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.recommendation_feedback
    ADD CONSTRAINT recommendation_feedback_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: recommendation_feedback recommendation_feedback_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.recommendation_feedback
    ADD CONSTRAINT recommendation_feedback_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: schedules schedules_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE SET NULL;


--
-- Name: schedules schedules_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: sessions sessions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id);


--
-- Name: sessions sessions_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(user_id);


--
-- Name: status_change_log status_change_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.status_change_log
    ADD CONSTRAINT status_change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: status_change_log status_change_log_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.status_change_log
    ADD CONSTRAINT status_change_log_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON DELETE CASCADE;


--
-- Name: student_item_progress student_item_progress_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.student_item_progress
    ADD CONSTRAINT student_item_progress_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON DELETE CASCADE;


--
-- Name: student_item_progress student_item_progress_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.student_item_progress
    ADD CONSTRAINT student_item_progress_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.week_items(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE SET NULL;


--
-- Name: submissions submissions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: submissions submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: task_progress task_progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.task_progress
    ADD CONSTRAINT task_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: task_progress task_progress_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.task_progress
    ADD CONSTRAINT task_progress_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: tasks tasks_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.weekly_plans(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: telegram_groups telegram_groups_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.telegram_groups
    ADD CONSTRAINT telegram_groups_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: transcripts transcripts_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.transcripts
    ADD CONSTRAINT transcripts_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE CASCADE;


--
-- Name: transcripts transcripts_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.transcripts
    ADD CONSTRAINT transcripts_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: user_progress user_progress_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE CASCADE;


--
-- Name: user_progress user_progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: week_items week_items_week_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.week_items
    ADD CONSTRAINT week_items_week_id_fkey FOREIGN KEY (week_id) REFERENCES public.program_weeks(id) ON DELETE CASCADE;


--
-- Name: weekly_plans weekly_plans_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: weekly_plans weekly_plans_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: workshop_attendance workshop_attendance_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.workshop_attendance
    ADD CONSTRAINT workshop_attendance_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE;


--
-- Name: workshop_attendance workshop_attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: dtms_user
--

ALTER TABLE ONLY public.workshop_attendance
    ADD CONSTRAINT workshop_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 2iP0LHuyLo9hGih8SrWbThKE4yh3xTmNFrYYbfwJ3ZuQsgFu5ALNTfHN3Ia4gVE

