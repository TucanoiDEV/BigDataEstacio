import type { ApplicationStatus, JobStatus, OrgVerificationStatus } from "@/generated/prisma/browser";
import { StatusBadge } from "@/components/common/states";
import { APPLICATION_STATUS_LABEL, JOB_STATUS_LABEL, ORG_STATUS_LABEL } from "@/lib/constants";

const APP_TONE: Record<ApplicationStatus, Parameters<typeof StatusBadge>[0]["tone"]> = {
  SUBMITTED: "blue",
  IN_REVIEW: "amber",
  INTERVIEW: "violet",
  APPROVED: "green",
  REJECTED: "red",
  WITHDRAWN: "gray",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <StatusBadge tone={APP_TONE[status]}>{APPLICATION_STATUS_LABEL[status]}</StatusBadge>;
}

const JOB_TONE: Record<JobStatus, Parameters<typeof StatusBadge>[0]["tone"]> = {
  DRAFT: "gray",
  PENDING_REVIEW: "amber",
  ACTIVE: "green",
  PAUSED: "blue",
  CLOSED: "gray",
  REMOVED: "red",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <StatusBadge tone={JOB_TONE[status]}>{JOB_STATUS_LABEL[status]}</StatusBadge>;
}

const ORG_TONE: Record<OrgVerificationStatus, Parameters<typeof StatusBadge>[0]["tone"]> = {
  PENDING: "amber",
  VERIFIED: "green",
  REJECTED: "red",
  SUSPENDED: "red",
};

export function OrgStatusBadge({ status }: { status: OrgVerificationStatus }) {
  return <StatusBadge tone={ORG_TONE[status]}>{ORG_STATUS_LABEL[status]}</StatusBadge>;
}
