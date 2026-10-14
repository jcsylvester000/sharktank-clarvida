// Domain types for the Clarvida Referral Co-Pilot prototype.
// Each interface maps to a production Laravel table (see Build Breakdown › Data Model).

export type Role =
  | "ambassador"
  | "amb_lead"
  | "intake"
  | "intake_sup"
  | "program_mgr"
  | "marketing"
  | "compliance"
  | "admin"
  | "partner" // ACC-10: external referral partner (partner hub only)
  | "judge"; // ACC-11: Shark Tank guest judge (read-only, aggregate)

export type Zone = "Outreach" | "Care" | "Both" | "Identity" | "External" | "Public" | "Demo";
export type DataClass = "C0" | "C1" | "C2" | "C3" | "C4";

export type Stage = "New" | "Engaged" | "Active" | "Quiet" | "At risk" | "Dormant";
export type Capacity = "Open" | "Limited" | "Waitlist" | "Closed";
export type ProgramFamily = "child" | "adult" | "all";

export type OrgType =
  | "Child welfare"
  | "Health plan care managers"
  | "School district"
  | "Hospital"
  | "Primary care"
  | "Juvenile justice"
  | "Child advocacy"
  | "Pediatrics"
  | "Crisis services"
  | "Faith / community"
  | "Early childhood"
  | "Community nonprofit"
  | "Public health";

export type SourceType =
  | "School"
  | "Child welfare"
  | "Hospital / clinician"
  | "Health plan care manager"
  | "Court / legal"
  | "Primary care"
  | "Community / faith"
  | "Family / self"
  | "Other";

export type ReferralStatus =
  | "New"
  | "Contacted"
  | "Accepted"
  | "Hold"
  | "Redirected"
  | "Intake scheduled"
  | "Intake completed"
  | "Closed";

export type Tier1Status = "Received" | "In outreach" | "Contacted" | "On hold" | "Redirected" | "Closed";
export type Channel = "Web form" | "Phone" | "Fax" | "Statewide platform" | "Walk-in";

export interface User {
  id: string;
  name: string;
  initials: string;
  role: Role;
  scope: string[]; // states, or ["ALL"]
  office: string;
  mfa: boolean;
  active: boolean;
  // v3 account profile (all synthetic; .example domains only)
  accId?: string; // ACC-01..ACC-11
  email?: string;
  firstName?: string;
  title?: string;
  territory?: string; // plain-language territory line
  counties?: string[];
  managerId?: string;
  orgId?: string; // partner's organization
  orgName?: string;
  readOnly?: boolean; // guest judge: can look, cannot change shared data
  phone?: string;
  avatarTone?: "teal" | "sky" | "navy" | "amber";
}

// ---------------------------------------------------------------- v3 accounts (FT-001..FT-014)
export interface Credential {
  userId: string;
  salt: string;
  hash: string; // sha256(salt + password), never the password
  failed: number;
  lockedUntil: number | null;
  changedAt: number;
}

export type NotifType = "escalation" | "handoff" | "approval" | "capacity" | "task" | "event" | "system";
export type NotifChannel = "in-app" | "email" | "digest" | "off";

export interface SessionRecord {
  id: string;
  device: string;
  place: string;
  startedAt: number;
  lastSeenAt: number;
  current?: boolean;
  revoked?: boolean;
}

export interface TrustedDevice {
  deviceId: string;
  label: string;
  addedAt: number;
  expiresAt: number;
}

export interface AccountState {
  onboardedAt: number | null;
  pledgeAt: number | null;
  prefs: Record<NotifType, NotifChannel>;
  mondayBriefing: boolean;
  language: "en" | "es";
  lastPage: string | null;
  lastSignInAt: number | null; // the sign-in before the current one
  lastSignInFrom: string | null;
  currentSignInAt: number | null;
  sessions: SessionRecord[];
  devices: TrustedDevice[];
  filters: Record<string, unknown>;
  dismissed: string[]; // dismissed alerts / tips
  snoozed: Record<string, number>; // taskId -> until
}

export interface ResetToken {
  token: string;
  userId: string;
  expiresAt: number;
  usedAt: number | null;
}

