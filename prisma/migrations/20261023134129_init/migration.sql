-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PRIVATE', 'VERIFIED_COMPANIES');

-- CreateEnum
CREATE TYPE "WorkModel" AS ENUM ('REMOTE', 'HYBRID', 'ON_SITE');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CLT', 'PJ', 'INTERNSHIP', 'TEMPORARY', 'APPRENTICE', 'FREELANCE');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('INTERN', 'JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'MANAGER', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('RESUME', 'PHOTO', 'ORG_LOGO');

-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrgVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'RECRUITER', 'VIEWER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'CLOSED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'INTERVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AlertFrequency" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPLICATION_STATUS', 'APPLICATION_RECEIVED', 'JOB_ALERT', 'ORG_STATUS', 'JOB_MODERATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('COOKIES', 'TERMS_OF_USE', 'PRIVACY_NOTICE', 'PRODUCT_NEWS');

-- CreateEnum
CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'EXPORT', 'DELETION', 'ANONYMIZATION', 'CONSENT_REVOCATION', 'OPPOSITION', 'INFORMATION');

-- CreateEnum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SCAM', 'PAYMENT_REQUEST', 'MISLEADING', 'DISCRIMINATORY', 'DUPLICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'CONTAINED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "StatSource" AS ENUM ('NOVO_CAGED', 'RAIS', 'IBGE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "StatDatasetStatus" AS ENUM ('STAGED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TerritoryLevel" AS ENUM ('BR', 'REGION', 'UF', 'MUNICIPALITY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfaSecretEnc" TEXT,
    "mfaEnabledAt" TIMESTAMP(3),
    "mfaLastCounter" INTEGER,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mfaVerifiedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "about" TEXT,
    "city" TEXT,
    "state" CHAR(2),
    "phone" TEXT,
    "desiredTitle" TEXT,
    "desiredWorkModels" "WorkModel"[],
    "desiredContractTypes" "ContractType"[],
    "desiredSeniority" "Seniority",
    "desiredSalaryMin" INTEGER,
    "desiredSectors" TEXT[],
    "openToRelocation" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PRIVATE',
    "showEmailToCompanies" BOOLEAN NOT NULL DEFAULT true,
    "showPhoneToCompanies" BOOLEAN NOT NULL DEFAULT false,
    "recommendationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "photoFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "city" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "inProgress" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileSkill" (
    "profileId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "ProfileSkill_pkey" PRIMARY KEY ("profileId","skillId")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "kind" "FileKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING',
    "scanDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "website" TEXT,
    "contactEmail" TEXT NOT NULL,
    "description" TEXT,
    "sector" TEXT,
    "sizeRange" TEXT,
    "city" TEXT,
    "state" CHAR(2),
    "logoFileId" TEXT,
    "verificationStatus" "OrgVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMembership" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgInvitation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "benefits" TEXT,
    "sector" TEXT NOT NULL,
    "seniority" "Seniority" NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "workModel" "WorkModel" NOT NULL,
    "city" TEXT,
    "state" CHAR(2),
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryVisible" BOOLEAN NOT NULL DEFAULT true,
    "positions" INTEGER NOT NULL DEFAULT 1,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "moderationNotes" TEXT,
    "fraudSignals" TEXT[],
    "searchText" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSkill" (
    "jobId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "JobSkill_pkey" PRIMARY KEY ("jobId","skillId")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "resumeId" TEXT,
    "coverLetter" TEXT,
    "profileSnapshot" JSONB NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatusChange" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "changedById" TEXT,
    "messageToCandidate" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedJob" (
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("userId","jobId")
);

