/**
 * Score collections stay at five. Clients can read some of them and write
 * none of them. Scores live in exactly two places: author-only `scorecards`,
 * and the single `reveals` row created when the room opens.
 *
 * `events` is a sixth collection used only for activation counts.
 * Members cannot read it. The owner report is an action.
 *
 * Anonymous sockets use the `*` role. With no entry, the DO already denies
 * them; the explicit rule makes that visible in the schema.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

const text = (name: string, required = false) =>
  ({ name, storage: 'text' as const, interpretation: 'plain' as const, required })

const json = (name: string) =>
  ({ name, storage: 'text' as const, interpretation: { kind: 'json' as const } })

const panelRead: RolePermissions = { read: 'collaborator', create: false, update: false, delete: false }
const ownRead: RolePermissions = { read: 'own', create: false, update: false, delete: false }
const noAccess: RolePermissions = { read: false, create: false, update: false, delete: false }

// admin matches member. The app owner is pinned to admin; read: true would
// let the owner see sealed scorecards.
const panelOnly = { '*': noAccess, member: panelRead, admin: panelRead }
const authorOnly = { '*': noAccess, member: ownRead, admin: ownRead }

export const candidatesSchema: CollectionSchema = {
  name: 'candidates',
  columns: [
    text('name', true),
    text('role', true),
    {
      name: 'status',
      storage: 'text',
      required: true,
      interpretation: { kind: 'select', options: ['scoring', 'revealed'] },
    },
    text('hiringManagerId', true),
    { name: 'expectedPanelSize', storage: 'number', interpretation: 'plain', required: true },
    json('panel'),
    json('panelNames'),
    text('inviteCode', true),
    json('revealRequests'),
    json('pendingPanel'),
    json('pendingNames'),
    {
      name: 'forceRevealAllowed',
      storage: 'text',
      interpretation: { kind: 'select', options: ['no', 'yes'] },
    },
    { name: 'isDemo', storage: 'number', interpretation: { kind: 'boolean' } },
    {
      name: 'allowOpenLink',
      storage: 'text',
      interpretation: { kind: 'select', options: ['no', 'yes'] },
    },
    { name: 'meetingAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'meetingMinutes', storage: 'number', interpretation: 'plain' },
    { name: 'meetingSequence', storage: 'number', interpretation: 'plain' },
  ],
  collaboratorsField: 'panel',
  permissions: panelOnly,
}

export const scorecardsSchema: CollectionSchema = {
  name: 'scorecards',
  columns: [
    text('candidateId', true),
    text('interviewerId', true),
    json('scores'),
    text('recommendation', true),
    text('strengths', true),
    text('concerns', true),
  ],
  // Set by the action from ctx.userId. Not userBound: clients cannot create
  // rows, and userBound would overwrite the interviewer id on the server write.
  ownerField: 'interviewerId',
  uniqueOn: ['candidateId', 'interviewerId'],
  permissions: authorOnly,
}

export const submissionsSchema: CollectionSchema = {
  name: 'submissions',
  columns: [text('candidateId', true), text('interviewerId', true), json('panel')],
  collaboratorsField: 'panel',
  uniqueOn: ['candidateId', 'interviewerId'],
  permissions: panelOnly,
}

export const revealsSchema: CollectionSchema = {
  name: 'reveals',
  columns: [
    text('candidateId', true),
    json('panel'),
    json('cards'),
    json('missing'),
    text('revealedBy', true),
    {
      name: 'reason',
      storage: 'text',
      interpretation: { kind: 'select', options: ['auto', 'forced'] },
    },
    // A second reveal of the same candidate id must fail closed. records.create
    // upserts, so this value is written once and never replaced.
    { name: 'seal', storage: 'text', interpretation: 'plain', immutable: true },
  ],
  collaboratorsField: 'panel',
  permissions: panelOnly,
}

export const debriefsSchema: CollectionSchema = {
  name: 'debriefs',
  columns: [
    text('candidateId', true),
    json('panel'),
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['pending', 'ready', 'failed'] },
    },
    json('stats'),
    json('summary'),
    text('model'),
    text('error'),
    { name: 'attempts', storage: 'number', interpretation: 'plain' },
  ],
  collaboratorsField: 'panel',
  permissions: panelOnly,
}

const adminRead = { '*': noAccess, member: noAccess, admin: { read: true, create: false, update: false, delete: false } }

export const eventsSchema: CollectionSchema = {
  name: 'events',
  columns: [
    {
      name: 'name',
      storage: 'text',
      required: true,
      interpretation: {
        kind: 'select',
        options: ['room_created', 'invite_created', 'invite_opened', 'invite_claimed', 'panel_joined', 'scorecard_submitted', 'room_revealed', 'debrief_viewed', 'demo_opened'],
      },
    },
    text('userId', true),
    text('candidateId', true),
    { name: 'at', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
  ],
  permissions: adminRead,
}

const managerOwn = { '*': noAccess, member: ownRead, admin: ownRead }

export const invitesSchema: CollectionSchema = {
  name: 'invites',
  columns: [
    text('candidateId', true),
    text('hiringManagerId', true),
    text('label', true),
    text('email'),
    text('tokenHash', true),
    {
      name: 'status',
      storage: 'text',
      required: true,
      interpretation: { kind: 'select', options: ['pending', 'claimed', 'revoked'] },
    },
    text('claimedBy'),
    { name: 'createdAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
    { name: 'expiresAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
  ],
  ownerField: 'hiringManagerId',
  permissions: managerOwn,
}

export const contactsSchema: CollectionSchema = {
  name: 'contacts',
  columns: [
    text('ownerId', true),
    text('label', true),
    text('email'),
    { name: 'lastUsedAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
  ],
  ownerField: 'ownerId',
  permissions: authorOnly,
}

export const blindscoreSchemas = [
  candidatesSchema,
  scorecardsSchema,
  submissionsSchema,
  revealsSchema,
  debriefsSchema,
  eventsSchema,
  invitesSchema,
  contactsSchema,
]