export type OutboxType = "referrer-notice" | "outreach" | "nurture" | "briefing" | "password-reset" | "security" | "welcome" | "escalation" | "digest";
export interface OutboxMessage {
  id: string;
  at: number;
  type: OutboxType;
  toUserId?: string; // when the recipient has an account
  to: string; // address (always .example)
  toName?: string;
  from: string;
  fromUserId?: string;
  subject: string;
  body: string; // plain text, PHI-free
  sentVia: string; // e.g. "Simulated email (Demo Inbox)" | "Queued in approved CRM (simulated)"
  link?: string;
  linkLabel?: string;
  relatedId?: string;
  readBy: string[];
}

/** Team activity line (FT-044): PHI-free wording, scoped by state. */
export interface ActivityItem {
  id: string;
  at: number;
  actorId: string;
  text: string;
  states: string[]; // which territories may see it ("ALL" = everyone)
  link?: string;
  zone: "Care" | "Outreach" | "Both";
}

export interface Location {
  id: string;
  name: string;
  state: string;
  timezone: string;
}

export interface Program {
  id: string;
  state: string;
  office: string;
  name: string; // internal name
  partnerLabel: string; // generic, partner-facing (BR12)
  family: ProgramFamily;
  ageMin: number;
  ageMax: number;
  payers: string;
  counties: string[];
  ownerId: string;
  verifiedAt: number;
  part2: boolean;
  queue: string;
  capacity: Capacity;
  capacityNote: string;
  capacityUpdatedAt: number;
  capacityUpdatedBy: string;
  expectedReopen: string;
  description: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  workEmail?: string;
  workPhone?: string;
  source: string;
  verifiedAt: number | null;
  optOut: boolean;
}

export interface Organization {
  id: string;
  state: string;
  county: string;
  name: string;
  type: OrgType;
  stage: Stage;
  ownerId: string;
  sources: string[];
  identifiers: string;
  distanceMiles: number;
  bearing: number; // degrees from office, for the schematic map
  summary: string;
  bestContactRole: string;
  referrals90d: number;
  lastReferralAt: number | null;
  lastTouchAt: number | null;
  monthly: number[]; // last 6 months of referrals, oldest first
  contacts: Contact[];
}

export type TaskReason = "event" | "quiet" | "new_high_fit" | "thank_you" | "kit" | "visit" | "manual";

export interface Task {
  id: string;
  ownerId: string;
  orgId: string;
  text: string;
  reason: TaskReason;
  minutes: number;
  dueAt: number;
  done: boolean;
  doneAt?: number;
  source: "plan" | "event" | "manual" | "route";
}

export type TouchType = "Visit" | "Call" | "Email" | "Event";
export interface Touch {
  id: string;
  orgId: string;
  byUserId: string;
  type: TouchType;
  note: string;
  at: number;
}

export interface RelationshipEvent {
  id: string;
  state: string;
  date: string; // ISO date
  type: string;
  title: string;
  sourceUrl: string;
  sourceLabel: string;
  summary: string;
  orgIds: string[];
  counties: string[];
  status: "Draft" | "Published";
  confirmedBy: string;
}

export interface StatusEvent {
  at: number;
  from?: ReferralStatus;
  to: ReferralStatus | "Received" | "Contact attempt" | "Routed" | "Consent";
  by: string;
  note?: string;
}

export interface ContactAttempt {
  at: number;
  method: "Phone" | "Voicemail" | "Staff text" | "Email";
  outcome: "Reached guardian" | "Left voicemail" | "No answer" | "Wrong number";
  by: string;
}

export interface ReferrerNotice {
  at: number;
  type: Tier1Status;
  to: string;
  subject: string;
  text: string;
}

export interface Referral {
  id: string;
  state: string;
  county: string;
  programId: string | null;
  queue: string;
  channel: Channel;
  platform?: string;
  partnerCode?: string;
  referrerOrgId: string | null;
  referrerOrgName?: string;
  srcType: SourceType;
  referrerName?: string;
  referrerRole: string;
  referrerEmail?: string;
  referrerPhone?: string;
  age: number;
  coverage: string;
  language: "English" | "Español" | "Other";
  times: string[];
  guardianFirstName: string;
  phone: string;
  voicemailOk?: boolean;
  status: ReferralStatus;
  statusReason?: string;
  redirectTo?: string;
  ownerId?: string;
  receivedAt: number;
  firstContactAt?: number;
  escalatedAt?: number;
  dupOf?: string | null;
  consentAgreement: boolean;
  signedRelease: boolean;
  part2Consent: boolean;
  attempts: ContactAttempt[];
  history: StatusEvent[];
  notices: ReferrerNotice[];
}

