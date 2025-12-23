import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DataPreview as DataPreviewType, ColumnInfo } from '@/types/source'

interface DataPreviewProps {
  data: DataPreviewType
  filename?: string
  actions?: React.ReactNode
}

export function DataPreview({ data, filename, actions }: DataPreviewProps) {
  const getDataTypeColor = (dataType: string) => {
    switch (dataType) {
      case 'number':
        return 'text-blue-600 dark:text-blue-400'
      case 'date':
        return 'text-purple-600 dark:text-purple-400'
      case 'boolean':
        return 'text-green-600 dark:text-green-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getDataTypeBadge = (dataType: string) => {
    const colors = {
      number: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      date: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      boolean: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      text: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    }

    return colors[dataType as keyof typeof colors] || colors.text
  }

  return (
    <Card>
      <CardHeader>
        {/* Action buttons at top */}
        {actions && <div className="mb-4">{actions}</div>}

        <CardTitle>Data Preview</CardTitle>
        <CardDescription>
          {filename && <span className="font-medium">{filename}</span>}
          {' '}Showing {data.preview_rows} of {data.total_rows.toLocaleString()} rows
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Column Statistics */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3">Column Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.columns.map((col) => (
              <div
                key={col.name}
                className="p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-sm truncate flex-1">
                    {col.name}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${getDataTypeBadge(
                      col.data_type
                    )}`}
                  >
                    {col.data_type}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Unique: {col.unique_count?.toLocaleString() ?? 'N/A'}</div>
                  {col.null_count > 0 && (
                    <div>Nulls: {col.null_count.toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground w-12">
                    #
                  </th>
                  {data.columns.map((col) => (
                    <th
                      key={col.name}
                      className="px-4 py-3 text-left font-medium"
                    >
                      <div className="space-y-1">
                        <div className="truncate">{col.name}</div>
                        <div
                          className={`text-xs ${getDataTypeColor(
                            col.data_type
                          )}`}
                        >
                          {col.data_type}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {idx + 1}
                    </td>
                    {data.columns.map((col) => (
                      <td key={col.name} className="px-4 py-3">
                        {row[col.name] === null || row[col.name] === undefined ? (
                          <span className="text-muted-foreground italic text-xs">
                            null
                          </span>
                        ) : (
                          <span className="break-words">
                            {String(row[col.name])}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
