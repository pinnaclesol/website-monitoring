import { hasPermission } from './index';

describe('hasPermission', () => {
  it('returns true when the permission is present in the effective list', () => {
    expect(hasPermission(['monitors:view', 'incidents:view'], 'monitors:view')).toBe(true);
  });

  it('returns false when the permission is absent', () => {
    expect(hasPermission(['monitors:view'], 'users:delete')).toBe(false);
  });

  it('returns false for an empty permission list', () => {
    expect(hasPermission([], 'monitors:view')).toBe(false);
  });

  it('does not do prefix/partial matching', () => {
    expect(hasPermission(['monitors:view'], 'monitors:viewx' as never)).toBe(false);
  });
});
