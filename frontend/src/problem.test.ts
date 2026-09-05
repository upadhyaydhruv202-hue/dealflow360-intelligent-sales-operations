import { describe, expect, it } from 'vitest';

import { problemNav, problemRoutes } from './problem';

describe('problem frontend registration', () => {
  it('exports nav and routes from the DealFlow360 module', () => {
    expect(problemNav).toEqual(
      expect.arrayContaining([
        { to: '/dealflow', label: 'Dashboard', end: true },
        { to: '/dealflow/quotes', label: 'Quotations' },
        { to: '/dealflow/approvals', label: 'Approvals' },
      ]),
    );
    expect(problemRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining(['/dealflow', '/dealflow/quotes', '/dealflow/quotes/:quoteId', '/dealflow/approvals']),
    );
    expect(problemRoutes[0]?.element).toBeTruthy();
  });
});
