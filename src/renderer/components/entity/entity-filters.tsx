import React from 'react';
import { HiMagnifyingGlass, HiXMark, HiAdjustmentsHorizontal } from 'react-icons/hi2';
import Typography from '../ui/Typography';
import { useDebounce } from '../../hooks/use-debounced-value';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/select';

/**
 * Entity filter configuration
 */
export interface EntityFiltersConfig {
  search: string;
  entityType: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sessionId: string;
}

/**
 * Props for EntityFilters component
 */
export interface EntityFiltersProps {
  filters: EntityFiltersConfig;
  onFiltersChange: (filters: Partial<EntityFiltersConfig>) => void;
  entityTypes: string[];
  onClearFilters: () => void;
  totalEntities: number;
  filteredEntities: number;
  sessionIds?: string[];
}

/**
 * Entity filtering component with search, type, and date range filters
 */
export const EntityFilters: React.FC<EntityFiltersProps> = ({
  filters,
  onFiltersChange,
  entityTypes,
  onClearFilters,
  totalEntities,
  filteredEntities,
  sessionIds = [],
}) => {
  const [searchValue, setSearchValue] = React.useState(filters.search);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [dateError, setDateError] = React.useState<string | null>(null);
  
  const debouncedSearch = useDebounce(searchValue, 300);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const handleDateRangeChange = React.useCallback((field: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : null;
    const currentDateRange = filters.dateRange;
    
    const newDateRange = { ...currentDateRange };
    newDateRange[field] = date;

    if (newDateRange.start && newDateRange.end && newDateRange.start > newDateRange.end) {
      setDateError('End date must be after start date');
      return;
    }

    setDateError(null);
    onFiltersChange({ dateRange: newDateRange });
  }, [filters.dateRange, onFiltersChange]);

  const handlePresetDateRange = React.useCallback((preset: 'today' | 'week' | 'month' | '30days') => {
    const end = new Date();
    const start = new Date();

    switch (preset) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case '30days':
        start.setDate(end.getDate() - 30);
        break;
    }

    onFiltersChange({ dateRange: { start, end } });
  }, [onFiltersChange]);

  const removeBadge = React.useCallback((filterType: keyof EntityFiltersConfig) => {
    switch (filterType) {
      case 'search':
        setSearchValue('');
        onFiltersChange({ search: '' });
        break;
      case 'entityType':
        onFiltersChange({ entityType: '' });
        break;
      case 'sessionId':
        onFiltersChange({ sessionId: '' });
        break;
      case 'dateRange':
        onFiltersChange({ dateRange: { start: null, end: null } });
        break;
    }
  }, [onFiltersChange]);

  const hasActiveFilters = React.useMemo(() => {
    return (
      filters.search ||
      filters.entityType ||
      filters.sessionId ||
      filters.dateRange.start ||
      filters.dateRange.end
    );
  }, [filters]);

  const formatDateValue = React.useCallback((date: Date | null) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  }, []);

  const formatDateRange = React.useCallback((start: Date | null, end: Date | null) => {
    if (!start && !end) return '';
    
    const startStr = start ? start.toLocaleDateString() : '';
    const endStr = end ? end.toLocaleDateString() : '';
    
    if (start && end) return `${startStr} to ${endStr}`;
    if (start) return `From ${startStr}`;
    if (end) return `Until ${endStr}`;
    return '';
  }, []);

  const selectedEntityType = filters.entityType || 'all';
  const selectedSessionId = filters.sessionId || 'all';

  return (
    <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 space-y-4">
      {/* Search and basic filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#5599fe] focus:outline-none"
            aria-label="Search entities by name, ID, or transaction"
          />
          {searchValue && (
            <button
              onClick={() => {
                setSearchValue('');
                onFiltersChange({ search: '' });
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <HiXMark className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Entity type filter */}
        <div className="sm:w-48">
          <Select
            value={selectedEntityType}
            onValueChange={(value) =>
              onFiltersChange({ entityType: value === 'all' ? '' : value })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {entityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Session filter (only show if multiple sessions) */}
        {sessionIds.length > 1 && (
          <div className="sm:w-48">
            <Select
              value={selectedSessionId}
              onValueChange={(value) =>
                onFiltersChange({ sessionId: value === 'all' ? '' : value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {sessionIds.map((sessionId) => (
                  <SelectItem key={sessionId} value={sessionId}>
                    {sessionId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Advanced filters toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${
            showAdvanced || filters.dateRange.start || filters.dateRange.end
              ? 'bg-[#5599fe] text-white border-[#5599fe]'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
          aria-label="Advanced filters"
        >
          <HiAdjustmentsHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Advanced</span>
        </button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          {/* Date range filter */}
          <div className="space-y-3">
            <Typography variant="body2" className="font-medium text-gray-700 dark:text-gray-300">
              Date Range
            </Typography>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formatDateValue(filters.dateRange.start)}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5599fe] focus:outline-none"
                  aria-label="Start Date"
                />
              </div>
              
              <div className="flex-1">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formatDateValue(filters.dateRange.end)}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5599fe] focus:outline-none"
                  aria-label="End Date"
                />
              </div>
            </div>

            {dateError && (
              <Typography variant="body2" className="text-red-600 dark:text-red-400">
                {dateError}
              </Typography>
            )}

            {/* Date presets */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handlePresetDateRange('today')}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => handlePresetDateRange('week')}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => handlePresetDateRange('30days')}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => handlePresetDateRange('month')}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                This Month
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active filter badges and results */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Typography variant="body2" className="text-gray-600 dark:text-gray-300">
            Showing {filteredEntities} of {totalEntities} entities
          </Typography>
          
          {hasActiveFilters && (
            <>
              {filters.search && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#5599fe] text-white">
                  Search: {filters.search}
                  <button
                    onClick={() => removeBadge('search')}
                    className="ml-1 text-white/80 hover:text-white"
                    aria-label="Remove search filter"
                  >
                    <HiXMark className="w-3 h-3" />
                  </button>
                </span>
              )}
              
              {filters.entityType && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  Type: {filters.entityType}
                  <button
                    onClick={() => removeBadge('entityType')}
                    className="ml-1 text-green-600/80 hover:text-green-600 dark:text-green-400/80 dark:hover:text-green-400"
                    aria-label="Remove type filter"
                  >
                    <HiXMark className="w-3 h-3" />
                  </button>
                </span>
              )}
              
              {filters.sessionId && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                  Session: {filters.sessionId}
                  <button
                    onClick={() => removeBadge('sessionId')}
                    className="ml-1 text-purple-600/80 hover:text-purple-600 dark:text-purple-400/80 dark:hover:text-purple-400"
                    aria-label="Remove session filter"
                  >
                    <HiXMark className="w-3 h-3" />
                  </button>
                </span>
              )}
              
              {(filters.dateRange.start || filters.dateRange.end) && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                  Date Range: {formatDateRange(filters.dateRange.start, filters.dateRange.end)}
                  <button
                    onClick={() => removeBadge('dateRange')}
                    className="ml-1 text-orange-600/80 hover:text-orange-600 dark:text-orange-400/80 dark:hover:text-orange-400"
                    aria-label="Remove date range filter"
                  >
                    <HiXMark className="w-3 h-3" />
                  </button>
                </span>
              )}
            </>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Search suggestions */}
      {searchValue && searchValue.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-4">
          <span>Search in names</span>
          <span>Search in IDs</span>
          <span>Search in transaction IDs</span>
        </div>
      )}
    </div>
  );
};