export interface PartnerKit {
  id: string;
  code: string;
  orgId: string;
  state: string;
  programIds: string[];
  language: "en" | "es";
  scans: number;
  referrals: number;
  createdBy: string;
  createdAt: number;
}

export interface OutreachDraft {
  id: string;
  orgId: string;
  contactId: string;
  programId: string;
  templateId: string;
  templateVersion: string;
  modelId: string;
  subject: string;
  draftText: string;
  finalText: string;
  editedChars: number;
  approvedBy: string;
  approvedAt: number;
  sendStatus: "Queued in approved CRM (simulated)";
}

export type AIFeature = "AI01" | "AI02" | "AI03" | "AI04" | "AI05" | "AI06";
export interface AILogEntry {
  id: string;
  at: number;
  userId: string;
  feature: AIFeature;
  templateId: string;
  templateVersion: string;
  modelId: string;
  objectId: string;
  result: "Viewed" | "Generated" | "Approved and queued" | "Edited and approved" | "Blocked" | "Answered" | "Refused";
  blockedCategory?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  status: "Approved" | "In review";
  approvedBy: string;
  updatedAt: number;
  allowedInputs: string;
  body: string;
}

export interface Evaluation {
  suite: string;
  cases: number;
  passed: number;
  threshold: number; // 0..1
}

export interface AuditEvent {
  id: string;
  at: number;
  actorId: string;
  actorName: string;
  role: string;
  action: string;
  objectId?: string;
  zone: Zone;
  device: string;
  category?: "blocked" | "export" | "access" | "ai" | "care" | "config" | "sign-in";
}

export interface Notification {
  id: string;
  type?: NotifType;
  toRole?: Role;
  toUserId?: string;
  text: string;
  link: string;
  at: number;
  readBy: string[];
}

export interface RoutingRule {
  id: string;
  state: string;
  counties: string[];
  family: ProgramFamily | "*";
  ages: string;
  queue: string;
  queueLabel: string;
}

export interface SlaConfig {
  state: string;
  targetHours: number;
  stretch: string;
  startHour: number;
  endHour: number;
  timezone: string;
  holidays: string[];
  dueSoonHours: number;
}

export interface PendingChange {
  id: string;
  area: "Routing table" | "Consent rules" | "Response targets";
  change: string;
  proposedBy: string;
  proposedAt: number;
  status: "Waiting for second approver" | "Approved" | "Rejected";
  decidedBy?: string;
  decidedAt?: number;
  payload?: { kind: "routing"; ruleId: string; counties: string[] } | { kind: "sla"; state: string; targetHours: number };
}

export interface Vendor {
  vendor: string;
  use: string;
  phi: string;
  baa: string;
  status: string;
}

export interface FunnelRow {
  src: SourceType;
  refs: number;
  contacted: number;
  scheduled: number;
  completed: number;
  closed: number;
}

export interface WeeklyPoint {
  week: string; // label e.g. "Jul 20"
  referred: number;
  connected: number;
}

export interface DemoState {
  guideOn: boolean;
  step: number;
  presenter: boolean;
  clockMode: "demo" | "business";
  idleMinutes: number;
  showBrdTags: boolean;
  lastPartnerRef?: string;
  soundOn: boolean;
}

export interface RoiAssumptions {
  referralsPerMonth: number;
  lostShare: number;
  reduction: number;
  conversion: number;
  ambassadors: number;
  researchHours: number;
  researchReduction: number;
}

export interface Session {
  userId: string;
  since: number;
  sessionId?: string;
  method?: "password" | "sso" | "guided" | "switch";
  mfaSkipped?: boolean; // remembered device or guided demo
}

