--
-- PostgreSQL database dump
--

\restrict rNBK8As2ybNMJgDm6fq8LSnV2N0mDqNhFnUQnVeOjiv63nefgYbEKLuuQ8BEDA4

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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
-- Name: addon_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addon_logs (
    id integer NOT NULL,
    customer_id integer,
    customer_email character varying(255) NOT NULL,
    subscription_id character varying(255) NOT NULL,
    chargebee_customer_id character varying(255),
    action character varying(20) NOT NULL,
    addon_family character varying(50) NOT NULL,
    addon_item_price_id character varying(255) NOT NULL,
    addon_name character varying(255),
    addon_price integer,
    invoice_id character varying(255),
    status character varying(50) DEFAULT 'completed'::character varying,
    error_message text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: addon_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.addon_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: addon_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.addon_logs_id_seq OWNED BY public.addon_logs.id;


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(255),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: admin_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_users_id_seq OWNED BY public.admin_users.id;


--
-- Name: cancellation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cancellation_requests (
    id integer NOT NULL,
    customer_id integer,
    customer_email character varying(255) NOT NULL,
    subscription_id character varying(255) NOT NULL,
    subscription_status character varying(50),
    current_price integer,
    cancellation_reason character varying(100),
    reason_details text,
    target_price integer,
    retention_offer_shown character varying(255),
    retention_offer_accepted boolean,
    troubleshooting_offered boolean,
    troubleshooting_accepted boolean,
    preferred_contact_method character varying(20),
    preferred_phone character varying(20),
    preferred_call_time character varying(100),
    zendesk_ticket_id character varying(100),
    slack_message_ts character varying(100),
    status character varying(50) DEFAULT 'started'::character varying,
    flow_step character varying(50) DEFAULT 'reason_selection'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone,
    discount_applied_at timestamp without time zone,
    discount_eligible boolean,
    additional_notes text,
    due_invoice_count integer
);


--
-- Name: cancellation_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cancellation_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cancellation_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cancellation_requests_id_seq OWNED BY public.cancellation_requests.id;


--
-- Name: customer_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_feedback (
    id integer NOT NULL,
    customer_id integer,
    customer_email character varying(255) NOT NULL,
    feedback_type character varying(50) NOT NULL,
    message text NOT NULL,
    rating integer,
    created_at timestamp without time zone DEFAULT now(),
    admin_response text,
    responded_at timestamp without time zone,
    responded_by character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying
);


--
-- Name: customer_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_feedback_id_seq OWNED BY public.customer_feedback.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    password_hash text,
    chargebee_customer_id character varying(255),
    is_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,
    email_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    last_login_at timestamp without time zone,
    login_count integer DEFAULT 0,
    full_name character varying(255)
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: escalation_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escalation_tickets (
    id integer NOT NULL,
    ticket_id character varying(50) NOT NULL,
    customer_id integer,
    customer_email character varying(255) NOT NULL,
    subscription_id character varying(255),
    iccid character varying(50),
    imei character varying(50),
    issue_type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    resolved_at timestamp without time zone,
    notification_email character varying(255)
);


--
-- Name: escalation_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.escalation_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: escalation_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.escalation_tickets_id_seq OWNED BY public.escalation_tickets.id;


--
-- Name: external_api_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_api_logs (
    id integer NOT NULL,
    service character varying(50) NOT NULL,
    endpoint character varying(500) NOT NULL,
    method character varying(10) NOT NULL,
    status_code integer,
    duration_ms integer,
    success boolean DEFAULT true,
    error_message text,
    customer_email character varying(255),
    triggered_by character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: external_api_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.external_api_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: external_api_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.external_api_logs_id_seq OWNED BY public.external_api_logs.id;


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_codes (
    id integer NOT NULL,
    customer_id integer,
    code character varying(6) NOT NULL,
    type character varying(20) NOT NULL,
    target character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: otp_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otp_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otp_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otp_codes_id_seq OWNED BY public.otp_codes.id;


--
-- Name: plan_change_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_change_verifications (
    id integer NOT NULL,
    customer_id integer,
    customer_email character varying(255) NOT NULL,
    subscription_id character varying(255) NOT NULL,
    chargebee_customer_id character varying(255),
    mdn character varying(20),
    iccid character varying(50),
    current_plan_id character varying(255) NOT NULL,
    current_plan_name character varying(255),
    current_price integer,
    requested_plan_id character varying(255) NOT NULL,
    requested_plan_name character varying(255),
    requested_price integer,
    thingspace_plan_code character varying(100),
    chargebee_updated boolean DEFAULT false,
    chargebee_next_billing_date timestamp without time zone,
    thingspace_requested boolean DEFAULT false,
    thingspace_request_id character varying(100),
    verification_scheduled_at timestamp without time zone,
    verification_completed_at timestamp without time zone,
    verification_status character varying(50) DEFAULT 'pending'::character varying,
    verification_error text,
    slack_notification_sent boolean DEFAULT false,
    status character varying(50) DEFAULT 'processing'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: plan_change_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plan_change_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plan_change_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plan_change_verifications_id_seq OWNED BY public.plan_change_verifications.id;


--
-- Name: portal_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    description character varying(255),
    updated_at timestamp without time zone DEFAULT now(),
    updated_by character varying(255)
);


--
-- Name: portal_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.portal_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portal_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.portal_settings_id_seq OWNED BY public.portal_settings.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    user_agent text,
    ip_address character varying(45)
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: slow_speed_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slow_speed_sessions (
    id integer NOT NULL,
    customer_id integer,
    customer_email character varying(255) NOT NULL,
    subscription_id character varying(255) NOT NULL,
    iccid character varying(50),
    imei character varying(50),
    mdn character varying(20),
    issue_onset character varying(50),
    modem_moved boolean,
    refresh_performed boolean DEFAULT false,
    refresh_started_at timestamp without time zone,
    refresh_completed_at timestamp without time zone,
    sync_expires_at timestamp without time zone,
    session_state character varying(50) DEFAULT 'started'::character varying,
    outdoor_test_result character varying(50),
    speeds_improved boolean,
    escalated boolean DEFAULT false,
    escalation_ticket_id character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: slow_speed_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.slow_speed_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: slow_speed_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.slow_speed_sessions_id_seq OWNED BY public.slow_speed_sessions.id;


--
-- Name: subscription_pauses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_pauses (
    id integer NOT NULL,
    customer_id integer,
    customer_email character varying(255) NOT NULL,
    subscription_id character varying(255) NOT NULL,
    chargebee_customer_id character varying(255),
    pause_duration_months integer NOT NULL,
    pause_date timestamp without time zone NOT NULL,
    resume_date timestamp without time zone NOT NULL,
    travel_addon_added boolean DEFAULT false,
    travel_addon_item_price_id character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    pause_reason character varying(100),
    pause_reason_details text
);


--
-- Name: subscription_pauses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_pauses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_pauses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_pauses_id_seq OWNED BY public.subscription_pauses.id;


--
-- Name: addon_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_logs ALTER COLUMN id SET DEFAULT nextval('public.addon_logs_id_seq'::regclass);


--
-- Name: admin_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users ALTER COLUMN id SET DEFAULT nextval('public.admin_users_id_seq'::regclass);


--
-- Name: cancellation_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests ALTER COLUMN id SET DEFAULT nextval('public.cancellation_requests_id_seq'::regclass);


--
-- Name: customer_feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_feedback ALTER COLUMN id SET DEFAULT nextval('public.customer_feedback_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: escalation_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_tickets ALTER COLUMN id SET DEFAULT nextval('public.escalation_tickets_id_seq'::regclass);


--
-- Name: external_api_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_api_logs ALTER COLUMN id SET DEFAULT nextval('public.external_api_logs_id_seq'::regclass);


--
-- Name: otp_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes ALTER COLUMN id SET DEFAULT nextval('public.otp_codes_id_seq'::regclass);


--
-- Name: plan_change_verifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_change_verifications ALTER COLUMN id SET DEFAULT nextval('public.plan_change_verifications_id_seq'::regclass);


--
-- Name: portal_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_settings ALTER COLUMN id SET DEFAULT nextval('public.portal_settings_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: slow_speed_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slow_speed_sessions ALTER COLUMN id SET DEFAULT nextval('public.slow_speed_sessions_id_seq'::regclass);


--
-- Name: subscription_pauses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pauses ALTER COLUMN id SET DEFAULT nextval('public.subscription_pauses_id_seq'::regclass);


--
-- Data for Name: addon_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.addon_logs (id, customer_id, customer_email, subscription_id, chargebee_customer_id, action, addon_family, addon_item_price_id, addon_name, addon_price, invoice_id, status, error_message, created_at) FROM stdin;
\.


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_users (id, email, password, name, created_at) FROM stdin;
1	bryan@nomadinternet.com	$2b$10$ZYEkyTpfotFgh.U7csSl7O3Q4I5xT9gT7TI8FdtsJjV4gZn5WKna6	Bryan	2026-02-04 01:29:29.576375
\.


--
-- Data for Name: cancellation_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cancellation_requests (id, customer_id, customer_email, subscription_id, subscription_status, current_price, cancellation_reason, reason_details, target_price, retention_offer_shown, retention_offer_accepted, troubleshooting_offered, troubleshooting_accepted, preferred_contact_method, preferred_phone, preferred_call_time, zendesk_ticket_id, slack_message_ts, status, flow_step, created_at, updated_at, completed_at, discount_applied_at, discount_eligible, additional_notes, due_invoice_count) FROM stdin;
2	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-04 18:32:22.803973	2026-02-04 18:32:22.803973	\N	\N	\N	\N	\N
1	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	slow_speeds	\N	\N	\N	\N	t	t	\N	\N	\N	\N	\N	started	troubleshooting_redirect	2026-02-04 18:32:22.793171	2026-02-04 18:32:43.438	\N	\N	\N	\N	\N
3	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-04 18:33:06.992048	2026-02-04 18:33:06.992048	\N	\N	\N	\N	\N
4	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	too_expensive	\N	99	{"type":"percentage_discount","description":"20% off for the next 2 months","discountAmount":2399,"newPrice":9596,"duration":"2 months"}	f	\N	\N	\N	\N	\N	\N	\N	started	contact_preference	2026-02-04 18:33:06.993573	2026-02-04 18:33:39.753	\N	\N	\N	\N	\N
5	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-04 18:40:23.502743	2026-02-04 18:40:23.502743	\N	\N	\N	\N	\N
6	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	no_longer_needed	\N	\N	\N	\N	\N	\N	phone	+12138145643	morning	18983	1770230472.563629	pending_callback	completed	2026-02-04 18:40:23.504665	2026-02-04 18:41:12.685	2026-02-04 18:41:12.685	\N	\N	\N	\N
7	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-04 18:43:05.196078	2026-02-04 18:43:05.196078	\N	\N	\N	\N	\N
8	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	too_expensive	\N	10	{"type":"percentage_discount","description":"20% off for the next 2 months","discountAmount":2399,"newPrice":9596,"duration":"2 months"}	t	\N	\N	\N	\N	\N	\N	\N	retained	completed	2026-02-04 18:43:05.199165	2026-02-04 18:54:21.54	2026-02-04 18:54:21.54	\N	\N	\N	\N
9	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-04 19:41:11.809053	2026-02-04 19:41:11.809053	\N	\N	\N	\N	\N
10	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	slow_speeds	\N	\N	\N	\N	t	t	\N	\N	\N	\N	\N	started	troubleshooting_redirect	2026-02-04 19:41:11.810155	2026-02-04 19:41:22.322	\N	\N	t	\N	\N
11	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-04 19:41:36.891442	2026-02-04 19:41:36.891442	\N	\N	\N	\N	\N
12	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	11995	moving	\N	\N	\N	\N	\N	\N	email	\N	\N	18988	1770234117.444149	pending_callback	completed	2026-02-04 19:41:36.892489	2026-02-04 19:41:57.567	2026-02-04 19:41:57.567	\N	t	\N	\N
13	\N	jam107636@gmail.com	AzqSzoV8IB7rV2w7B	active	14995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-05 20:20:48.726587	2026-02-05 20:20:48.726587	\N	\N	\N	\N	0
14	\N	jam107636@gmail.com	AzqSzoV8IB7rV2w7B	active	14995	other	This is a duplicate subscription	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	retention_offer	2026-02-05 20:20:48.72813	2026-02-05 20:22:05.912	\N	\N	t	\N	0
16	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	12995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-11 23:29:59.314076	2026-02-11 23:29:59.314076	\N	\N	\N	\N	0
15	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	12995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-11 23:29:59.32347	2026-02-11 23:29:59.32347	\N	\N	\N	\N	0
17	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	12995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-11 23:45:22.257437	2026-02-11 23:45:22.257437	\N	\N	\N	\N	0
18	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	active	12995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	started	reason_selection	2026-02-11 23:45:22.283025	2026-02-11 23:45:22.283025	\N	\N	\N	\N	0
\.


--
-- Data for Name: customer_feedback; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customer_feedback (id, customer_id, customer_email, feedback_type, message, rating, created_at, admin_response, responded_at, responded_by, status) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, email, phone, password_hash, chargebee_customer_id, is_verified, phone_verified, email_verified, created_at, updated_at, last_login_at, login_count, full_name) FROM stdin;
1	emailforallworks0@gmaill.com	\N	\N	\N	f	f	f	2026-01-24 03:28:57.143796	2026-01-24 03:28:57.143796	\N	0	\N
4	evolsaur12@gmail.com	+19518472178	$2b$10$pbKaa0U6/6rPpxDJ4xr0DOEzzKJdy8WjqvFeeuw.Gjf5A9NK/kQMq	AzqcxXV9YjwR3B9J	t	t	t	2026-01-28 06:59:21.299886	2026-01-28 07:00:11.106	2026-01-29 14:04:39.758	3	Darien Routt
7	stickitkid00@gmail.com	+18432863133	$2b$10$51xr5NV/DO2YjVq6r40W3.I/.ffSvSmCAxw7Nmnm7LqcaW8.Nu.WC	16CW6CV7OTovt5TF	t	t	t	2026-01-28 10:09:50.653489	2026-01-28 10:10:40.23	2026-01-29 14:39:15.728	5	Brandon Boonie
8	bryan@nomadinternet.com	\N	\N	32845	f	f	f	2026-01-29 14:54:21.472193	2026-01-29 14:54:21.472193	\N	0	\N
5	kindrick.mckenzie2@gmail.com	+12513590185	$2b$10$u722Z7lSwghW.Wk5l2orM.Hp4esDtn2.EwIJHF6PQtjy0hd3xKMDu	AzZNv5UxA86jq2Seu	t	t	t	2026-01-28 07:10:45.172188	2026-01-28 07:13:14.959	2026-01-29 15:26:57.379	7	Kindrick McKenzie
3	char.west@yahoo.com	+12565566105	$2b$10$PvBZZyZPk2Cway8q5gU3nuArofqe/6lAXj76z/INQC83U7ePGvury	\N	t	t	t	2026-01-28 06:50:53.965113	2026-01-28 06:56:46.493	2026-01-28 06:56:46.533	1	Charlotte West
9	jeremiahigbinedion2@gmail.com	+15122999278	$2b$10$0uNpVsdpXv65RJ1gis/AFO/Hg8.JJWkEgaHrUa/v/XgYC1BJoluRq	6olRqV9i60T61vU	t	t	t	2026-01-29 18:00:28.366752	2026-01-29 18:04:41.044	2026-01-29 18:04:41.049	1	Jeremiah
2	emailforallworks0@gmail.com	+15122999278	$2b$10$40QfPBrRKGNQS5APT.rCaOm3B0b8WfL8oTIq04XqRKUXDoPmZvmrO	30183	t	t	t	2026-01-24 03:29:18.109246	2026-01-24 06:39:47.054	2026-02-11 22:30:54.196	42	Bryan Fury
6	asbell.jenifer@gmail.com	+18143599739	$2b$10$.dbE2r1W0GL6tfKtWTiOgejU1JlxwNRRcKRiXfMwzXevUM3deG.Wi	72241	t	t	t	2026-01-28 07:54:53.806388	2026-01-28 07:55:54.48	2026-01-28 08:17:47.782	2	Jenifer Asbell
\.


--
-- Data for Name: escalation_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.escalation_tickets (id, ticket_id, customer_id, customer_email, subscription_id, iccid, imei, issue_type, status, created_at, resolved_at, notification_email) FROM stdin;
\.


--
-- Data for Name: external_api_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.external_api_logs (id, service, endpoint, method, status_code, duration_ms, success, error_message, customer_email, triggered_by, created_at) FROM stdin;
1	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	448	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:41.595861
2	chargebee	/api/v2/customers?email=***&limit=100	GET	200	968	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:42.09534
3	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	453	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:42.550261
4	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	688	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:42.790589
5	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	715	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:42.815637
6	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	764	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:42.865852
7	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	780	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:42.878278
8	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	242	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:43.127482
9	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	245	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:43.136991
10	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	256	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:43.139909
11	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	273	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:43.156603
12	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	297	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:43.179656
13	shipstation	/orders?orderNumber=12138174203	GET	200	1002	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:44.183061
14	thingspace	/api/ts/v1/oauth2/token	POST	200	1050	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:45.23638
15	thingspace	/api/m2m/v1/session/login	POST	200	462	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:45.698768
16	thingspace	/api/m2m/v1/devices/actions/list	POST	400	374	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:46.075653
17	chargebee	/api/v2/customers?email=***&limit=100	GET	200	274	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:46.437066
18	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	423	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:46.586635
19	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	236	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:46.677353
20	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	277	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:46.716163
21	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	312	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:46.751084
22	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	316	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:46.755942
23	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	454	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:46.893225
24	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	239	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:47.136982
25	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	241	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:47.137957
26	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	250	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:47.147459
27	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	272	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:47.169566
28	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	275	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:47.17206
29	shipstation	/orders?orderNumber=12138174203	GET	200	317	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:47.489522
30	thingspace	/api/ts/v1/oauth2/token	POST	200	413	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:47.903469
31	thingspace	/api/m2m/v1/session/login	POST	200	359	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:48.263128
32	thingspace	/api/m2m/v1/devices/actions/list	POST	400	491	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 14:37:48.755434
33	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	427	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:28.153519
34	chargebee	/api/v2/customers?email=***&limit=100	GET	200	946	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:28.670964
35	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	321	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:28.99397
36	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	679	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:29.354218
37	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	713	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:29.385913
38	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	749	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:29.423053
39	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	791	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:29.472316
40	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	234	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:29.701554
41	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	240	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:29.70855
42	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	246	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:29.712139
43	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	274	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:29.740198
44	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	369	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:29.834902
45	shipstation	/orders?orderNumber=12138174203	GET	200	1049	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:30.885056
46	thingspace	/api/ts/v1/oauth2/token	POST	200	481	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:31.36676
47	thingspace	/api/m2m/v1/session/login	POST	200	476	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:31.842879
48	thingspace	/api/m2m/v1/devices/actions/list	POST	400	408	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:32.252673
49	chargebee	/api/v2/customers?email=***&limit=100	GET	200	267	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:32.652538
50	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	451	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:32.83742
51	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	234	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:32.88984
52	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	264	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:32.917881
53	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	316	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:32.970518
54	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	317	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:32.971557
55	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	319	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:32.983141
56	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	237	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:33.215543
57	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	247	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:33.223822
58	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	256	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:33.233019
59	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	277	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:33.253965
60	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	280	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:33.256874
61	shipstation	/orders?orderNumber=12138174203	GET	200	356	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:33.613351
62	thingspace	/api/ts/v1/oauth2/token	POST	200	409	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:34.02321
63	thingspace	/api/m2m/v1/session/login	POST	200	342	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:34.366146
64	thingspace	/api/m2m/v1/devices/actions/list	POST	400	376	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:57:34.744001
65	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	773	t	\N	\N	\N	2026-02-12 16:57:45.304068
66	chargebee	/api/v2/customers/30183	GET	200	285	t	\N	\N	\N	2026-02-12 16:57:45.582695
67	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	767	t	\N	\N	\N	2026-02-12 16:57:46.350876
68	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	296	t	\N	\N	\N	2026-02-12 16:57:46.736579
69	chargebee	/api/v2/customers/30183	GET	200	260	t	\N	\N	\N	2026-02-12 16:57:46.998274
70	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	305	t	\N	\N	\N	2026-02-12 16:57:47.30439
71	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	759	t	\N	\N	\N	2026-02-12 16:58:01.008893
72	chargebee	/api/v2/customers/30183	GET	200	260	t	\N	\N	\N	2026-02-12 16:58:01.260074
73	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	729	t	\N	\N	\N	2026-02-12 16:58:01.991069
74	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	305	t	\N	\N	\N	2026-02-12 16:58:02.469259
75	chargebee	/api/v2/customers/30183	GET	200	282	t	\N	\N	\N	2026-02-12 16:58:02.75226
76	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	318	t	\N	\N	\N	2026-02-12 16:58:03.071792
77	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	348	t	\N	\N	\N	2026-02-12 16:58:06.112513
78	chargebee	/api/v2/customers/30183	GET	200	261	t	\N	\N	\N	2026-02-12 16:58:06.374659
79	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0	GET	200	336	t	\N	\N	\N	2026-02-12 16:58:06.713668
80	chargebee	/api/v2/subscriptions/AzydUnV8Uf1Wa3vw0/update_for_items	POST	200	833	t	\N	\N	\N	2026-02-12 16:58:07.548157
81	chargebee	/api/v2/comments	POST	200	261	t	\N	\N	\N	2026-02-12 16:58:07.811361
82	chargebee	/api/v2/customers?email=***&limit=100	GET	200	269	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:09.905351
83	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	423	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:10.06024
84	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	300	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:10.208555
85	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	682	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:10.593913
86	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	708	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:10.617773
87	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	753	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:10.664292
88	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	867	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:10.77535
89	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	236	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:11.01928
90	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	243	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:11.025571
91	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	244	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:11.036458
92	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	265	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:11.047436
93	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	293	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:11.073956
94	shipstation	/orders?orderNumber=12138174203	GET	200	969	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:12.043998
95	thingspace	/api/ts/v1/oauth2/token	POST	200	408	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:12.453439
96	thingspace	/api/m2m/v1/session/login	POST	200	482	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:12.936412
97	thingspace	/api/m2m/v1/devices/actions/list	POST	400	369	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:58:13.307194
98	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	394	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:30.874049
99	chargebee	/api/v2/customers?email=***&limit=100	GET	200	976	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:31.454926
100	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	298	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:31.754
101	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	686	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:32.144121
102	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	703	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:32.160046
103	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	736	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:32.195095
104	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	763	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:32.220935
105	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	238	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:32.462332
106	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	241	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:32.477132
107	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	247	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:32.482845
108	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	262	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:32.494783
109	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	270	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:32.501532
110	shipstation	/orders?orderNumber=12138174203	GET	200	985	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:33.478293
111	thingspace	/api/ts/v1/oauth2/token	POST	200	408	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:33.887573
112	thingspace	/api/m2m/v1/session/login	POST	200	553	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:34.441293
113	thingspace	/api/m2m/v1/devices/actions/list	POST	400	379	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:34.822294
114	chargebee	/api/v2/customers?email=***&limit=100	GET	200	276	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.224585
115	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	413	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.361039
116	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	268	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.49375
117	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	276	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.502894
118	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	324	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.550991
119	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	334	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.560297
120	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	341	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.566945
121	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	234	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.805394
122	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	242	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.811036
123	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	246	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.814758
124	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	272	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.841678
125	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	275	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:35.843855
126	shipstation	/orders?orderNumber=12138174203	GET	200	320	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:36.165011
127	thingspace	/api/ts/v1/oauth2/token	POST	200	406	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:36.571914
128	thingspace	/api/m2m/v1/session/login	POST	200	345	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:36.918031
129	thingspace	/api/m2m/v1/devices/actions/list	POST	400	386	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 16:59:37.306378
130	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	446	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:53.219515
131	chargebee	/api/v2/customers?email=***&limit=100	GET	200	1012	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:53.783466
132	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	311	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.096318
133	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	677	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.465127
134	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	714	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.500924
135	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	777	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.562613
136	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	799	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.586675
137	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	239	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.829587
138	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	247	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.836059
139	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	287	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.875693
140	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	297	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.887623
141	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	350	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:54.940443
142	shipstation	/orders?orderNumber=12138174203	GET	200	982	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:55.922987
143	thingspace	/api/ts/v1/oauth2/token	POST	200	466	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:56.3904
144	thingspace	/api/m2m/v1/session/login	POST	200	461	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:56.852431
145	thingspace	/api/m2m/v1/devices/actions/list	POST	400	403	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 18:20:57.256803
146	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	503	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:53.760521
147	chargebee	/api/v2/customers?email=***&limit=100	GET	200	967	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:54.223086
148	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	397	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:54.622395
149	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	677	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:54.905686
150	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	708	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:54.935428
241	thingspace	/api/m2m/v1/devices/actions/list	POST	400	474	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:44.00936
151	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	788	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:55.015047
152	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	803	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:55.027916
153	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	242	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:55.273334
154	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	252	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:55.282157
155	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	243	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:55.282404
156	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	274	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:55.304369
157	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	302	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:55.331725
158	shipstation	/orders?orderNumber=12138174203	GET	200	1039	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:56.37088
159	thingspace	/api/ts/v1/oauth2/token	POST	200	919	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:57.291698
160	thingspace	/api/m2m/v1/session/login	POST	200	855	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:58.147314
161	thingspace	/api/m2m/v1/devices/actions/list	POST	400	381	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:06:58.530513
162	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	425	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:16.686553
163	chargebee	/api/v2/customers?email=***&limit=100	GET	200	719	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:16.978656
164	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	309	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:17.289296
165	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	676	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:17.659765
166	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	706	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:17.687094
167	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	759	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:17.739775
168	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	776	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:17.759197
169	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	235	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:18.000035
170	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	242	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:18.005917
171	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	250	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:18.013033
172	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	270	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:18.033972
173	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	280	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:18.041707
174	shipstation	/orders?orderNumber=12138174203	GET	200	974	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:19.016322
175	thingspace	/api/ts/v1/oauth2/token	POST	200	681	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:19.698468
176	thingspace	/api/m2m/v1/session/login	POST	200	769	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:20.468659
177	thingspace	/api/m2m/v1/devices/actions/list	POST	400	338	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:07:20.80916
178	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	428	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:06.695746
179	chargebee	/api/v2/customers?email=***&limit=100	GET	200	1039	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:07.306395
180	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	288	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:07.595696
181	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	676	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:07.987597
182	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	730	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:08.040702
183	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	784	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:08.09226
184	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	785	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:08.104689
185	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	238	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:08.335604
186	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	241	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:08.338282
187	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	254	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:08.350841
188	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	279	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:08.374803
189	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	279	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:08.376817
190	shipstation	/orders?orderNumber=12138174203	GET	200	995	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:09.373188
191	thingspace	/api/ts/v1/oauth2/token	POST	200	686	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:10.06172
192	thingspace	/api/m2m/v1/session/login	POST	200	847	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:10.908135
193	thingspace	/api/m2m/v1/devices/actions/list	POST	400	458	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:08:11.36947
194	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	417	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:30.877297
195	chargebee	/api/v2/customers?email=***&limit=100	GET	200	967	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:31.424835
196	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	305	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:31.731415
197	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	675	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:32.103192
198	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	700	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:32.127712
199	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	756	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:32.184066
200	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	782	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:32.207605
201	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	240	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:32.450039
202	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	247	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:32.456511
203	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	249	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:32.466658
204	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	268	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:32.477812
205	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	277	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:32.486243
206	shipstation	/orders?orderNumber=12138174203	GET	200	994	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:33.481158
207	thingspace	/api/ts/v1/oauth2/token	POST	200	692	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:34.175586
208	thingspace	/api/m2m/v1/session/login	POST	200	893	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:35.067796
209	thingspace	/api/m2m/v1/devices/actions/list	POST	400	548	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:35.618189
210	chargebee	/api/v2/customers?email=***&limit=100	GET	200	268	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:35.961255
211	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	424	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.116679
212	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	239	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.203444
213	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	271	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.235081
214	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	301	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.265721
215	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	307	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.270093
216	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	323	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.285834
217	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	243	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.53089
218	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	250	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.537889
219	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	257	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.544638
220	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	276	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.564346
221	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	294	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.581097
222	shipstation	/orders?orderNumber=12138174203	GET	200	318	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:36.90008
223	thingspace	/api/ts/v1/oauth2/token	POST	200	678	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:37.579562
224	thingspace	/api/m2m/v1/session/login	POST	200	401	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:37.980884
225	thingspace	/api/m2m/v1/devices/actions/list	POST	400	466	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:09:38.449221
226	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	426	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:39.686757
227	chargebee	/api/v2/customers?email=***&limit=100	GET	200	730	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:39.990175
228	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	322	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:40.313062
229	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	677	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:40.671259
230	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	705	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:40.698592
231	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	755	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:40.748592
232	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	770	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:40.762111
233	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	237	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:41.001968
234	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	242	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:41.005964
235	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	246	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:41.018106
236	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	262	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:41.027263
237	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	276	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:41.039789
238	shipstation	/orders?orderNumber=12138174203	GET	200	987	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:42.027238
239	thingspace	/api/ts/v1/oauth2/token	POST	200	675	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:42.703004
240	thingspace	/api/m2m/v1/session/login	POST	200	829	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:10:43.533007
242	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	413	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:01.679148
243	chargebee	/api/v2/customers?email=***&limit=100	GET	200	722	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:01.984633
244	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	323	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:02.307739
245	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	676	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:02.665783
246	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	715	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:02.702592
247	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	744	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:02.732462
248	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	761	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:02.746457
249	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	234	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:02.984385
250	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	241	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:02.990076
251	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	248	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:03.00454
252	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	266	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:03.015085
253	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	284	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:03.031748
254	shipstation	/orders?orderNumber=12138174203	GET	200	967	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:04.000119
255	thingspace	/api/ts/v1/oauth2/token	POST	200	681	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:04.680561
256	thingspace	/api/m2m/v1/session/login	POST	200	848	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:05.529411
257	thingspace	/api/m2m/v1/devices/actions/list	POST	400	494	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:06.024723
258	chargebee	/api/v2/customers?email=***&limit=100	GET	200	304	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:06.401029
259	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	433	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:06.530318
260	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	234	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:06.636886
261	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	270	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:06.672229
262	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	326	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:06.728996
263	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	340	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:06.742351
264	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	391	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:06.793051
265	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	237	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:07.033126
266	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	239	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:07.034672
267	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	243	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:07.046615
268	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	272	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:07.066853
269	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	283	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:07.078094
270	shipstation	/orders?orderNumber=12138174203	GET	200	402	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:07.481618
271	thingspace	/api/ts/v1/oauth2/token	POST	200	676	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:08.158346
272	thingspace	/api/m2m/v1/session/login	POST	200	310	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:08.468867
273	thingspace	/api/m2m/v1/devices/actions/list	POST	400	464	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:11:08.934799
274	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	449	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:44.335234
275	chargebee	/api/v2/customers?email=***&limit=100	GET	200	965	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:44.828604
276	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	319	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.150032
277	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	687	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.522102
278	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	709	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.542348
279	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	768	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.601965
280	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	780	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.611615
281	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	237	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.853771
282	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	243	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.864544
283	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	249	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.876887
284	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	268	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.884956
285	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	301	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:45.916095
286	shipstation	/orders?orderNumber=12138174203	GET	200	1004	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:46.920865
287	thingspace	/api/ts/v1/oauth2/token	POST	200	839	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:47.762045
288	thingspace	/api/m2m/v1/session/login	POST	200	580	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:48.342872
289	thingspace	/api/m2m/v1/devices/actions/list	POST	400	690	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:49.035464
290	chargebee	/api/v2/customers?email=***&limit=100	GET	200	264	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:49.422953
291	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	419	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:49.579299
292	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	242	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:49.666906
293	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	269	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:49.693994
294	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	327	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:49.751878
295	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	328	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:49.753279
296	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	335	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:49.758778
297	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	239	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:49.999809
298	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	245	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:50.006107
299	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	251	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:50.011776
300	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	270	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:50.031376
301	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	292	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:50.052719
302	shipstation	/orders?orderNumber=12138174203	GET	200	340	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:50.393052
303	thingspace	/api/ts/v1/oauth2/token	POST	200	513	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:50.907334
304	thingspace	/api/m2m/v1/session/login	POST	200	391	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:51.299621
305	thingspace	/api/m2m/v1/devices/actions/list	POST	400	457	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:27:51.758965
306	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	409	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:55.807421
307	chargebee	/api/v2/customers?email=***&limit=100	GET	200	944	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:56.341858
308	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	285	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:56.628428
309	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	682	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:57.028677
310	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	702	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:57.046834
311	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	734	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:57.078876
312	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	770	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:57.112985
313	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	237	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:57.353131
314	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	248	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:57.363239
315	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	241	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:57.365023
316	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	268	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:57.383716
317	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	291	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:57.406041
318	shipstation	/orders?orderNumber=12138174203	GET	200	980	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:58.387318
319	thingspace	/api/ts/v1/oauth2/token	POST	200	500	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:58.888476
320	thingspace	/api/ts/v1/oauth2/token	POST	200	705	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:59.094381
321	thingspace	/api/m2m/v1/session/login	POST	200	330	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:59.425481
322	thingspace	/api/m2m/v1/session/login	POST	200	668	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:59.55742
323	thingspace	/api/m2m/v1/devices/actions/list	POST	400	374	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:28:59.80062
324	thingspace	/api/m2m/v1/devices/actions/list	POST	200	825	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:00.384109
325	chargebee	/api/v2/customers?email=***&limit=100	GET	200	274	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:00.7838
326	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	418	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:00.927055
327	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	237	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.023975
328	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	297	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.084399
329	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	301	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.086712
330	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	303	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.090261
331	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	324	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.110529
332	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	236	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.34888
333	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	242	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.35467
334	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	249	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.36082
335	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	293	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.405746
336	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	363	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.475086
337	shipstation	/orders?orderNumber=12138174203	GET	200	312	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:01.788446
338	thingspace	/api/ts/v1/oauth2/token	POST	200	236	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:02.02664
339	thingspace	/api/ts/v1/oauth2/token	POST	200	503	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:02.291693
340	thingspace	/api/m2m/v1/session/login	POST	200	381	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:02.407929
341	thingspace	/api/m2m/v1/session/login	POST	200	318	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:02.609765
342	thingspace	/api/m2m/v1/devices/actions/list	POST	400	373	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:02.782931
343	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1023	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:29:03.634511
344	thingspace	/api/ts/v1/oauth2/token	POST	200	499	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:29:06.591774
345	thingspace	/api/m2m/v1/session/login	POST	200	310	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:29:06.903349
346	thingspace	/api/m2m/v1/devices/actions/list	POST	200	847	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:29:07.751229
347	thingspace	/api/ts/v1/oauth2/token	POST	200	248	t	\N	\N	\N	2026-02-12 19:29:08.12514
348	thingspace	/api/m2m/v1/session/login	POST	200	322	t	\N	\N	\N	2026-02-12 19:29:08.448545
349	thingspace	/api/m2m/v1/devices/actions/restore	POST	200	679	t	\N	\N	\N	2026-02-12 19:29:09.129179
350	thingspace	/api/ts/v1/oauth2/token	POST	200	500	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:30:07.295928
351	thingspace	/api/m2m/v1/session/login	POST	200	756	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:30:08.0444
352	thingspace	/api/m2m/v1/devices/actions/list	POST	200	859	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:30:08.903701
353	thingspace	/api/ts/v1/oauth2/token	POST	200	638	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:31:09.837077
354	thingspace	/api/ts/v1/oauth2/token	POST	200	848	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:31:10.034646
355	thingspace	/api/m2m/v1/session/login	POST	200	440	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:31:10.476305
356	thingspace	/api/m2m/v1/session/login	POST	200	736	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:31:10.560442
357	thingspace	/api/m2m/v1/devices/actions/list	POST	200	962	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:31:11.438174
358	thingspace	/api/m2m/v1/devices/actions/list	POST	200	991	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:31:11.552348
359	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	405	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:37.84155
360	chargebee	/api/v2/customers?email=***&limit=100	GET	200	932	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:38.368171
361	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	302	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:38.670974
362	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	679	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:39.04993
363	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	694	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:39.064392
364	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	775	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:39.144331
365	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	778	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:39.149358
366	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	236	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:39.38799
367	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	246	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:39.397403
368	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	238	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:39.400555
369	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	261	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:39.413271
370	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	272	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:39.42345
371	shipstation	/orders?orderNumber=12138174203	GET	200	996	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:40.420885
372	thingspace	/api/ts/v1/oauth2/token	POST	200	907	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:41.329434
373	thingspace	/api/ts/v1/oauth2/token	POST	200	913	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:41.33494
374	thingspace	/api/m2m/v1/session/login	POST	200	900	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:42.235624
375	thingspace	/api/m2m/v1/session/login	POST	200	911	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:42.241028
376	thingspace	/api/m2m/v1/devices/actions/list	POST	400	664	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:42.900289
377	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1040	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:43.28215
378	chargebee	/api/v2/customers?email=***&limit=100	GET	200	280	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:43.684665
379	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	418	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:43.823608
380	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	303	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:43.989226
381	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	676	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:44.365129
382	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	702	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:44.390421
383	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	735	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:44.423123
384	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	767	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:44.454252
385	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	239	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:44.695799
386	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	241	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:44.698341
387	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	250	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:44.706369
388	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	262	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:44.718609
389	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	285	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:44.74113
390	shipstation	/orders?orderNumber=12138174203	GET	200	751	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:45.493645
391	thingspace	/api/ts/v1/oauth2/token	POST	200	241	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:45.73667
392	thingspace	/api/m2m/v1/session/login	POST	200	422	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:46.158933
393	thingspace	/api/ts/v1/oauth2/token	POST	200	696	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:46.18999
394	thingspace	/api/m2m/v1/session/login	POST	200	444	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:46.635084
395	thingspace	/api/m2m/v1/devices/actions/list	POST	400	483	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:46.642832
396	thingspace	/api/m2m/v1/devices/actions/list	POST	200	888	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-12 19:35:47.524344
397	thingspace	/api/ts/v1/oauth2/token	POST	200	266	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:35:50.830321
398	thingspace	/api/m2m/v1/session/login	POST	200	815	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:35:51.646561
399	thingspace	/api/m2m/v1/devices/actions/list	POST	200	851	t	\N	emailforallworks0@gmail.com	device-status	2026-02-12 19:35:52.497833
400	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	629	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:49.57945
401	chargebee	/api/v2/customers?email=***&limit=100	GET	200	1026	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:49.95086
402	chargebee	/api/v2/subscriptions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50	GET	200	315	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.267419
403	chargebee	/api/v2/credit_notes?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	680	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.63832
404	chargebee	/api/v2/payment_sources?customer_id[is]=AzZetAVABjuxP5BTx	GET	200	689	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.647813
405	chargebee	/api/v2/transactions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	699	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.654125
406	chargebee	/api/v2/invoices?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	729	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.685024
407	chargebee	/api/v2/credit_notes?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	241	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.938461
408	chargebee	/api/v2/payment_sources?customer_id[is]=AzZdWBV9ix3547S9B	GET	200	246	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.943965
409	chargebee	/api/v2/transactions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	263	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.959757
410	chargebee	/api/v2/invoices?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	283	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.97949
411	chargebee	/api/v2/subscriptions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50	GET	200	289	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:50.982595
412	shipstation	/orders?orderNumber=12138175356	GET	200	1008	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:51.99218
413	thingspace	/api/ts/v1/oauth2/token	POST	200	824	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:52.819719
414	thingspace	/api/m2m/v1/session/login	POST	200	557	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:53.378319
415	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1015	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:54.394305
416	chargebee	/api/v2/customers?email=***&limit=100	GET	200	276	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:54.753221
417	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	436	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:54.91496
418	chargebee	/api/v2/credit_notes?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	244	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.000575
419	chargebee	/api/v2/transactions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	255	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.010647
420	chargebee	/api/v2/payment_sources?customer_id[is]=AzZetAVABjuxP5BTx	GET	200	246	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.01279
421	chargebee	/api/v2/invoices?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	277	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.032782
422	chargebee	/api/v2/subscriptions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50	GET	200	317	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.072764
423	chargebee	/api/v2/credit_notes?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	246	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.325444
424	chargebee	/api/v2/payment_sources?customer_id[is]=AzZdWBV9ix3547S9B	GET	200	250	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.329008
425	chargebee	/api/v2/transactions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	253	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.331505
426	chargebee	/api/v2/invoices?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	278	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.354948
427	chargebee	/api/v2/subscriptions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50	GET	200	318	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.394396
428	shipstation	/orders?orderNumber=12138175356	GET	200	327	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:55.724409
429	thingspace	/api/ts/v1/oauth2/token	POST	200	276	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:56.001148
430	thingspace	/api/m2m/v1/session/login	POST	200	418	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:56.419886
431	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1604	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 14:26:58.025833
432	thingspace	/api/ts/v1/oauth2/token	POST	200	403	t	\N	shanles2010@outlook.com	device-status	2026-02-13 14:27:50.794019
433	thingspace	/api/m2m/v1/session/login	POST	200	546	t	\N	shanles2010@outlook.com	device-status	2026-02-13 14:27:51.331656
434	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1584	t	\N	shanles2010@outlook.com	device-status	2026-02-13 14:27:52.915783
435	thingspace	/api/ts/v1/oauth2/token	POST	200	891	t	\N	shanles2010@outlook.com	device-status	2026-02-13 14:44:37.10471
436	thingspace	/api/m2m/v1/session/login	POST	200	578	t	\N	shanles2010@outlook.com	device-status	2026-02-13 14:44:37.674429
437	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1113	t	\N	shanles2010@outlook.com	device-status	2026-02-13 14:44:38.788917
438	thingspace	/api/ts/v1/oauth2/token	POST	200	879	t	\N	shanles2010@outlook.com	device-status	2026-02-13 15:20:00.584174
439	thingspace	/api/m2m/v1/session/login	POST	200	557	t	\N	shanles2010@outlook.com	device-status	2026-02-13 15:20:01.125626
440	thingspace	/api/m2m/v1/devices/actions/list	POST	200	921	t	\N	shanles2010@outlook.com	device-status	2026-02-13 15:20:02.047282
441	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	434	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:35.139366
442	chargebee	/api/v2/customers?email=***&limit=100	GET	200	981	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:35.66154
443	chargebee	/api/v2/subscriptions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50	GET	200	317	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:35.980628
444	chargebee	/api/v2/payment_sources?customer_id[is]=AzZetAVABjuxP5BTx	GET	200	685	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:36.35456
445	chargebee	/api/v2/credit_notes?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	699	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:36.366119
446	chargebee	/api/v2/invoices?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	748	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:36.412385
447	chargebee	/api/v2/transactions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	781	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:36.463441
448	chargebee	/api/v2/credit_notes?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	242	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:36.693596
449	chargebee	/api/v2/transactions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	260	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:36.710657
450	chargebee	/api/v2/invoices?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	295	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:36.745371
451	chargebee	/api/v2/subscriptions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50	GET	200	313	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:36.762453
452	chargebee	/api/v2/payment_sources?customer_id[is]=AzZdWBV9ix3547S9B	GET	200	685	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:37.136576
453	shipstation	/orders?orderNumber=12138175356	GET	200	960	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:38.098372
454	thingspace	/api/ts/v1/oauth2/token	POST	200	925	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.024777
455	chargebee	/api/v2/customers?email=***&limit=100	GET	200	287	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.086961
456	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	397	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.198331
457	chargebee	/api/v2/credit_notes?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	242	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.331569
458	chargebee	/api/v2/payment_sources?customer_id[is]=AzZetAVABjuxP5BTx	GET	200	243	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.333468
459	chargebee	/api/v2/transactions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	248	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.33717
460	chargebee	/api/v2/invoices?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	272	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.361259
461	chargebee	/api/v2/subscriptions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50	GET	200	311	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.399086
462	chargebee	/api/v2/credit_notes?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	241	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.643633
463	chargebee	/api/v2/payment_sources?customer_id[is]=AzZdWBV9ix3547S9B	GET	200	247	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.649633
464	chargebee	/api/v2/transactions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	259	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.661542
465	chargebee	/api/v2/invoices?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	295	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.696643
466	chargebee	/api/v2/subscriptions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50	GET	200	309	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:39.709729
467	shipstation	/orders?orderNumber=12138175356	GET	200	318	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:40.03004
468	thingspace	/api/m2m/v1/session/login	POST	200	1186	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:40.211802
469	thingspace	/api/ts/v1/oauth2/token	POST	200	271	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:40.302399
470	thingspace	/api/m2m/v1/session/login	POST	200	946	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:41.249617
471	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1150	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:41.363584
472	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1738	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:42.989419
473	chargebee	/api/v2/customers?email=***&limit=100	GET	200	283	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.399338
474	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	402	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.518469
475	chargebee	/api/v2/credit_notes?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	243	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.642725
476	chargebee	/api/v2/payment_sources?customer_id[is]=AzZetAVABjuxP5BTx	GET	200	245	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.647432
477	chargebee	/api/v2/transactions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	251	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.650909
478	chargebee	/api/v2/subscriptions?customer_id[is]=AzZetAVABjuxP5BTx&limit=50	GET	200	281	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.6814
479	chargebee	/api/v2/invoices?customer_id[is]=AzZetAVABjuxP5BTx&limit=50&sort_by[desc]=date	GET	200	289	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.688754
480	chargebee	/api/v2/payment_sources?customer_id[is]=AzZdWBV9ix3547S9B	GET	200	244	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.938004
481	chargebee	/api/v2/credit_notes?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	247	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.940632
482	chargebee	/api/v2/transactions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	263	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.953929
483	chargebee	/api/v2/subscriptions?customer_id[is]=AzZdWBV9ix3547S9B&limit=50	GET	200	284	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.974497
484	chargebee	/api/v2/invoices?customer_id[is]=AzZdWBV9ix3547S9B&limit=50&sort_by[desc]=date	GET	200	287	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:43.976945
485	shipstation	/orders?orderNumber=12138175356	GET	200	303	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:44.281897
486	thingspace	/api/ts/v1/oauth2/token	POST	200	274	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:44.557437
487	thingspace	/api/m2m/v1/session/login	POST	200	1016	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:45.57408
488	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1211	t	\N	shanles2010@outlook.com	customer-full-data	2026-02-13 16:02:46.785969
489	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	431	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:50.333445
490	chargebee	/api/v2/customers?email=***&limit=100	GET	200	932	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:50.831796
491	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	309	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.142107
492	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	680	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.516829
493	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	708	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.543505
494	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	762	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.5981
495	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	778	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.611303
496	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	239	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.854666
497	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	246	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.861043
498	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	242	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.865537
499	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	262	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.875744
500	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	285	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:51.899961
501	shipstation	/orders?orderNumber=12138174203	GET	200	780	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:52.681531
502	thingspace	/api/ts/v1/oauth2/token	POST	200	682	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:53.365427
503	thingspace	/api/ts/v1/oauth2/token	POST	200	694	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:53.376262
504	thingspace	/api/m2m/v1/session/login	POST	200	456	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:53.832751
505	thingspace	/api/m2m/v1/devices/actions/list	POST	200	959	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:54.793509
506	thingspace	/api/m2m/v1/session/login	POST	200	6083	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:04:59.451264
507	thingspace	/api/m2m/v1/devices/actions/list	POST	400	900	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:00.355252
508	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	428	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:00.943347
509	chargebee	/api/v2/customers?email=***&limit=100	GET	200	715	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:01.229013
510	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	343	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:01.573309
511	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	678	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:01.910844
512	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	695	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:01.927539
513	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	756	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:01.987719
514	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	837	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:02.066978
515	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	239	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:02.316688
516	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	244	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:02.320816
517	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	246	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:02.330678
518	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	269	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:02.345913
519	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	271	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:02.34685
520	shipstation	/orders?orderNumber=12138174203	GET	200	989	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:03.337116
521	thingspace	/api/ts/v1/oauth2/token	POST	200	710	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:04.049477
522	thingspace	/api/ts/v1/oauth2/token	POST	200	747	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:04.084938
523	thingspace	/api/m2m/v1/session/login	POST	200	477	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:04.563401
524	thingspace	/api/m2m/v1/session/login	POST	200	928	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:04.979236
525	thingspace	/api/m2m/v1/devices/actions/list	POST	400	515	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:05.495494
526	thingspace	/api/m2m/v1/devices/actions/list	POST	200	2391	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:05:06.958123
527	thingspace	/api/ts/v1/oauth2/token	POST	200	959	t	\N	emailforallworks0@gmail.com	device-status	2026-02-13 16:08:07.453802
528	thingspace	/api/m2m/v1/session/login	POST	200	627	t	\N	emailforallworks0@gmail.com	device-status	2026-02-13 16:08:08.073325
529	thingspace	/api/m2m/v1/devices/actions/list	POST	200	987	t	\N	emailforallworks0@gmail.com	device-status	2026-02-13 16:08:09.061468
530	shopify	/admin/api/2024-01/orders.json?status=any&email=***&limit=250	GET	200	446	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:31.902466
531	chargebee	/api/v2/customers?email=***&limit=100	GET	200	937	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:32.380584
532	chargebee	/api/v2/subscriptions?customer_id[is]=30183&limit=50	GET	200	304	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:32.687166
533	chargebee	/api/v2/payment_sources?customer_id[is]=30183	GET	200	673	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:33.059173
534	chargebee	/api/v2/transactions?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	703	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:33.086122
535	chargebee	/api/v2/credit_notes?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	754	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:33.138476
536	chargebee	/api/v2/invoices?customer_id[is]=30183&limit=50&sort_by[desc]=date	GET	200	762	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:33.145019
537	chargebee	/api/v2/payment_sources?customer_id[is]=AzZj9bUx1Ro6J1anP	GET	200	241	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:33.391359
538	chargebee	/api/v2/credit_notes?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	248	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:33.398802
539	chargebee	/api/v2/transactions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	268	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:33.417925
540	chargebee	/api/v2/invoices?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50&sort_by[desc]=date	GET	200	273	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:33.423405
541	chargebee	/api/v2/subscriptions?customer_id[is]=AzZj9bUx1Ro6J1anP&limit=50	GET	200	282	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:33.430357
542	shipstation	/orders?orderNumber=12138174203	GET	200	986	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:34.417676
543	thingspace	/api/ts/v1/oauth2/token	POST	200	484	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:34.902692
544	thingspace	/api/ts/v1/oauth2/token	POST	200	852	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:35.271258
545	thingspace	/api/m2m/v1/session/login	POST	200	556	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:35.459378
546	thingspace	/api/m2m/v1/session/login	POST	200	432	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:35.704154
547	thingspace	/api/m2m/v1/devices/actions/list	POST	400	390	f	HTTP 400	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:36.095143
548	thingspace	/api/m2m/v1/devices/actions/list	POST	200	1043	t	\N	emailforallworks0@gmail.com	customer-full-data	2026-02-13 16:08:36.504305
\.


--
-- Data for Name: otp_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.otp_codes (id, customer_id, code, type, target, expires_at, verified, created_at) FROM stdin;
2	2	203788	email	emailforallworks0@gmail.com	2026-01-24 03:42:06.327	t	2026-01-24 03:32:06.328934
3	2	329770	email	emailforallworks0@gmail.com	2026-01-24 03:42:22.17	t	2026-01-24 03:32:22.204396
4	2	996503	email	emailforallworks0@gmail.com	2026-01-24 03:43:03.422	t	2026-01-24 03:33:03.473831
5	2	918880	email	emailforallworks0@gmail.com	2026-01-24 03:43:04.515	t	2026-01-24 03:33:04.519112
6	2	897272	email	emailforallworks0@gmail.com	2026-01-24 03:43:09.743	t	2026-01-24 03:33:09.747647
7	2	603859	email	emailforallworks0@gmail.com	2026-01-24 03:43:10.655	t	2026-01-24 03:33:10.658549
9	2	491202	email	emailforallworks0@gmail.com	2026-01-24 03:44:13.364	t	2026-01-24 03:34:13.36917
10	2	973392	forgot_password	emailforallworks0@gmail.com	2026-01-24 05:00:23.237	t	2026-01-24 04:50:23.240582
11	3	572263	phone	+12565566105	2026-01-28 07:05:55.74	t	2026-01-28 06:55:55.952792
12	3	288463	email	char.west@yahoo.com	2026-01-28 07:06:10.598	t	2026-01-28 06:56:10.600079
13	4	198079	phone	+19518472178	2026-01-28 07:09:28.99	t	2026-01-28 06:59:28.993204
14	4	620714	email	evolsaur12@gmail.com	2026-01-28 07:09:40.232	t	2026-01-28 06:59:40.23349
15	5	790718	phone	+12513590185	2026-01-28 07:20:49.468	t	2026-01-28 07:10:49.471387
16	5	986007	email	kindrick.mckenzie2@gmail.com	2026-01-28 07:21:01.727	t	2026-01-28 07:11:01.728512
17	6	333610	phone	+18143599739	2026-01-28 08:04:58.154	t	2026-01-28 07:54:58.157044
18	6	201211	email	asbell.jenifer@gmail.com	2026-01-28 08:05:08.004	t	2026-01-28 07:55:08.007832
19	7	650068	phone	+18432863133	2026-01-28 10:20:00.829	t	2026-01-28 10:10:00.832455
20	7	348015	email	stickitkid00@gmail.com	2026-01-28 10:20:13.028	t	2026-01-28 10:10:13.030314
21	1	762225	signin	emailforallworks0@gmaill.com	2026-01-29 14:59:51.927	f	2026-01-29 14:49:51.930869
22	2	196676	signin	emailforallworks0@gmail.com	2026-01-29 15:31:12.236	f	2026-01-29 15:21:12.237832
1	2	494762	phone	+15122999278	2026-01-24 03:41:41.947	t	2026-01-24 03:31:41.957774
8	2	344778	phone	+15122999278	2026-01-24 03:43:50.868	t	2026-01-24 03:33:50.954191
23	9	237160	phone	+15122999278	2026-01-29 18:12:10.856	t	2026-01-29 18:02:10.900917
24	9	600905	email	jeremiahigbinedion2@gmail.com	2026-01-29 18:12:33.371	t	2026-01-29 18:02:33.373109
\.


--
-- Data for Name: plan_change_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plan_change_verifications (id, customer_id, customer_email, subscription_id, chargebee_customer_id, mdn, iccid, current_plan_id, current_plan_name, current_price, requested_plan_id, requested_plan_name, requested_price, thingspace_plan_code, chargebee_updated, chargebee_next_billing_date, thingspace_requested, thingspace_request_id, verification_scheduled_at, verification_completed_at, verification_status, verification_error, slack_notification_sent, status, created_at, updated_at) FROM stdin;
1	\N	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	\N	89148000005985130913	Nomad-Rural-Unlimited-100-MBPS-11995-USD-Monthly	Nomad-Rural-Unlimited-100-MBPS-11995-USD-Monthly	11995	Nomad-Unlimited-Travel-Plan	Nomad Unlimited Travel	12995	59145x48526x84777	f	\N	f	\N	\N	\N	pending	Chargebee error: The API endpoint is incompatible with the product catalog version. You are calling product catalog 1.0 API endpoint but you are using product catalog 2.0	f	failed	2026-02-05 10:46:51.149853	2026-02-05 10:46:52.078
2	\N	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	\N	89148000005985130913	Nomad-Rural-Unlimited-100-MBPS-11995-USD-Monthly	Nomad-Rural-Unlimited-100-MBPS-11995-USD-Monthly	11995	Nomad-Unlimited-Travel-Plan	Nomad Unlimited Travel	12995	59145x48526x84777	f	\N	f	\N	\N	\N	pending	Chargebee error: The API endpoint is incompatible with the product catalog version. You are calling product catalog 1.0 API endpoint but you are using product catalog 2.0	f	failed	2026-02-05 10:49:35.389941	2026-02-05 10:49:36.062
3	\N	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	\N	89148000005985130913	Nomad-Rural-Unlimited-100-MBPS-11995-USD-Monthly	Nomad-Rural-Unlimited-100-MBPS-11995-USD-Monthly	11995	Nomad-Unlimited-Residential-Plan	Nomad Unlimited Residential	9995	59142x48526x84777	f	\N	f	\N	\N	\N	pending	Chargebee error: The API endpoint is incompatible with the product catalog version. You are calling product catalog 1.0 API endpoint but you are using product catalog 2.0	f	failed	2026-02-05 10:50:40.715759	2026-02-05 10:50:41.391
4	\N	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	\N	89148000005985130913	Nomad-Rural-Unlimited-100-MBPS-11995-USD-Monthly	Nomad-Rural-Unlimited-100-MBPS-11995-USD-Monthly	11995	Nomad-Unlimited-Travel-Plan	Nomad Unlimited Travel	12995	59145x48526x84777	f	\N	f	\N	\N	\N	pending	Chargebee error: The API endpoint is incompatible with the product catalog version. You are calling product catalog 1.0 API endpoint but you are using product catalog 2.0	f	failed	2026-02-05 10:51:13.641001	2026-02-05 10:51:14.309
5	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	\N	\N	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	12995	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	9995	\N	t	\N	f	\N	\N	\N	pending	\N	f	completed	2026-02-07 16:27:54.41594	2026-02-07 16:27:54.41594
6	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	\N	\N	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	12995	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	9995	\N	t	\N	f	\N	\N	\N	pending	\N	f	completed	2026-02-07 16:28:52.34625	2026-02-07 16:28:52.34625
7	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	\N	\N	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	12995	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	9995	\N	t	\N	f	\N	\N	\N	pending	\N	f	completed	2026-02-07 17:34:44.775145	2026-02-07 17:34:44.775145
8	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	\N	\N	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	12995	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	9995	\N	t	\N	f	\N	\N	\N	pending	\N	f	completed	2026-02-07 18:47:43.103022	2026-02-07 18:47:43.103022
9	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	\N	\N	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	Nomad-Unlimited-Travel-Plan-01-USD-Monthly	12995	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	UNLIMITED-RESIDENTIAL-PLAN-USD-Monthly	9995	\N	t	\N	f	\N	\N	\N	pending	\N	f	completed	2026-02-07 23:59:13.395173	2026-02-07 23:59:13.395173
\.


--
-- Data for Name: portal_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.portal_settings (id, key, value, description, updated_at, updated_by) FROM stdin;
2	zendesk_cancellation_group_id	41909825396372	Zendesk Retention & Cancellations group ID	2026-02-04 18:14:07.994409	system
1	slack_channel_id	C09DACN82VD	Slack channel for cancellation notifications	2026-02-04 18:39:30.687	bryan@nomadinternet.com
3	zendesk_troubleshooting_group_id	41909825396372	\N	2026-02-12 19:25:52.457853	system
4	zendesk_cancellation_assignee_id	43448482983700	\N	2026-02-13 14:45:20.743944	bryan@nomadinternet.com
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, customer_id, token, expires_at, created_at, user_agent, ip_address) FROM stdin;
1	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTIyNTgwOCwiZXhwIjoxNzY5ODMwNjA4fQ.GZKQnQlG6TjoPviL2d2k_pyWVlDEc0bb0cqQwSNxPDg	2026-01-31 03:36:48.437	2026-01-24 03:36:48.438448	\N	\N
2	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTIyNzY1MSwiZXhwIjoxNzY5ODMyNDUxfQ.ulvzmBVskgvKHbSoV6gdfw28FyYB6vcIJKmJSnPWFBI	2026-01-31 04:07:31.051	2026-01-24 04:07:31.051825	\N	\N
3	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTIzMDQyMCwiZXhwIjoxNzY5ODM1MjIwfQ.Fr5P11NX8brpUNt6V5fsLGZWbZxBzcLH2fl4KAfIPNg	2026-01-31 04:53:40.714	2026-01-24 04:53:40.715395	\N	\N
4	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTIzMzY5MiwiZXhwIjoxNzY5ODM4NDkyfQ.jLwwmEWC2j9x9Tri2OmbZ2s1Hhhlt0PUyMilaXSPm0s	2026-01-31 05:48:12.349	2026-01-24 05:48:12.350555	\N	\N
5	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTIzMzcxOSwiZXhwIjoxNzY5ODM4NTE5fQ.nfHWLC8ZoZ2DW_eg2J43MgHB8MGHCHSCCnBOYJhENtY	2026-01-31 05:48:39.711	2026-01-24 05:48:39.712538	\N	\N
6	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTIzNTE2OCwiZXhwIjoxNzY5ODM5OTY4fQ.CBnNTl7pIlPFBoS5Q4gk84iDPcn2_Fk60BvpWC3vFSY	2026-01-31 06:12:48.403	2026-01-24 06:12:48.403853	\N	\N
8	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTIzNTg3OSwiZXhwIjoxNzY5ODQwNjc5fQ._Yg_whdJGPgQjxI3roCQOcT7ydy-OfVy9oh0Db2UIHc	2026-01-31 06:24:39.088	2026-01-24 06:24:39.088821	\N	\N
9	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTI4MzYwOSwiZXhwIjoxNzY5ODg4NDA5fQ.UIOq3yBpGuzWaaUyyKb8FJoLw3b3WRKAMQV0hVw-Azk	2026-01-31 19:40:09.705	2026-01-24 19:40:09.706448	\N	\N
10	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjozLCJlbWFpbCI6ImNoYXIud2VzdEB5YWhvby5jb20iLCJpYXQiOjE3Njk1ODM0MDYsImV4cCI6MTc3MDE4ODIwNn0.nOs96A_aQ9N_g8u3L9V-gQe7hl105AjZvro-hfcdNc0	2026-02-04 06:56:46.542	2026-01-28 06:56:46.543071	\N	\N
12	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo1LCJlbWFpbCI6ImtpbmRyaWNrLm1ja2VuemllMkBnbWFpbC5jb20iLCJpYXQiOjE3Njk1ODQzOTUsImV4cCI6MTc3MDE4OTE5NX0.wuxU9njKhcUZdcsyi6TIJYbJe68IQU-kQ-iVtESFr30	2026-02-04 07:13:15.009	2026-01-28 07:13:15.009899	\N	\N
15	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo2LCJlbWFpbCI6ImFzYmVsbC5qZW5pZmVyQGdtYWlsLmNvbSIsImlhdCI6MTc2OTU4ODI2OCwiZXhwIjoxNzcwMTkzMDY4fQ.TNk8P9XXmdwXSUgeIt3WLDzOVyrHs7syXDC3zBjNvlg	2026-02-04 08:17:48.009	2026-01-28 08:17:48.010891	\N	\N
16	7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo3LCJlbWFpbCI6InN0aWNraXRraWQwMEBnbWFpbC5jb20iLCJpYXQiOjE3Njk1OTUwNDAsImV4cCI6MTc3MDE5OTg0MH0.UBW8LXpshtVShxwGuEPn-9leHIoeyaHbyEKHgIn2v5Q	2026-02-04 10:10:40.245	2026-01-28 10:10:40.245565	\N	\N
17	7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo3LCJlbWFpbCI6InN0aWNraXRraWQwMEBnbWFpbC5jb20iLCJpYXQiOjE3Njk1OTU4NjksImV4cCI6MTc3MDIwMDY2OX0.enlni1bGKJcirZ5gA-r0Zzc3y7J3y7ECWXS7j5OaOss	2026-02-04 10:24:29.796	2026-01-28 10:24:29.797718	\N	\N
18	7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo3LCJlbWFpbCI6InN0aWNraXRraWQwMEBnbWFpbC5jb20iLCJpYXQiOjE3Njk1OTY5MTQsImV4cCI6MTc3MDIwMTcxNH0.njiyhm5mWgwc0f68sr1yGWE49ReFU-DyfMV9HUD8lXg	2026-02-04 10:41:54.706	2026-01-28 10:41:54.707681	\N	\N
19	7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo3LCJlbWFpbCI6InN0aWNraXRraWQwMEBnbWFpbC5jb20iLCJpYXQiOjE3Njk2ODgyMzUsImV4cCI6MTc3MDI5MzAzNX0.wvBYQ_qcW-v8fUPguGQVob8dGFZ_06_fNgfoesRYja8	2026-02-05 12:03:55.721	2026-01-29 12:03:55.722932	\N	\N
20	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo1LCJlbWFpbCI6ImtpbmRyaWNrLm1ja2VuemllMkBnbWFpbC5jb20iLCJpYXQiOjE3Njk2ODg0MTAsImV4cCI6MTc3MDI5MzIxMH0.EJJyOrqrFgDPvhZAtPgfYUnqKG72Zu8aePgzV7Ys1dY	2026-02-05 12:06:50.597	2026-01-29 12:06:50.598702	\N	\N
21	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo0LCJlbWFpbCI6ImV2b2xzYXVyMTJAZ21haWwuY29tIiwiaWF0IjoxNzY5Njg5NzY1LCJleHAiOjE3NzAyOTQ1NjV9.3AQrGQNEyTAV5WplF4R064AY3DoK4A5tsWtYwhKifjY	2026-02-05 12:29:25.277	2026-01-29 12:29:25.278417	\N	\N
23	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo1LCJlbWFpbCI6ImtpbmRyaWNrLm1ja2VuemllMkBnbWFpbC5jb20iLCJpYXQiOjE3Njk2OTU1NDUsImV4cCI6MTc3MDMwMDM0NX0.mYxbQz3oz9ZiBpIc3nLEIO4roY2mnWj_oj6iguYP70k	2026-02-05 14:05:45.168	2026-01-29 14:05:45.169372	\N	\N
28	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTcwMTkzNSwiZXhwIjoxNzcwMzA2NzM1fQ.WR4_DtRYKlesJaj5oVgl2Gx0mt2W02DZsARCf1jO5Xg	2026-02-05 15:52:15.514	2026-01-29 15:52:15.516169	\N	\N
29	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjo5LCJlbWFpbCI6ImplcmVtaWFoaWdiaW5lZGlvbjJAZ21haWwuY29tIiwiaWF0IjoxNzY5NzA5ODgxLCJleHAiOjE3NzAzMTQ2ODF9.KEgU9yDTafe9onKGss7np9bia0UTPc6I82xSdupulZw	2026-02-05 18:04:41.054	2026-01-29 18:04:41.055051	\N	\N
30	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTgxNzExOCwiZXhwIjoxNzcwNDIxOTE4fQ.6ByGEU7sUPABDNyuHGkg1B-PRYkcm0g7znLj0gsehLc	2026-02-06 23:51:58.866	2026-01-30 23:51:58.867601	\N	\N
31	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTgxNzQwMCwiZXhwIjoxNzcwNDIyMjAwfQ.HNI0qzdjTblt5UO0ALFgKcCKEaaGaK1nbod3oDL0T8g	2026-02-06 23:56:40.879	2026-01-30 23:56:40.879924	\N	\N
32	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg3Njk1OCwiZXhwIjoxNzcwNDgxNzU4fQ.OOoVULDvOxKMKIAvxquw_IOVlU4_00FcVMNTQuGuNtk	2026-02-07 16:29:18.257	2026-01-31 16:29:18.258936	\N	\N
33	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg4MzIyNCwiZXhwIjoxNzcwNDg4MDI0fQ.e6j30VTbzsJ41OkR9CfcOOrNCpo1vpLMvGP9Z_u-CWI	2026-02-07 18:13:44.964	2026-01-31 18:13:44.964776	\N	\N
34	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg4Mzg2NCwiZXhwIjoxNzcwNDg4NjY0fQ.2P_wyKrLpO8E3ZKnPriHaIUVE6TkzWGwlxqSU82B_yg	2026-02-07 18:24:24.402	2026-01-31 18:24:24.403358	\N	\N
35	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg5MTU2OSwiZXhwIjoxNzcwNDk2MzY5fQ.GI8sBjghHL8nm-_wKq3dRwBrnR-rHKzkORpRyrtil60	2026-02-07 20:32:49.276	2026-01-31 20:32:49.277482	\N	\N
36	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg5MjA1MCwiZXhwIjoxNzcwNDk2ODUwfQ.NUC8WZ_o-95wI7ghn6gNTWmHeZnaoD3qQJRlzGnnKMg	2026-02-07 20:40:50.018	2026-01-31 20:40:50.019186	\N	\N
37	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg5Mjg4NywiZXhwIjoxNzcwNDk3Njg3fQ.IIyeiulaQaqTcCsWONpU_T8IkkqUD-NVlkQmd7d6P5Q	2026-02-07 20:54:47.447	2026-01-31 20:54:47.448255	\N	\N
38	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg5NDg1MywiZXhwIjoxNzcwNDk5NjUzfQ.DIEDSd79_hkGRYd3O4nIN01Dye2MGRkT145_8NTJkl4	2026-02-07 21:27:33.878	2026-01-31 21:27:33.879224	\N	\N
39	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg5NTQ1NywiZXhwIjoxNzcwNTAwMjU3fQ.l7ATmg9T282xImfC3_sZBcGF64SUq_bq_ARIvO01BDE	2026-02-07 21:37:37.713	2026-01-31 21:37:37.714762	\N	\N
40	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg5NTc5NSwiZXhwIjoxNzcwNTAwNTk1fQ.g5_5TuwXLat24Gz0Pzwd7t5XP7g_7w6pYf7SC8ehiqY	2026-02-07 21:43:15.514	2026-01-31 21:43:15.515608	\N	\N
41	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTg5NjE2NywiZXhwIjoxNzcwNTAwOTY3fQ.2x9rcb2uN5fcxerhlSaQmWchibkCctQlIhWerRp8oDQ	2026-02-07 21:49:27.189	2026-01-31 21:49:27.189586	\N	\N
42	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTkwNDM2MywiZXhwIjoxNzcwNTA5MTYzfQ.PEXpM2YuCVZsHnrCaNxUeEahQtAqvaJaBP2g8bkPgss	2026-02-08 00:06:03.58	2026-02-01 00:06:03.581388	\N	\N
43	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc2OTkwNDU4NCwiZXhwIjoxNzcwNTA5Mzg0fQ.TzCSaosKvsfNB0Vv4pv_VSG3mdNL4qRp9vHSZFHeRvM	2026-02-08 00:09:44.237	2026-02-01 00:09:44.23763	\N	\N
44	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDA1ODYyOSwiZXhwIjoxNzcwNjYzNDI5fQ.n8jxDtgzvaqYElDv8IZWB-8HadQ_dlqZUEw_Blymh2k	2026-02-09 18:57:09.73	2026-02-02 18:57:09.732087	\N	\N
45	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDI0NDI0NiwiZXhwIjoxNzcwODQ5MDQ2fQ.RQBfcMBqP_YpC5m1I4yycRty-PpqgDu9n-nnRJeocAo	2026-02-11 22:30:46.732	2026-02-04 22:30:46.734061	\N	\N
46	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDI0NDY5OSwiZXhwIjoxNzcwODQ5NDk5fQ.opunpW1o1ydbjgFnTIyBDBLS7o7MZ3DfZnpjOkSvPWE	2026-02-11 22:38:19.798	2026-02-04 22:38:19.798839	\N	\N
47	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDI4NzE4OCwiZXhwIjoxNzcwODkxOTg4fQ.DX8TQadJqFqRCSMC7JCd8RMZe5Q0GpSfhyV4wfPhCj0	2026-02-12 10:26:28.397	2026-02-05 10:26:28.398743	\N	\N
48	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDI4NzIyOCwiZXhwIjoxNzcwODkyMDI4fQ.xxNxebEvNvqDvBQaStkTluCgnsMJe848Nn3shyg-was	2026-02-12 10:27:08.704	2026-02-05 10:27:08.70505	\N	\N
49	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDI4Nzk1MSwiZXhwIjoxNzcwODkyNzUxfQ.SjlZHYodkKUigH1iMY_p-iU7PpqGqx_BPhPrT1g5-q8	2026-02-12 10:39:11.353	2026-02-05 10:39:11.370277	\N	\N
51	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDI4ODM3NSwiZXhwIjoxNzcwODkzMTc1fQ.CTPPNyFnb7fqTA_54OwysQw7MjOkqJMj-ooj-T_wGn0	2026-02-12 10:46:15.342	2026-02-05 10:46:15.343581	\N	\N
52	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDI4ODU2MCwiZXhwIjoxNzcwODkzMzYwfQ.3ESxIy9G_OD2O9oOcu33Z5XL3s4fJsTKYIH33aQXWto	2026-02-12 10:49:20.699	2026-02-05 10:49:20.700745	\N	\N
57	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDI5MjExOCwiZXhwIjoxNzcwODk2OTE4fQ.NWk9cpYk2GXsTsDHHwY8Y9qmY-Acu-L1L9iwJ9Ho-SU	2026-02-12 11:48:38.367	2026-02-05 11:48:38.368422	\N	\N
58	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDI5MzAxMCwiZXhwIjoxNzcwODk3ODEwfQ.11ENcfZf6PobNmZekG4clRhdWOx82sPUJaqyVVfYCPk	2026-02-12 12:03:30.492	2026-02-05 12:03:30.492633	\N	\N
59	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDUwODY3OCwiZXhwIjoxNzcxMTEzNDc4fQ.Z8GxRb3AHJi9w1sfUd5SSCYrzT9ZYpVOqiTBlGGuQTw	2026-02-14 23:57:58.201	2026-02-07 23:57:58.203026	\N	\N
60	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDg0ODk5MywiZXhwIjoxNzcxNDUzNzkzfQ.WxPySDLhE9MgYgyhdk0vhsHaW-eilLc5oTbgz6gv1a8	2026-02-18 22:29:53.584	2026-02-11 22:29:53.58649	\N	\N
61	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoyLCJlbWFpbCI6ImVtYWlsZm9yYWxsd29ya3MwQGdtYWlsLmNvbSIsImlhdCI6MTc3MDg0OTA1NCwiZXhwIjoxNzcxNDUzODU0fQ.MY0t2N8lhxUxcrCCcTroOWT7LXGn4BbVPpVpwqc4zjM	2026-02-18 22:30:54.243	2026-02-11 22:30:54.244935	\N	\N
\.


--
-- Data for Name: slow_speed_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.slow_speed_sessions (id, customer_id, customer_email, subscription_id, iccid, imei, mdn, issue_onset, modem_moved, refresh_performed, refresh_started_at, refresh_completed_at, sync_expires_at, session_state, outdoor_test_result, speeds_improved, escalated, escalation_ticket_id, created_at, updated_at) FROM stdin;
1	\N	annharrell77@gmail.com	Azz4loV06FDNnKdqH	89148000008283025579	990016890154147	\N	just_started	\N	t	2026-02-04 00:51:09.232	\N	2026-02-04 02:51:09.232	syncing	\N	\N	f	\N	2026-02-04 00:51:09.112081	2026-02-04 00:57:44.403
2	\N	annharrell77@gmail.com	Azz4loV06FDNnKdqH	89148000008283025579	990016890154147	\N	ongoing	\N	f	\N	\N	\N	completed	improved	\N	f	\N	2026-02-04 01:14:08.227056	2026-02-04 01:14:35.85
3	\N	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	89148000008282868771	990016890150921	\N	ongoing	\N	f	\N	\N	\N	escalated	same	\N	t	\N	2026-02-12 19:52:21.687007	2026-02-12 19:52:29.967
\.


--
-- Data for Name: subscription_pauses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription_pauses (id, customer_id, customer_email, subscription_id, chargebee_customer_id, pause_duration_months, pause_date, resume_date, travel_addon_added, travel_addon_item_price_id, status, created_at, updated_at, pause_reason, pause_reason_details) FROM stdin;
2	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	2	2026-02-07 00:00:00	2026-04-07 00:00:00	f	Updated-Nomad-Travel-1995-USD-Monthly	active	2026-02-06 21:41:53.227877	2026-02-06 21:41:53.227877	\N	\N
3	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	2	2026-02-06 00:00:00	2026-04-16 00:00:00	f	Updated-Nomad-Travel-1995-USD-Monthly	active	2026-02-06 21:57:03.173657	2026-02-06 21:57:03.173657	\N	\N
4	2	emailforallworks0@gmail.com	AzydUnV8Uf1Wa3vw0	30183	1	2026-02-06 00:00:00	2026-03-16 00:00:00	f	Updated-Nomad-Travel-1995-USD-Monthly	active	2026-02-06 22:30:48.242567	2026-02-06 22:30:48.242567	financial	I am relocating
\.


--
-- Name: addon_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.addon_logs_id_seq', 1, true);


--
-- Name: admin_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_users_id_seq', 1, true);


--
-- Name: cancellation_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cancellation_requests_id_seq', 18, true);


--
-- Name: customer_feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_feedback_id_seq', 1, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_id_seq', 9, true);


--
-- Name: escalation_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.escalation_tickets_id_seq', 1, false);


--
-- Name: external_api_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.external_api_logs_id_seq', 548, true);


--
-- Name: otp_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otp_codes_id_seq', 24, true);


--
-- Name: plan_change_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plan_change_verifications_id_seq', 9, true);


--
-- Name: portal_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.portal_settings_id_seq', 4, true);


--
-- Name: sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sessions_id_seq', 61, true);


--
-- Name: slow_speed_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.slow_speed_sessions_id_seq', 3, true);


--
-- Name: subscription_pauses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.subscription_pauses_id_seq', 4, true);


--
-- Name: addon_logs addon_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_logs
    ADD CONSTRAINT addon_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_unique UNIQUE (email);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: cancellation_requests cancellation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_pkey PRIMARY KEY (id);


--
-- Name: customer_feedback customer_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_feedback
    ADD CONSTRAINT customer_feedback_pkey PRIMARY KEY (id);


--
-- Name: customers customers_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_unique UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: escalation_tickets escalation_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_tickets
    ADD CONSTRAINT escalation_tickets_pkey PRIMARY KEY (id);


--
-- Name: escalation_tickets escalation_tickets_ticket_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_tickets
    ADD CONSTRAINT escalation_tickets_ticket_id_unique UNIQUE (ticket_id);


--
-- Name: external_api_logs external_api_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_api_logs
    ADD CONSTRAINT external_api_logs_pkey PRIMARY KEY (id);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);


--
-- Name: plan_change_verifications plan_change_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_change_verifications
    ADD CONSTRAINT plan_change_verifications_pkey PRIMARY KEY (id);


--
-- Name: portal_settings portal_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_settings
    ADD CONSTRAINT portal_settings_key_unique UNIQUE (key);


--
-- Name: portal_settings portal_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_settings
    ADD CONSTRAINT portal_settings_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_unique UNIQUE (token);


--
-- Name: slow_speed_sessions slow_speed_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slow_speed_sessions
    ADD CONSTRAINT slow_speed_sessions_pkey PRIMARY KEY (id);


--
-- Name: subscription_pauses subscription_pauses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pauses
    ADD CONSTRAINT subscription_pauses_pkey PRIMARY KEY (id);


--
-- Name: addon_logs addon_logs_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_logs
    ADD CONSTRAINT addon_logs_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: cancellation_requests cancellation_requests_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_feedback customer_feedback_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_feedback
    ADD CONSTRAINT customer_feedback_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: escalation_tickets escalation_tickets_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_tickets
    ADD CONSTRAINT escalation_tickets_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: otp_codes otp_codes_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: plan_change_verifications plan_change_verifications_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_change_verifications
    ADD CONSTRAINT plan_change_verifications_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sessions sessions_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: slow_speed_sessions slow_speed_sessions_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slow_speed_sessions
    ADD CONSTRAINT slow_speed_sessions_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: subscription_pauses subscription_pauses_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pauses
    ADD CONSTRAINT subscription_pauses_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- PostgreSQL database dump complete
--

\unrestrict rNBK8As2ybNMJgDm6fq8LSnV2N0mDqNhFnUQnVeOjiv63nefgYbEKLuuQ8BEDA4

