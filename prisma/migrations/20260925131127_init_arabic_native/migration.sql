-- CreateEnum
CREATE TYPE "SafaEntity" AS ENUM ('FZE', 'INC', 'CHEMPLAX', 'GROUP');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('AED', 'USD', 'EUR', 'GBP');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CEO', 'MD', 'AGENT_OWNER', 'TEAM_MEMBER', 'CONTRACTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "AgentTier" AS ENUM ('ORCHESTRATOR', 'EXECUTIVE', 'FUNCTIONAL');

-- CreateEnum
CREATE TYPE "AgentBranch" AS ENUM ('EXECUTIVE', 'FINANCE', 'TECHNOLOGY', 'COMMERCIAL', 'MARKETING', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "AgentRunKind" AS ENUM ('DAILY', 'MANDATED', 'EVENT');

-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('DELETE_TASK', 'NOTIFY_USER', 'LOG_RAID_CRITICAL', 'POST_TO_SENSITIVE_CHANNEL', 'READ_RESTRICTED_DOCUMENT', 'EXTERNAL_COMMUNICATION', 'PARTNER_LANGUAGE', 'IP_DISCLOSURE', 'TIER_CHANGE', 'REGISTRY_CHANGE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTE_FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReviewGate" AS ENUM ('BLOCK', 'ANNOTATE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_FLIGHT', 'AT_RISK', 'BLOCKED', 'COMPLETE', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "RagStatus" AS ENUM ('GREEN', 'AMBER', 'RED', 'UNSET');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "RaidKind" AS ENUM ('RISK', 'ASSUMPTION', 'ISSUE', 'DEPENDENCY');

-- CreateEnum
CREATE TYPE "RaidStatus" AS ENUM ('OPEN', 'MITIGATING', 'CLOSED');

-- CreateEnum
CREATE TYPE "RaidSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RaidProbability" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('PITCH_DECK', 'BUSINESS_PLAN', 'FINANCIAL_MODEL', 'INVESTOR_UPDATE', 'TERM_SHEET', 'CONTRACT', 'LOI', 'NDA', 'REGULATORY_DOSSIER', 'SCIENTIFIC_MEMO', 'SOP', 'HSE_REPORT', 'BOARD_PACK', 'LEGAL_OPINION', 'POLICY', 'GENERAL');

-- CreateEnum
CREATE TYPE "IpSensitivity" AS ENUM ('PUBLIC', 'INTERNAL', 'COMMERCIAL_SENSITIVE', 'IP_CRITICAL', 'INVESTOR_RESTRICTED');

-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('STAFF', 'SUPPLIER', 'CONTRACTOR', 'CONSULTANT', 'LAWYER', 'ACCOUNTANT', 'AGENCY', 'INVESTOR', 'BANKER', 'PARTNER', 'GOVERNMENT', 'ACADEMIC', 'JOURNALIST', 'OTHER');

-- CreateEnum
CREATE TYPE "InteractionKind" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'MESSAGE', 'NOTE', 'PROPOSAL', 'CONTRACT', 'PAYMENT', 'SAMPLE_SENT', 'SAMPLE_RECEIVED', 'DUE_DILIGENCE');

-- CreateEnum
CREATE TYPE "InvestorStage" AS ENUM ('IDENTIFIED', 'INTRODUCED', 'FIRST_MEETING', 'DEEP_DIVE', 'DD', 'IC_REVIEW', 'TERM_SHEET', 'CLOSING', 'CLOSED', 'PASSED', 'STALLED');

-- CreateEnum
CREATE TYPE "InvestorArchetype" AS ENUM ('REGIONAL_VC', 'CORPORATE_VENTURE', 'SOVEREIGN_DEV', 'STRATEGIC', 'FAMILY_OFFICE', 'GRANT_FUND', 'ANGEL');

-- CreateEnum
CREATE TYPE "InvestorAccessTier" AS ENUM ('PUBLIC_ONLY', 'INVESTOR_STANDARD', 'DILIGENCE_FULL');

-- CreateEnum
CREATE TYPE "SourceCategory" AS ENUM ('PRIOR_ART', 'PATENT', 'RESEARCH_PAPER', 'INDUSTRY_REPORT', 'NEWS_ARTICLE', 'WEB_SCREENSHOT', 'COMPETITOR_INTEL', 'REGULATORY_REFERENCE', 'REFERENCE_DATA', 'OTHER');

-- CreateEnum
CREATE TYPE "DataRoomEntryStatus" AS ENUM ('EXISTS', 'VERIFY', 'CREATE', 'IN_PROGRESS', 'PARTIAL', 'PURSUE', 'PENDING_DECISION', 'PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'BDO_DELIVERABLE', 'MAINTAIN', 'FORMALIZE');

-- CreateEnum
CREATE TYPE "HumanDependencyStatus" AS ENUM ('NONE', 'WAITING_ON_HUMAN', 'IN_PROGRESS', 'UNBLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ActivityEventKind" AS ENUM ('DATA_ROOM_ENTRY_SHIPPED', 'DOCUMENT_UPLOADED', 'CHANNEL_MESSAGE_POSTED', 'AGENT_CONSULT_COMPLETED', 'TASK_COMPLETED', 'TASK_BLOCKED', 'RAID_OPENED', 'RAID_ESCALATED', 'RAID_CLOSED', 'AGENT_RUN_STARTED', 'AGENT_RUN_COMPLETED', 'AGENT_RUN_FAILED', 'APPROVAL_REQUESTED', 'APPROVAL_DECIDED', 'INVESTOR_STAGE_CHANGED', 'INVESTOR_TOUCH_LOGGED', 'OPINION_PUSHBACK', 'REPORT_SUBMITTED', 'REPORT_VALIDATED', 'REPORT_APPROVED', 'TIER_CHANGE_REQUESTED', 'TIER_CHANGE_APPLIED', 'PARTNER_ONBOARDED');

-- CreateEnum
CREATE TYPE "ActivityEventSeverity" AS ENUM ('INFO', 'NOTABLE', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('ABU_DHABI', 'DUBAI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('FARM', 'FACTORY', 'COMPANY', 'RECYCLER', 'COLLECTOR');

-- CreateEnum
CREATE TYPE "PartnerSizeClass" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "PartnerTier" AS ENUM ('REGISTERED', 'ACTIVE', 'CERTIFIED', 'ELITE');

-- CreateEnum
CREATE TYPE "PartnerStanding" AS ENUM ('GOOD', 'AT_RISK', 'PAUSED');

-- CreateEnum
CREATE TYPE "ReportPeriodStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VALIDATED', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "WasteStream" AS ENUM ('DATES', 'PITS', 'FRONDS', 'FROND_BASE', 'FIBER', 'OTHER');

-- CreateEnum
CREATE TYPE "WasteFate" AS ENUM ('FEED', 'SOLD', 'RECYCLED', 'BURNED', 'BURIED', 'DUMPED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "QuantitySource" AS ENUM ('CHAT_TEXT', 'VOICE_NOTE', 'IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ApplicationKind" AS ENUM ('AWARD', 'HONOR', 'GRANT', 'MENTION');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'CLAIMED', 'COLLECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('DATES', 'PITS', 'FRONDS', 'FROND_BASE', 'FIBER', 'COMPOST', 'PRODUCTS', 'OTHER');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('REQUEST', 'FEEDBACK', 'IDEA', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('NEW', 'REVIEWED', 'PLANNED', 'DONE', 'DECLINED');

-- CreateEnum
CREATE TYPE "AnnouncementKind" AS ENUM ('DIRECTIVE', 'ADVISORY', 'EVENT', 'SEASON');

-- CreateEnum
CREATE TYPE "ValueChainStage" AS ENUM ('GROWERS_FARMS', 'PROCESSORS_MANUFACTURERS', 'WASTE_COLLECTION', 'TRADERS_IMPORT_EXPORT', 'BUYERS_END_USERS', 'ECOSYSTEM');

-- CreateEnum
CREATE TYPE "DirectoryPriority" AS ENUM ('PRIORITY_1', 'PRIORITY_2', 'PRIORITY_3');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('DIRECTORY', 'CONTACTED', 'ENGAGED', 'ONBOARDING', 'REGISTERED', 'DECLINED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TEAM_MEMBER',
    "title" TEXT,
    "phone" TEXT,
    "entity" "SafaEntity" NOT NULL DEFAULT 'FZE',
    "canAccessAllEntities" BOOLEAN NOT NULL DEFAULT false,
    "whatsappNumber" TEXT,
    "whatsappNotify" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNotifyTaskAssigned" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNotifyAgentPings" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reportsToAgentId" TEXT,
    "canAccessAllAgents" BOOLEAN NOT NULL DEFAULT false,
    "extraAgentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewerForBranches" "AgentBranch"[] DEFAULT ARRAY[]::"AgentBranch"[],

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tier" "AgentTier" NOT NULL,
    "branch" "AgentBranch" NOT NULL,
    "reportsToSlug" TEXT,
    "mission" TEXT NOT NULL,
    "decisionRights" TEXT NOT NULL,
    "responsibilities" TEXT NOT NULL,
    "kpis" TEXT NOT NULL,
    "tools" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "dailyRunBrief" TEXT,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dailyRunEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deployPhase" INTEGER NOT NULL DEFAULT 1,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "kind" "AgentRunKind" NOT NULL,
    "trigger" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "output" TEXT NOT NULL DEFAULT '',
    "stayedSilent" BOOLEAN NOT NULL DEFAULT false,
    "actions" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "cachedTokensIn" INTEGER,
    "modelUsed" TEXT,
    "durationMs" INTEGER,
    "mandatedByAgentId" TEXT,
    "parentRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "kind" "ApprovalKind" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "severity" "ApprovalSeverity" NOT NULL DEFAULT 'MEDIUM',
    "agentId" TEXT NOT NULL,
    "requesterUserId" TEXT,
    "threadId" TEXT,
    "messageId" TEXT,
    "runId" TEXT,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "rejectReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyTheme" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "theme" TEXT NOT NULL,
    "rationale" TEXT,
    "setById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentReview" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requesterAgentId" TEXT,
    "requesterUserId" TEXT,
    "targetRoomSlug" TEXT NOT NULL,
    "targetRefNumber" TEXT NOT NULL,
    "targetEntryId" TEXT,
    "targetStatus" TEXT NOT NULL,
    "targetVersion" TEXT,
    "gate" "ReviewGate" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "allowedBranches" "AgentBranch"[],
    "summary" TEXT NOT NULL,
    "factCheckWarnings" JSONB,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "decisionToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "ownerAgentId" TEXT,
    "entity" "SafaEntity" NOT NULL DEFAULT 'FZE',
    "budget" DECIMAL(14,2),
    "spent" DECIMAL(14,2),
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ordering" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "ragStatus" "RagStatus" NOT NULL DEFAULT 'UNSET',
    "ragNote" TEXT,
    "ragSetById" TEXT,
    "ragSetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isHit" BOOLEAN NOT NULL DEFAULT false,
    "hitOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "phaseId" TEXT,
    "kind" "RaidKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerAgentId" TEXT,
    "ownerUserId" TEXT,
    "raisedByAgentId" TEXT,
    "raisedByUserId" TEXT,
    "status" "RaidStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "RaidSeverity" NOT NULL DEFAULT 'MEDIUM',
    "probability" "RaidProbability" NOT NULL DEFAULT 'LOW',
    "mitigation" TEXT,
    "reviewAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'P2',
    "dueDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimateHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "ownerAgentId" TEXT,
    "assigneeUserId" TEXT,
    "authorUserId" TEXT,
    "authorAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorAgentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'comment',
    "body" TEXT NOT NULL,
    "mentionedAgents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentionedUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDrafting" BOOLEAN NOT NULL DEFAULT false,
    "isFailed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "agentId" TEXT,
    "userId" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "cachedTokensIn" INTEGER,
    "modelUsed" TEXT,
    "externalId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'web',
    "mode" TEXT,
    "toolsUsed" JSONB,
    "attachmentDocIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "url" TEXT,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "notes" TEXT,
    "projectId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "ipSensitivity" "IpSensitivity" NOT NULL DEFAULT 'INTERNAL',
    "entity" "SafaEntity" NOT NULL DEFAULT 'FZE',
    "allowedBranches" "AgentBranch"[] DEFAULT ARRAY[]::"AgentBranch"[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extractedText" TEXT,
    "aiSummary" TEXT,
    "aiTitleSuggestion" TEXT,
    "aiKindSuggestion" "DocumentKind",
    "aiAnalyzedAt" TIMESTAMP(3),
    "aiAnalysisPending" BOOLEAN NOT NULL DEFAULT false,
    "generationSpec" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isLeadership" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "defaultResponderAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMember" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("channelId","userId")
);

-- CreateTable
CREATE TABLE "ChannelAgent" (
    "channelId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelAgent_pkey" PRIMARY KEY ("channelId","agentId")
);

-- CreateTable
CREATE TABLE "ChannelMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorAgentId" TEXT,
    "body" TEXT NOT NULL,
    "mentionedAgents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentionedUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorKind" TEXT NOT NULL,
    "isAutoReply" BOOLEAN NOT NULL DEFAULT false,
    "isDrafting" BOOLEAN NOT NULL DEFAULT false,
    "isFailed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "kind" "ContactKind" NOT NULL DEFAULT 'OTHER',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "recommendedByAgentId" TEXT,
    "recommendationContext" TEXT,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "kind" "InteractionKind" NOT NULL DEFAULT 'NOTE',
    "summary" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" "InvestorArchetype" NOT NULL,
    "stage" "InvestorStage" NOT NULL DEFAULT 'IDENTIFIED',
    "geo" TEXT,
    "ticketMinUsd" DECIMAL(14,2),
    "ticketMaxUsd" DECIMAL(14,2),
    "thesis" TEXT,
    "introSource" TEXT,
    "ownerAgentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stalledAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "passedAt" TIMESTAMP(3),
    "passedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorAccessToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "investorId" TEXT,
    "label" TEXT NOT NULL,
    "tier" "InvestorAccessTier" NOT NULL DEFAULT 'INVESTOR_STANDARD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ndaAcknowledgedAt" TIMESTAMP(3),
    "ndaAcknowledgedName" TEXT,
    "ndaAcknowledgedIp" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvestorAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorContact" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorTouch" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "stageAfter" "InvestorStage" NOT NULL,
    "byUserId" TEXT,
    "byAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestorTouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRoom" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRoomFolder" (
    "id" TEXT NOT NULL,
    "dataRoomId" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DataRoomFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRoomEntry" (
    "id" TEXT NOT NULL,
    "dataRoomId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "refNumber" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "DataRoomEntryStatus" NOT NULL DEFAULT 'CREATE',
    "documentId" TEXT,
    "notes" TEXT,
    "version" TEXT,
    "sourceCategory" "SourceCategory",
    "sourceUrl" TEXT,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "humanDependencyOwnerId" TEXT,
    "humanDependencyStatus" "HumanDependencyStatus" NOT NULL DEFAULT 'NONE',
    "humanDependencyNote" TEXT,
    "humanDependencyUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "DataRoomEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRoomEntryFile" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataRoomEntryFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxSyncState" (
    "id" TEXT NOT NULL,
    "agentSlug" TEXT NOT NULL,
    "mailboxEmail" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "lastHistoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "entity" "SafaEntity",
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronLock" (
    "key" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "holder" TEXT NOT NULL,

    CONSTRAINT "CronLock_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "kind" "ActivityEventKind" NOT NULL,
    "severity" "ActivityEventSeverity" NOT NULL DEFAULT 'INFO',
    "actorAgentId" TEXT,
    "actorUserId" TEXT,
    "branch" "AgentBranch",
    "entityType" TEXT,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "coalesceKey" TEXT,
    "reactedAt" TIMESTAMP(3),
    "reactedByAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "userId" TEXT NOT NULL,
    "watchedBranches" "AgentBranch"[] DEFAULT ARRAY[]::"AgentBranch"[],
    "mutedAgentSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mutedKinds" "ActivityEventKind"[] DEFAULT ARRAY[]::"ActivityEventKind"[],
    "toastMinSeverity" "ActivityEventSeverity" NOT NULL DEFAULT 'INFO',
    "emailDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailDigestHourGst" INTEGER NOT NULL DEFAULT 8,
    "lastSeenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "registryNo" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" "PartnerType" NOT NULL,
    "sizeClass" "PartnerSizeClass",
    "factorySubtype" TEXT,
    "region" "Region" NOT NULL,
    "city" TEXT,
    "tier" "PartnerTier" NOT NULL DEFAULT 'REGISTERED',
    "standing" "PartnerStanding" NOT NULL DEFAULT 'GOOD',
    "foundingMember" BOOLEAN NOT NULL DEFAULT false,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "preferredLang" TEXT NOT NULL DEFAULT 'ar',
    "profileFacts" JSONB,
    "userId" TEXT,
    "inviteCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuarterlyReport" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "status" "ReportPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "confidenceScore" INTEGER,
    "validationNotes" TEXT,
    "sourceDocIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuarterlyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRecord" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "palmTreeCount" INTEGER,
    "datesProducedTons" DOUBLE PRECISION,
    "datesSoldTons" DOUBLE PRECISION,
    "varieties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "processingCapacityTons" DOUBLE PRECISION,
    "notes" TEXT,
    "resolutionId" TEXT,

    CONSTRAINT "ProductionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteRecord" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "stream" "WasteStream" NOT NULL,
    "fate" "WasteFate" NOT NULL DEFAULT 'UNKNOWN',
    "tons" DOUBLE PRECISION NOT NULL,
    "destinationRegistryNo" TEXT,
    "notes" TEXT,
    "resolutionId" TEXT,

    CONSTRAINT "WasteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuantityResolution" (
    "id" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "kgLow" DOUBLE PRECISION,
    "kgHigh" DOUBLE PRECISION,
    "kgMid" DOUBLE PRECISION,
    "count" DOUBLE PRECISION,
    "unitCode" TEXT,
    "quantityIndicative" BOOLEAN NOT NULL DEFAULT false,
    "stream" "WasteStream",
    "streamMatched" TEXT,
    "fate" "WasteFate",
    "fateMatched" TEXT,
    "variety" TEXT,
    "periodYear" INTEGER,
    "periodQuarter" INTEGER,
    "periodBasis" TEXT,
    "confidence" TEXT NOT NULL,
    "neededClarification" BOOLEAN NOT NULL DEFAULT false,
    "clarifyQuestion" TEXT,
    "source" "QuantitySource" NOT NULL DEFAULT 'CHAT_TEXT',
    "sourceMessageId" TEXT,
    "sourceDocId" TEXT,
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuantityResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialTransfer" (
    "id" TEXT NOT NULL,
    "fromPartnerId" TEXT NOT NULL,
    "toPartnerId" TEXT NOT NULL,
    "stream" "WasteStream" NOT NULL,
    "tons" DOUBLE PRECISION NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierEvent" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "fromTier" "PartnerTier",
    "toTier" "PartnerTier" NOT NULL,
    "fromStanding" "PartnerStanding",
    "toStanding" "PartnerStanding" NOT NULL,
    "reason" TEXT NOT NULL,
    "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TierEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionBaseline" (
    "region" "Region" NOT NULL,
    "nameAr" TEXT NOT NULL,
    "palmTrees" INTEGER NOT NULL,
    "dateProductionTons" INTEGER NOT NULL,
    "farmDateWasteTons" INTEGER NOT NULL,
    "palmByproductsTons" INTEGER NOT NULL,
    "frondsTons" INTEGER NOT NULL,
    "frondBaseTons" INTEGER NOT NULL,
    "fiberTons" INTEGER NOT NULL,
    "otherByproductTons" INTEGER NOT NULL,
    "dateFactories" INTEGER,
    "factoryReceiptTons" INTEGER,
    "factoryDateWasteTons" INTEGER,
    "recyclingPlants" INTEGER,

    CONSTRAINT "RegionBaseline_pkey" PRIMARY KEY ("region")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "kind" "ApplicationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentDocIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionTicket" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "stream" "WasteStream" NOT NULL,
    "estimatedTons" DOUBLE PRECISION NOT NULL,
    "region" "Region" NOT NULL,
    "city" TEXT,
    "locationNote" TEXT,
    "readyFrom" TIMESTAMP(3),
    "notes" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "claimedByPartnerId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "actualTons" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "category" "ListingCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "qtyTons" DOUBLE PRECISION,
    "askPriceAed" DOUBLE PRECISION,
    "notes" TEXT,
    "region" "Region" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingInterest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "kind" "SuggestionKind" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'NEW',
    "staffNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "kind" "AnnouncementKind" NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "rsvpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRsvp" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "attending" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectoryEntry" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "stage" "ValueChainStage" NOT NULL,
    "segment" TEXT NOT NULL,
    "alsoRoles" TEXT,
    "priority" "DirectoryPriority" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "region" "Region",
    "emirateLabel" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "ownership" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "safaRelevance" TEXT,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relationship" "RelationshipStatus" NOT NULL DEFAULT 'DIRECTORY',
    "partnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappNumber_key" ON "User"("whatsappNumber");

-- CreateIndex
CREATE INDEX "User_reportsToAgentId_idx" ON "User"("reportsToAgentId");

-- CreateIndex
CREATE INDEX "User_entity_idx" ON "User"("entity");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_ownerUserId_key" ON "Agent"("ownerUserId");

-- CreateIndex
CREATE INDEX "Agent_branch_idx" ON "Agent"("branch");

-- CreateIndex
CREATE INDEX "Agent_tier_idx" ON "Agent"("tier");

-- CreateIndex
CREATE INDEX "Agent_deployPhase_idx" ON "Agent"("deployPhase");

-- CreateIndex
CREATE INDEX "AgentRun_agentId_createdAt_idx" ON "AgentRun"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_kind_createdAt_idx" ON "AgentRun"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_createdAt_idx" ON "ApprovalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_agentId_status_idx" ON "ApprovalRequest"("agentId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requesterUserId_status_idx" ON "ApprovalRequest"("requesterUserId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_threadId_idx" ON "ApprovalRequest"("threadId");

-- CreateIndex
CREATE INDEX "WeeklyTheme_weekStart_idx" ON "WeeklyTheme"("weekStart" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyTheme_weekStart_key" ON "WeeklyTheme"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReview_decisionToken_key" ON "DocumentReview"("decisionToken");

-- CreateIndex
CREATE INDEX "DocumentReview_status_createdAt_idx" ON "DocumentReview"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentReview_documentId_idx" ON "DocumentReview"("documentId");

-- CreateIndex
CREATE INDEX "DocumentReview_requesterAgentId_status_idx" ON "DocumentReview"("requesterAgentId", "status");

-- CreateIndex
CREATE INDEX "DocumentReview_gate_status_idx" ON "DocumentReview"("gate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Phase_projectId_ordering_idx" ON "Phase"("projectId", "ordering");

-- CreateIndex
CREATE INDEX "Milestone_projectId_dueDate_idx" ON "Milestone"("projectId", "dueDate");

-- CreateIndex
CREATE INDEX "RaidEntry_projectId_status_kind_idx" ON "RaidEntry"("projectId", "status", "kind");

-- CreateIndex
CREATE INDEX "RaidEntry_reviewAt_idx" ON "RaidEntry"("reviewAt");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_assigneeUserId_idx" ON "Task"("assigneeUserId");

-- CreateIndex
CREATE INDEX "Task_ownerAgentId_idx" ON "Task"("ownerAgentId");

-- CreateIndex
CREATE INDEX "Task_lastActivityAt_idx" ON "Task"("lastActivityAt");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatThread_userId_idx" ON "ChatThread"("userId");

-- CreateIndex
CREATE INDEX "ChatThread_agentId_idx" ON "ChatThread"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_userId_agentId_key" ON "ChatThread"("userId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_externalId_key" ON "Message"("externalId");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- CreateIndex
CREATE INDEX "Document_uploaderId_idx" ON "Document"("uploaderId");

-- CreateIndex
CREATE INDEX "Document_kind_idx" ON "Document"("kind");

-- CreateIndex
CREATE INDEX "Document_ipSensitivity_idx" ON "Document"("ipSensitivity");

-- CreateIndex
CREATE INDEX "Document_entity_idx" ON "Document"("entity");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_slug_key" ON "Channel"("slug");

-- CreateIndex
CREATE INDEX "Channel_slug_idx" ON "Channel"("slug");

-- CreateIndex
CREATE INDEX "Channel_defaultResponderAgentId_idx" ON "Channel"("defaultResponderAgentId");

-- CreateIndex
CREATE INDEX "ChannelMember_userId_idx" ON "ChannelMember"("userId");

-- CreateIndex
CREATE INDEX "ChannelMessage_channelId_createdAt_idx" ON "ChannelMessage"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "Contact_kind_idx" ON "Contact"("kind");

-- CreateIndex
CREATE INDEX "Contact_recommendedByAgentId_idx" ON "Contact"("recommendedByAgentId");

-- CreateIndex
CREATE INDEX "Contact_addedByUserId_idx" ON "Contact"("addedByUserId");

-- CreateIndex
CREATE INDEX "Interaction_contactId_occurredAt_idx" ON "Interaction"("contactId", "occurredAt");

-- CreateIndex
CREATE INDEX "Interaction_recordedById_idx" ON "Interaction"("recordedById");

-- CreateIndex
CREATE INDEX "Investor_stage_idx" ON "Investor"("stage");

-- CreateIndex
CREATE INDEX "Investor_archetype_idx" ON "Investor"("archetype");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorAccessToken_token_key" ON "InvestorAccessToken"("token");

-- CreateIndex
CREATE INDEX "InvestorAccessToken_token_idx" ON "InvestorAccessToken"("token");

-- CreateIndex
CREATE INDEX "InvestorAccessToken_investorId_idx" ON "InvestorAccessToken"("investorId");

-- CreateIndex
CREATE INDEX "InvestorAccessToken_expiresAt_idx" ON "InvestorAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "InvestorContact_investorId_idx" ON "InvestorContact"("investorId");

-- CreateIndex
CREATE INDEX "InvestorTouch_investorId_occurredAt_idx" ON "InvestorTouch"("investorId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataRoom_slug_key" ON "DataRoom"("slug");

-- CreateIndex
CREATE INDEX "DataRoomFolder_dataRoomId_ordering_idx" ON "DataRoomFolder"("dataRoomId", "ordering");

-- CreateIndex
CREATE UNIQUE INDEX "DataRoomFolder_dataRoomId_parentId_slug_key" ON "DataRoomFolder"("dataRoomId", "parentId", "slug");

-- CreateIndex
CREATE INDEX "DataRoomEntry_dataRoomId_folderId_ordering_idx" ON "DataRoomEntry"("dataRoomId", "folderId", "ordering");

-- CreateIndex
CREATE INDEX "DataRoomEntry_status_idx" ON "DataRoomEntry"("status");

-- CreateIndex
CREATE INDEX "DataRoomEntry_humanDependencyOwnerId_humanDependencyStatus_idx" ON "DataRoomEntry"("humanDependencyOwnerId", "humanDependencyStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DataRoomEntry_dataRoomId_refNumber_key" ON "DataRoomEntry"("dataRoomId", "refNumber");

-- CreateIndex
CREATE INDEX "DataRoomEntryFile_entryId_ordering_idx" ON "DataRoomEntryFile"("entryId", "ordering");

-- CreateIndex
CREATE UNIQUE INDEX "DataRoomEntryFile_entryId_documentId_key" ON "DataRoomEntryFile"("entryId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "MailboxSyncState_agentSlug_key" ON "MailboxSyncState"("agentSlug");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_agentId_createdAt_idx" ON "AuditLog"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityEvent_branch_createdAt_idx" ON "ActivityEvent"("branch", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityEvent_actorAgentId_createdAt_idx" ON "ActivityEvent"("actorAgentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityEvent_severity_createdAt_idx" ON "ActivityEvent"("severity", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityEvent_kind_createdAt_idx" ON "ActivityEvent"("kind", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityEvent_reactedAt_idx" ON "ActivityEvent"("reactedAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_coalesceKey_idx" ON "ActivityEvent"("coalesceKey");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_registryNo_key" ON "Partner"("registryNo");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_inviteCode_key" ON "Partner"("inviteCode");

-- CreateIndex
CREATE INDEX "Partner_region_type_idx" ON "Partner"("region", "type");

-- CreateIndex
CREATE INDEX "Partner_tier_standing_idx" ON "Partner"("tier", "standing");

-- CreateIndex
CREATE INDEX "QuarterlyReport_year_quarter_status_idx" ON "QuarterlyReport"("year", "quarter", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterlyReport_partnerId_year_quarter_key" ON "QuarterlyReport"("partnerId", "year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRecord_reportId_key" ON "ProductionRecord"("reportId");

-- CreateIndex
CREATE INDEX "WasteRecord_reportId_idx" ON "WasteRecord"("reportId");

-- CreateIndex
CREATE INDEX "WasteRecord_stream_fate_idx" ON "WasteRecord"("stream", "fate");

-- CreateIndex
CREATE INDEX "WasteRecord_resolutionId_idx" ON "WasteRecord"("resolutionId");

-- CreateIndex
CREATE INDEX "QuantityResolution_sourceMessageId_idx" ON "QuantityResolution"("sourceMessageId");

-- CreateIndex
CREATE INDEX "QuantityResolution_sourceDocId_idx" ON "QuantityResolution"("sourceDocId");

-- CreateIndex
CREATE INDEX "MaterialTransfer_fromPartnerId_year_quarter_idx" ON "MaterialTransfer"("fromPartnerId", "year", "quarter");

-- CreateIndex
CREATE INDEX "MaterialTransfer_toPartnerId_year_quarter_idx" ON "MaterialTransfer"("toPartnerId", "year", "quarter");

-- CreateIndex
CREATE INDEX "TierEvent_partnerId_createdAt_idx" ON "TierEvent"("partnerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Application_partnerId_status_idx" ON "Application"("partnerId", "status");

-- CreateIndex
CREATE INDEX "Application_status_createdAt_idx" ON "Application"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CollectionTicket_status_region_idx" ON "CollectionTicket"("status", "region");

-- CreateIndex
CREATE INDEX "CollectionTicket_partnerId_idx" ON "CollectionTicket"("partnerId");

-- CreateIndex
CREATE INDEX "CollectionTicket_claimedByPartnerId_idx" ON "CollectionTicket"("claimedByPartnerId");

-- CreateIndex
CREATE INDEX "Listing_status_category_region_idx" ON "Listing"("status", "category", "region");

-- CreateIndex
CREATE INDEX "Listing_partnerId_idx" ON "Listing"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingInterest_listingId_partnerId_key" ON "ListingInterest"("listingId", "partnerId");

-- CreateIndex
CREATE INDEX "Suggestion_status_createdAt_idx" ON "Suggestion"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Suggestion_partnerId_idx" ON "Suggestion"("partnerId");

-- CreateIndex
CREATE INDEX "Announcement_publishedAt_idx" ON "Announcement"("publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRsvp_announcementId_partnerId_key" ON "AnnouncementRsvp"("announcementId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryEntry_partnerId_key" ON "DirectoryEntry"("partnerId");

-- CreateIndex
CREATE INDEX "DirectoryEntry_stage_priority_idx" ON "DirectoryEntry"("stage", "priority");

-- CreateIndex
CREATE INDEX "DirectoryEntry_region_stage_idx" ON "DirectoryEntry"("region", "stage");

-- CreateIndex
CREATE INDEX "DirectoryEntry_relationship_idx" ON "DirectoryEntry"("relationship");

-- CreateIndex
CREATE INDEX "DirectoryEntry_confidence_idx" ON "DirectoryEntry"("confidence");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_reportsToAgentId_fkey" FOREIGN KEY ("reportsToAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyTheme" ADD CONSTRAINT "WeeklyTheme_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReview" ADD CONSTRAINT "DocumentReview_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReview" ADD CONSTRAINT "DocumentReview_requesterAgentId_fkey" FOREIGN KEY ("requesterAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReview" ADD CONSTRAINT "DocumentReview_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReview" ADD CONSTRAINT "DocumentReview_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEntry" ADD CONSTRAINT "RaidEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEntry" ADD CONSTRAINT "RaidEntry_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEntry" ADD CONSTRAINT "RaidEntry_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEntry" ADD CONSTRAINT "RaidEntry_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEntry" ADD CONSTRAINT "RaidEntry_raisedByAgentId_fkey" FOREIGN KEY ("raisedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEntry" ADD CONSTRAINT "RaidEntry_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_authorAgentId_fkey" FOREIGN KEY ("authorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorAgentId_fkey" FOREIGN KEY ("authorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_defaultResponderAgentId_fkey" FOREIGN KEY ("defaultResponderAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAgent" ADD CONSTRAINT "ChannelAgent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAgent" ADD CONSTRAINT "ChannelAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_authorAgentId_fkey" FOREIGN KEY ("authorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_recommendedByAgentId_fkey" FOREIGN KEY ("recommendedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorAccessToken" ADD CONSTRAINT "InvestorAccessToken_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorAccessToken" ADD CONSTRAINT "InvestorAccessToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorContact" ADD CONSTRAINT "InvestorContact_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorTouch" ADD CONSTRAINT "InvestorTouch_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorTouch" ADD CONSTRAINT "InvestorTouch_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorTouch" ADD CONSTRAINT "InvestorTouch_byAgentId_fkey" FOREIGN KEY ("byAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoom" ADD CONSTRAINT "DataRoom_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomFolder" ADD CONSTRAINT "DataRoomFolder_dataRoomId_fkey" FOREIGN KEY ("dataRoomId") REFERENCES "DataRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomFolder" ADD CONSTRAINT "DataRoomFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DataRoomFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomEntry" ADD CONSTRAINT "DataRoomEntry_dataRoomId_fkey" FOREIGN KEY ("dataRoomId") REFERENCES "DataRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomEntry" ADD CONSTRAINT "DataRoomEntry_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DataRoomFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomEntry" ADD CONSTRAINT "DataRoomEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomEntry" ADD CONSTRAINT "DataRoomEntry_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomEntry" ADD CONSTRAINT "DataRoomEntry_humanDependencyOwnerId_fkey" FOREIGN KEY ("humanDependencyOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomEntryFile" ADD CONSTRAINT "DataRoomEntryFile_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DataRoomEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomEntryFile" ADD CONSTRAINT "DataRoomEntryFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomEntryFile" ADD CONSTRAINT "DataRoomEntryFile_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorAgentId_fkey" FOREIGN KEY ("actorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarterlyReport" ADD CONSTRAINT "QuarterlyReport_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRecord" ADD CONSTRAINT "ProductionRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "QuarterlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRecord" ADD CONSTRAINT "ProductionRecord_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "QuantityResolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "QuarterlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "QuantityResolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_fromPartnerId_fkey" FOREIGN KEY ("fromPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_toPartnerId_fkey" FOREIGN KEY ("toPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierEvent" ADD CONSTRAINT "TierEvent_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionTicket" ADD CONSTRAINT "CollectionTicket_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionTicket" ADD CONSTRAINT "CollectionTicket_claimedByPartnerId_fkey" FOREIGN KEY ("claimedByPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingInterest" ADD CONSTRAINT "ListingInterest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingInterest" ADD CONSTRAINT "ListingInterest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRsvp" ADD CONSTRAINT "AnnouncementRsvp_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRsvp" ADD CONSTRAINT "AnnouncementRsvp_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectoryEntry" ADD CONSTRAINT "DirectoryEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