export interface DB {
  version: number;
  seededAt: number;
  refSeq: number;
  session: Session | null;
  users: User[];
  locations: Location[];
  programs: Program[];
  orgs: Organization[];
  gatekeeperWeights: Record<string, Partial<Record<OrgType, number>>>;
  tasks: Task[];
  touches: Touch[];
  events: RelationshipEvent[];
  referrals: Referral[];
  kits: PartnerKit[];
  drafts: OutreachDraft[];
  ailog: AILogEntry[];
  prompts: PromptTemplate[];
  evals: Evaluation[];
  audit: AuditEvent[];
  notifications: Notification[];
  routing: RoutingRule[];
  sla: SlaConfig[];
  pending: PendingChange[];
  vendors: Vendor[];
  funnel: FunnelRow[];
  weekly: WeeklyPoint[];
  sendCounts: Record<string, number>; // userId -> sends this week
  orgSendCounts: Record<string, number>; // orgId -> sends this week
  sendCap: number;
  orgSendCap: number;
  demo: DemoState;
  roi: RoiAssumptions;
  ask: string; // funding ask text
  live?: LiveState; // present only in the Live sandbox
  // v3
  credentials: Record<string, Credential>;
  accounts: Record<string, AccountState>;
  resetTokens: ResetToken[];
  outbox: OutboxMessage[];
  activity: ActivityItem[];
  visits: Visit[];
  nurture: NurtureEnrollment[];
  ideas: ContentIdea[];
}

// ---------------------------------------------------------------- v3 outreach additions (B3)
/** FT-175: a location-confirmed (or address) visit check-in. One reading at check-in time; never a location history. */
export interface Visit {
  id: string;
  orgId: string;
  userId: string;
  at: number;
  method: "location" | "address" | "demo";
  distanceMi: number | null; // distance from the organization at check-in, when location was shared
  outcome: string;
}

export type NurtureStepKind = "Intro email" | "Resource" | "Webinar invite" | "Check-in";
export interface NurtureStep {
  kind: NurtureStepKind;
  day: number; // days after enrollment
  subject: string;
  status: "Scheduled" | "Waiting for approval" | "Sent" | "Skipped";
  sentAt?: number;
  approvedBy?: string;
}
/** FT-062, FT-063: nurture journey enrollment with engagement signals and a warm score. */
export interface NurtureEnrollment {
  id: string;
  orgId: string;
  ownerId: string;
  template: "Clinic intro" | "School intro" | "Agency re-engage";
  programId: string;
  enrolledAt: number;
  steps: NurtureStep[];
  signals: { kind: "Opened" | "Clicked" | "Downloaded" | "Registered" | "Replied"; at: number; step: NurtureStepKind }[];
  warmScore: number;
  status: "Active" | "Warm: call now" | "Completed" | "Paused";
  firstApproved: boolean;
  handedOffAt?: number;
}

/** FT-064: content and webinar idea that marketing approves into a calendar. */
export interface ContentIdea {
  id: string;
  audience: "Schools" | "Clinics" | "Faith and community" | "Child welfare";
  title: string;
  whyNow: string;
  format: "Webinar" | "One-pager" | "Email" | "Event";
  status: "Suggested" | "Approved";
  scheduledFor?: string;
  approvedBy?: string;
}

// ---------------------------------------------------------------- Live sandbox (simulation)
export type LiveFeedKind = "referral" | "intake" | "outreach" | "ai" | "capacity" | "event" | "system";

/** One line in the live activity feed. `text` may name referral IDs (Care roles only); `publicText` is counts-only for everyone else. Never holds client names, phones or ages. */
export interface LiveFeedItem {
  id: string;
  at: number;
  kind: LiveFeedKind;
  zone: "Care" | "Outreach" | "Both";
  text: string;
  publicText: string;
  link?: string;
  actor: string;
}

export type PlanOp = "route" | "attempt" | "accept" | "hold" | "redirect" | "close" | "schedule" | "complete";

export interface PlanStep {
  at: number;
  op: PlanOp;
  arg?: string; // outcome, reason or redirect target
}

/** What a simulated coordinator will do with one referral, decided when it arrives. */
export interface ReferralPlan {
  owner: string; // simulated user id
  steps: PlanStep[];
}

export interface LiveState {
  clock: { anchorReal: number; anchorSim: number; speed: number; paused: boolean };
  startedAt: number; // simulated time the sandbox started
  lastTick: number; // simulated time the engine last ran
  rng: number; // seeded random state, so a run can be replayed in tests
  simUserIds: string[];
  next: Record<string, number>; // generator name -> simulated time it fires next
  plans: Record<string, ReferralPlan | null>; // referral id -> plan (null = left for the people using the sandbox)
  feed: LiveFeedItem[];
  totals: { arrivals: number; simActions: number; aiDrafts: number; replies: number };
}