-- CreateTable
CREATE TABLE "JobAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "frequency" "AlertFrequency" NOT NULL DEFAULT 'WEEKLY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPreference" (
    "userId" TEXT NOT NULL,
    "emailApplicationUpdates" BOOLEAN NOT NULL DEFAULT true,
    "emailJobAlerts" BOOLEAN NOT NULL DEFAULT true,
    "emailProductNews" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousIdHash" TEXT,
    "kind" "ConsentKind" NOT NULL,
    "version" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "userId" TEXT,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "type" "PrivacyRequestType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "handledById" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "jobId" TEXT,
    "orgId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "orgId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "containedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "personalDataAffected" BOOLEAN NOT NULL DEFAULT false,
    "dataCategories" TEXT[],
    "estimatedSubjects" INTEGER,
    "riskAssessment" TEXT,
    "anpdNotificationRequired" BOOLEAN,
    "anpdNotifiedAt" TIMESTAMP(3),
    "subjectsNotifiedAt" TIMESTAMP(3),
    "actionsTaken" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatTerritory" (
    "code" TEXT NOT NULL,
    "level" "TerritoryLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "ufCode" TEXT,
    "ufAbbr" CHAR(2),
    "regionName" TEXT,

    CONSTRAINT "StatTerritory_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "StatClassification" (
    "system" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "StatClassification_pkey" PRIMARY KEY ("system","code")
);

