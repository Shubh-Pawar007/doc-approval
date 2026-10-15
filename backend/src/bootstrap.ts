import type { AppDependencies } from './app';
import { InMemoryDocumentRepository } from './repositories/inMemoryDocumentRepository';
import { InMemoryUserRepository } from './repositories/userRepository';

export function createInMemoryDependencies(): AppDependencies {
  return {
    users: new InMemoryUserRepository(),
    documents: new InMemoryDocumentRepository(),
  };
}

/** A few documents in each state so the demo is not empty on first load. */
export async function seedDemoData({ documents }: AppDependencies): Promise<void> {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

  const policy = await documents.create({
    title: 'Remote work policy v2',
    content: 'Employees may work remotely up to three days a week with manager approval.',
    file: null,
    submitterId: 'u-alice',
    createdAt: minutesAgo(180),
  });
  await documents.applyDecision(policy.id, {
    from: 'pending',
    to: 'approved',
    reviewerId: 'u-rita',
    decision: 'approved',
    reason: 'Looks good. Matches what legal signed off.',
    decidedAt: minutesAgo(150),
  });

  const budget = await documents.create({
    title: 'Q4 marketing budget',
    content: 'Requesting ₹12L for the festive campaign across three channels.',
    file: null,
    submitterId: 'u-bob',
    createdAt: minutesAgo(120),
  });
  await documents.applyDecision(budget.id, {
    from: 'pending',
    to: 'rejected',
    reviewerId: 'u-raj',
    decision: 'rejected',
    reason: 'Missing a channel-wise breakdown. Please add expected ROI per channel.',
    decidedAt: minutesAgo(90),
  });

  await documents.create({
    title: 'Vendor onboarding checklist',
    content: 'Steps for onboarding a new vendor: KYC, contract, PO setup, payment terms.',
    file: null,
    submitterId: 'u-alice',
    createdAt: minutesAgo(30),
  });
  await documents.create({
    title: 'Laptop refresh request',
    content: 'Six engineering laptops are past their four-year refresh window.',
    file: null,
    submitterId: 'u-bob',
    createdAt: minutesAgo(10),
  });
}
