import { actionApplies, getAction } from '../catalog';

describe('action eligibility', () => {
  it('shows dishwasher actions only when a dishwasher is selected', () => {
    const action = getAction('dishwasher-filter-clean');
    expect(action).toBeDefined();
    expect(actionApplies(action!, { appliances: ['dishwasher'], features: [], variants: {} })).toBe(true);
    expect(actionApplies(action!, { appliances: [], features: [], variants: {} })).toBe(false);
  });

  it('defaults dishwasher filter cleaning to every month', () => {
    expect(getAction('dishwasher-filter-clean')?.trigger.defaultFrequency).toEqual({ interval: 1, unit: 'month' });
  });
});
