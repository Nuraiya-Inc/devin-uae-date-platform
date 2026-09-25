/**
 * Display labels for the value-chain directory enums — shared by the
 * staff directory pages (/directory, /directory/[id]).
 */

import { ValueChainStage, DirectoryPriority, ConfidenceLevel, RelationshipStatus, Region } from '@prisma/client';

export const STAGE_LABELS: Record<ValueChainStage, string> = {
  GROWERS_FARMS: 'Growers & Farms',
  PROCESSORS_MANUFACTURERS: 'Processors & Manufacturers',
  WASTE_COLLECTION: 'Waste Collection & By-products',
  TRADERS_IMPORT_EXPORT: 'Traders, Importers & Exporters',
  BUYERS_END_USERS: 'Buyers & End-users',
  ECOSYSTEM: 'Ecosystem',
};

export const PRIORITY_LABELS: Record<DirectoryPriority, string> = {
  PRIORITY_1: 'P1 — key',
  PRIORITY_2: 'P2 — standard',
  PRIORITY_3: 'P3 — verify',
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  DIRECTORY: 'Directory',
  CONTACTED: 'Contacted',
  ENGAGED: 'Engaged',
  ONBOARDING: 'Onboarding',
  REGISTERED: 'Registered',
  DECLINED: 'Declined',
};

export const REGION_LABELS: Record<Region, string> = {
  ABU_DHABI: 'Abu Dhabi',
  DUBAI: 'Dubai',
  SHARJAH: 'Sharjah',
  AJMAN: 'Ajman',
  UMM_AL_QUWAIN: 'Umm Al Quwain',
  RAS_AL_KHAIMAH: 'Ras Al Khaimah',
  FUJAIRAH: 'Fujairah',
};

export const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-mint-100 text-mint-700 border-mint-300',
  MEDIUM: 'bg-brand-50 text-brand-600 border-brand-200',
  LOW: 'bg-mist text-muted border-line',
};

export const RELATIONSHIP_STYLES: Record<RelationshipStatus, string> = {
  DIRECTORY: 'bg-mist text-muted border-line',
  CONTACTED: 'bg-brand-50 text-brand-600 border-brand-200',
  ENGAGED: 'bg-mint-100 text-mint-700 border-mint-300',
  ONBOARDING: 'bg-amber-400/15 text-gold-700 border-amber-400/30',
  REGISTERED: 'bg-mint-100 text-mint-700 border-mint-300',
  DECLINED: 'bg-mist text-muted border-line',
};