-- CreateTable
CREATE TABLE "DataImport" (
    "id" TEXT NOT NULL,
    "source" "StatSource" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "files" JSONB NOT NULL,
    "rowsRead" INTEGER NOT NULL DEFAULT 0,
    "rowsValid" INTEGER NOT NULL DEFAULT 0,
    "rowsRejected" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "pipelineVersion" TEXT NOT NULL,

    CONSTRAINT "DataImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatDataset" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "source" "StatSource" NOT NULL,
    "title" TEXT NOT NULL,
    "referenceStart" DATE NOT NULL,
    "referenceEnd" DATE NOT NULL,
    "sourcePublishedAt" DATE,
    "sourceUrl" TEXT NOT NULL,
    "methodologyUrl" TEXT NOT NULL,
    "methodologyNotes" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "status" "StatDatasetStatus" NOT NULL DEFAULT 'STAGED',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatEmploymentFlow" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "territoryLevel" "TerritoryLevel" NOT NULL,
    "territoryCode" TEXT NOT NULL,
    "sectorCode" TEXT NOT NULL,
    "occupationCode" TEXT NOT NULL,
    "admissions" INTEGER NOT NULL,
    "separations" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "avgAdmissionWage" DECIMAL(12,2),
    "wageSampleSize" INTEGER,

    CONSTRAINT "StatEmploymentFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatEmploymentStock" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "territoryLevel" "TerritoryLevel" NOT NULL,
    "territoryCode" TEXT NOT NULL,
    "sectorCode" TEXT NOT NULL,
    "occupationCode" TEXT NOT NULL,
    "activeLinks" INTEGER NOT NULL,
    "avgWage" DECIMAL(12,2),
    "wageSampleSize" INTEGER,

    CONSTRAINT "StatEmploymentStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_purpose_idx" ON "VerificationToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_userId_idx" ON "MfaRecoveryCode"("userId");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_photoFileId_key" ON "CandidateProfile"("photoFileId");

-- CreateIndex
CREATE INDEX "Experience_profileId_idx" ON "Experience"("profileId");

-- CreateIndex
CREATE INDEX "Education_profileId_idx" ON "Education"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE INDEX "ProfileSkill_skillId_idx" ON "ProfileSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "StoredFile_ownerUserId_idx" ON "StoredFile"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Resume_fileId_key" ON "Resume"("fileId");

-- CreateIndex
CREATE INDEX "Resume_profileId_idx" ON "Resume"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_cnpj_key" ON "Organization"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_logoFileId_key" ON "Organization"("logoFileId");

-- CreateIndex
CREATE INDEX "Organization_verificationStatus_idx" ON "Organization"("verificationStatus");

-- CreateIndex
CREATE INDEX "OrgMembership_userId_idx" ON "OrgMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMembership_orgId_userId_key" ON "OrgMembership"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvitation_tokenHash_key" ON "OrgInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "OrgInvitation_orgId_idx" ON "OrgInvitation"("orgId");

-- CreateIndex
CREATE INDEX "OrgInvitation_email_idx" ON "OrgInvitation"("email");

-- CreateIndex
CREATE INDEX "Job_status_publishedAt_idx" ON "Job"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Job_orgId_status_idx" ON "Job"("orgId", "status");

-- CreateIndex
CREATE INDEX "Job_state_city_idx" ON "Job"("state", "city");

-- CreateIndex
CREATE INDEX "Job_workModel_idx" ON "Job"("workModel");

-- CreateIndex
CREATE INDEX "Job_contractType_idx" ON "Job"("contractType");

-- CreateIndex
CREATE INDEX "Job_seniority_idx" ON "Job"("seniority");

-- CreateIndex
CREATE INDEX "Job_sector_idx" ON "Job"("sector");

-- CreateIndex
CREATE INDEX "JobSkill_skillId_idx" ON "JobSkill"("skillId");

-- CreateIndex
CREATE INDEX "Application_candidateUserId_idx" ON "Application"("candidateUserId");

-- CreateIndex
CREATE INDEX "Application_jobId_status_idx" ON "Application"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_candidateUserId_key" ON "Application"("jobId", "candidateUserId");

-- CreateIndex
CREATE INDEX "ApplicationStatusChange_applicationId_createdAt_idx" ON "ApplicationStatusChange"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedJob_jobId_idx" ON "SavedJob"("jobId");

-- CreateIndex
CREATE INDEX "JobAlert_userId_idx" ON "JobAlert"("userId");

-- CreateIndex
CREATE INDEX "JobAlert_active_frequency_idx" ON "JobAlert"("active", "frequency");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE INDEX "ConsentRecord_anonymousIdHash_idx" ON "ConsentRecord"("anonymousIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyRequest_protocol_key" ON "PrivacyRequest"("protocol");

-- CreateIndex
CREATE INDEX "PrivacyRequest_status_dueAt_idx" ON "PrivacyRequest"("status", "dueAt");

-- CreateIndex
CREATE INDEX "PrivacyRequest_userId_idx" ON "PrivacyRequest"("userId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "SecurityIncident_status_idx" ON "SecurityIncident"("status");

-- CreateIndex
CREATE INDEX "StatTerritory_level_idx" ON "StatTerritory"("level");

-- CreateIndex
CREATE INDEX "StatTerritory_ufCode_idx" ON "StatTerritory"("ufCode");

-- CreateIndex
CREATE INDEX "DataImport_source_startedAt_idx" ON "DataImport"("source", "startedAt");

-- CreateIndex
CREATE INDEX "StatDataset_source_status_idx" ON "StatDataset"("source", "status");

-- CreateIndex
CREATE INDEX "StatEmploymentFlow_territoryLevel_territoryCode_period_idx" ON "StatEmploymentFlow"("territoryLevel", "territoryCode", "period");

-- CreateIndex
CREATE INDEX "StatEmploymentFlow_sectorCode_period_idx" ON "StatEmploymentFlow"("sectorCode", "period");

-- CreateIndex
CREATE UNIQUE INDEX "StatEmploymentFlow_datasetId_period_territoryLevel_territor_key" ON "StatEmploymentFlow"("datasetId", "period", "territoryLevel", "territoryCode", "sectorCode", "occupationCode");

-- CreateIndex
CREATE INDEX "StatEmploymentStock_territoryLevel_territoryCode_year_idx" ON "StatEmploymentStock"("territoryLevel", "territoryCode", "year");

-- CreateIndex
CREATE UNIQUE INDEX "StatEmploymentStock_datasetId_year_territoryLevel_territory_key" ON "StatEmploymentStock"("datasetId", "year", "territoryLevel", "territoryCode", "sectorCode", "occupationCode");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSkill" ADD CONSTRAINT "ProfileSkill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSkill" ADD CONSTRAINT "ProfileSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInvitation" ADD CONSTRAINT "OrgInvitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInvitation" ADD CONSTRAINT "OrgInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSkill" ADD CONSTRAINT "JobSkill_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSkill" ADD CONSTRAINT "JobSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusChange" ADD CONSTRAINT "ApplicationStatusChange_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusChange" ADD CONSTRAINT "ApplicationStatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAlert" ADD CONSTRAINT "JobAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPreference" ADD CONSTRAINT "CommunicationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatDataset" ADD CONSTRAINT "StatDataset_importId_fkey" FOREIGN KEY ("importId") REFERENCES "DataImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatEmploymentFlow" ADD CONSTRAINT "StatEmploymentFlow_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "StatDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatEmploymentStock" ADD CONSTRAINT "StatEmploymentStock_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "StatDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
