import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Database, Clock, Filter, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { etlJobsApi } from '@/lib/api/etl-jobs'
import type { JobStatus } from '@/types/etl-job'

interface JobsListProps {
  onViewJob?: (jobId: number) => void
}

const STATUS_COLORS: Record<JobStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  live: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  running: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  paused: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

export function JobsList({ onViewJob }: JobsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [destinationFilter, setDestinationFilter] = useState<string>('all')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)

  const { data: allJobs, isLoading } = useQuery({
    queryKey: ['etl-jobs', statusFilter],
    queryFn: () => etlJobsApi.list(
      statusFilter !== 'all' ? { status: statusFilter } : undefined
    ),
  })

  // Client-side filtering for source, destination types, and table
  const jobs = allJobs?.filter(job => {
    const matchesSource = sourceFilter === 'all' || job.source_type === sourceFilter
    const matchesDestination = destinationFilter === 'all' || job.destination_type === destinationFilter

    // Table filter: schema.table format
    const jobTable = job.destination_config?.schema && job.destination_config?.table
      ? `${job.destination_config.schema}.${job.destination_config.table}`
      : null
    const matchesTable = tableFilter === 'all' || jobTable === tableFilter

    return matchesSource && matchesDestination && matchesTable
  })

  // Get unique source and destination types for filter dropdowns
  const sourceTypes = Array.from(new Set(allJobs?.map(job => job.source_type) || []))
  const destinationTypes = Array.from(new Set(allJobs?.map(job => job.destination_type) || []))

  // Get unique tables (schema.table) for filter dropdown
  const allTables = Array.from(
    new Set(
      allJobs
        ?.map(job =>
          job.destination_config?.schema && job.destination_config?.table
            ? `${job.destination_config.schema}.${job.destination_config.table}`
            : null
        )
        .filter((table): table is string => table !== null) || []
    )
  ).sort()

  // Filter tables based on search query
  const filteredTables = tableSearchQuery
    ? allTables.filter(table =>
        table.toLowerCase().includes(tableSearchQuery.toLowerCase())
      )
    : allTables

  // Count active filters
  const activeFilterCount = [
    statusFilter !== 'all',
    sourceFilter !== 'all',
    destinationFilter !== 'all',
    tableFilter !== 'all',
  ].filter(Boolean).length

  const clearAllFilters = () => {
    setStatusFilter('all')
    setSourceFilter('all')
    setDestinationFilter('all')
    setTableFilter('all')
    setTableSearchQuery('')
  }

  const getSourceIcon = (type: string) => {
    return type === 'csv' ? FileText : Database
  }

  // Check if we have any jobs at all vs filtered to zero
  const hasJobs = allJobs && allJobs.length > 0
  const hasFilteredJobs = jobs && jobs.length > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>ETL Jobs</CardTitle>
            <CardDescription>Manage your data transformation jobs</CardDescription>
          </div>
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 rounded-full px-1.5 py-0.5 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Filter Jobs</h4>
                  <p className="text-xs text-muted-foreground">
                    Narrow down the list of ETL jobs
                  </p>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label htmlFor="status-filter" className="text-xs font-medium">
                    Status
                  </Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Source Filter */}
                <div className="space-y-2">
                  <Label htmlFor="source-filter" className="text-xs font-medium">
                    Source Type
                  </Label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger id="source-filter">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {sourceTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Destination Filter */}
                <div className="space-y-2">
                  <Label htmlFor="destination-filter" className="text-xs font-medium">
                    Destination Type
                  </Label>
                  <Select value={destinationFilter} onValueChange={setDestinationFilter}>
                    <SelectTrigger id="destination-filter">
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Destinations</SelectItem>
                      {destinationTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Table Filter */}
                <div className="space-y-2">
                  <Label htmlFor="table-filter" className="text-xs font-medium">
                    Destination Table
                  </Label>
                  <Input
                    id="table-search"
                    placeholder="Search tables..."
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                  />
                  <Select
                    value={tableFilter}
                    onValueChange={(value) => {
                      setTableFilter(value)
                      setTableSearchQuery('') // Clear search when selecting
                    }}
                  >
                    <SelectTrigger id="table-filter">
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tables</SelectItem>
                      {filteredTables.length > 0 ? (
                        filteredTables.slice(0, 50).map(table => (
                          <SelectItem key={table} value={table}>
                            {table}
                          </SelectItem>
                        ))
                      ) : tableSearchQuery ? (
                        <div className="p-2 text-xs text-muted-foreground text-center">
                          No tables match "{tableSearchQuery}"
                        </div>
                      ) : (
                        <div className="p-2 text-xs text-muted-foreground text-center">
                          No tables available
                        </div>
                      )}
                      {filteredTables.length > 50 && (
                        <div className="p-2 text-xs text-muted-foreground text-center border-t">
                          Showing 50 of {filteredTables.length} (refine search)
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {tableSearchQuery && filteredTables.length === 0 && allTables.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      No matches. Try a different search term.
                    </p>
                  )}
                </div>

                {/* Clear Filters Button */}
                {activeFilterCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="w-full gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear All Filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Status: {statusFilter}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive"
                  onClick={() => setStatusFilter('all')}
                />
              </Badge>
            )}
            {sourceFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Source: {sourceFilter.toUpperCase()}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive"
                  onClick={() => setSourceFilter('all')}
                />
              </Badge>
            )}
            {destinationFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Destination: {destinationFilter.toUpperCase()}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive"
                  onClick={() => setDestinationFilter('all')}
                />
              </Badge>
            )}
            {tableFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Table: {tableFilter}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive"
                  onClick={() => setTableFilter('all')}
                />
              </Badge>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">Loading ETL jobs...</p>
          </div>
        ) : !hasFilteredJobs ? (
          <div className="p-12 text-center">
            <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              {hasJobs ? 'No jobs match the filters' : 'No ETL jobs yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasJobs
                ? 'Try adjusting your filters to see more jobs'
                : 'Create your first ETL job to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const SourceIcon = getSourceIcon(job.source_type)

              return (
                <div
                  key={job.id}
                  onClick={() => onViewJob && onViewJob(job.id)}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <SourceIcon className="w-8 h-8 text-primary flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{job.name}</h4>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            STATUS_COLORS[job.status]
                          }`}
                        >
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                      </div>

                      {job.description && (
                        <p className="text-sm text-muted-foreground truncate mb-1">
                          {job.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <SourceIcon className="w-3 h-3" />
                          {job.source_type.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          {job.destination_type.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {job.last_executed_at
                            ? `Last run ${formatDistanceToNow(new Date(job.last_executed_at), { addSuffix: true })}`
                            : 'Never run'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
