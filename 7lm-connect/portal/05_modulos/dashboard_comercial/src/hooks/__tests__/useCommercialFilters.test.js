// @jest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { useCommercialFilters } from '../useCommercialFilters';

// Mock the FiltersContext to provide controlled filter values
jest.mock('../../contexts/FiltersContext', () => ({
  useFilters: () => ({
    filters: {
      dataInicial: '2023-01-01',
      dataFinal: '2023-01-31',
      comparacao: 'anterior',
      regiaoOperacao: [],
    },
    setFilters: jest.fn(),
  }),
}));

describe('useCommercialFilters hook - region filter validation', () => {
  it('includes selected region in filterQueryString', () => {
    const { result, rerender } = renderHook(() => useCommercialFilters());

    // Initially, no region selected
    expect(result.current.filterQueryString).toContain('startDate=2023-01-01');
    expect(result.current.filterQueryString).not.toContain('regiaoOperacao');

    // Update the mocked context to include a region
    jest.doMock('../../contexts/FiltersContext', () => ({
      useFilters: () => ({
        filters: {
          dataInicial: '2023-01-01',
          dataFinal: '2023-01-31',
          comparacao: 'anterior',
          regiaoOperacao: ['Aguas Lindas'],
        },
        setFilters: jest.fn(),
      }),
    }));
    // Rerender hook to pick up new mock
    rerender();
    expect(result.current.filterQueryString).toContain('regiaoOperacao=Aguas%20Lindas');
  });

  it('buildFilterParams includes region when scope is segmented', () => {
    const { result } = renderHook(() => useCommercialFilters());
    const params = result.current.buildFilterParams(undefined, undefined, { __scope: 'segmented' });
    // No region selected, should not have the param
    expect(params.toString()).not.toContain('regiaoOperacao');

    // Mock with region again
    jest.doMock('../../contexts/FiltersContext', () => ({
      useFilters: () => ({
        filters: {
          dataInicial: '2023-01-01',
          dataFinal: '2023-01-31',
          comparacao: 'anterior',
          regiaoOperacao: ['Formosa'],
        },
        setFilters: jest.fn(),
      }),
    }));
    const { result: result2 } = renderHook(() => useCommercialFilters());
    const params2 = result2.current.buildFilterParams(undefined, undefined, { __scope: 'segmented' });
    expect(params2.get('regiaoOperacao')).toBe('Formosa');
  });
});
