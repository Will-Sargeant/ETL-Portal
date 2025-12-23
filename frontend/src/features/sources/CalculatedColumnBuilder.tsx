import { useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ColumnMappingConfig } from '@/types/source'

interface CalculatedColumnBuilderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (column: ColumnMappingConfig) => void
  existingColumnNames: string[]
  nextColumnOrder: number
}

const SQL_TYPES = [
  'TEXT',
  'VARCHAR(255)',
  'INTEGER',
  'BIGINT',
  'NUMERIC',
  'DECIMAL(18,2)',
  'TIMESTAMP',
  'DATE',
  'BOOLEAN',
  'JSON',
]

const COMMON_EXPRESSIONS = [
  { label: 'Price × Quantity', value: 'price * quantity' },
  { label: 'Full Name', value: "CONCAT(first_name, ' ', last_name)" },
  { label: 'Current Timestamp', value: 'CURRENT_TIMESTAMP' },
  { label: 'Current Date', value: 'CURRENT_DATE' },
  { label: 'Year from Date', value: 'EXTRACT(YEAR FROM date_column)' },
  { label: 'Upper Case', value: 'UPPER(column_name)' },
]

const COMMON_CONSTANTS = [
  { label: 'Country (USA)', value: "'USA'" },
  { label: 'Status (Active)', value: "'active'" },
  { label: 'Default Value (0)', value: '0' },
  { label: 'Default Value (NULL)', value: 'NULL' },
  { label: 'Current Timestamp', value: 'CURRENT_TIMESTAMP' },
  { label: 'Boolean (True)', value: 'TRUE' },
  { label: 'Boolean (False)', value: 'FALSE' },
]

export function CalculatedColumnBuilder({
  open,
  onOpenChange,
  onAdd,
  existingColumnNames,
  nextColumnOrder,
}: CalculatedColumnBuilderProps) {
  const [mode, setMode] = useState<'expression' | 'constant'>('expression')
  const [columnName, setColumnName] = useState('')
  const [expression, setExpression] = useState('')
  const [constantValue, setConstantValue] = useState('')
  const [dataType, setDataType] = useState('TEXT')
  const [isNullable, setIsNullable] = useState(true)
  const [error, setError] = useState('')

  const handleReset = () => {
    setColumnName('')
    setExpression('')
    setConstantValue('')
    setDataType('TEXT')
    setIsNullable(true)
    setError('')
    setMode('expression')
  }

  const validateAndAdd = () => {
    setError('')

    // Validate column name
    if (!columnName.trim()) {
      setError('Column name is required')
      return
    }

    // Check for duplicate names
    if (existingColumnNames.includes(columnName.trim())) {
      setError('Column name already exists')
      return
    }

    // Validate column name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName.trim())) {
      setError('Column name must start with a letter or underscore and contain only alphanumeric characters and underscores')
      return
    }

    // Validate expression/constant
    const value = mode === 'expression' ? expression.trim() : constantValue.trim()
    if (!value) {
      setError(mode === 'expression' ? 'Expression is required' : 'Constant value is required')
      return
    }

    // Basic validation for expressions
    if (mode === 'expression') {
      // Check for balanced parentheses
      const openCount = (expression.match(/\(/g) || []).length
      const closeCount = (expression.match(/\)/g) || []).length
      if (openCount !== closeCount) {
        setError('Unbalanced parentheses in expression')
        return
      }

      // Check for dangerous patterns
      if (/;|\bDROP\b|\bDELETE\b|\bUPDATE\b|\bINSERT\b/i.test(expression)) {
        setError('Expression contains invalid SQL keywords')
        return
      }
    }

    // Create the calculated column mapping
    const newColumn: ColumnMappingConfig = {
      sourceColumn: `_calc_${columnName}`,
      destinationColumn: columnName.trim(),
      sourceType: dataType,
      destinationType: dataType,
      transformation: undefined,
      isNullable,
      defaultValue: undefined,
      exclude: false,
      isCalculated: true,
      expression: mode === 'expression' ? expression.trim() : constantValue.trim(),
      columnOrder: nextColumnOrder,
    }

    onAdd(newColumn)
    handleReset()
    onOpenChange(false)
  }

  const handleCancel = () => {
    handleReset()
    onOpenChange(false)
  }

  const handleExpressionSelect = (value: string) => {
    setExpression(value)
  }

  const handleConstantSelect = (value: string) => {
    setConstantValue(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Calculated Column</DialogTitle>
          <DialogDescription>
            Create a new column with a SQL expression or constant value
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Selection */}
          <div className="space-y-2">
            <Label>Column Type</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'expression' | 'constant')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="expression" id="expression" />
                <Label htmlFor="expression" className="font-normal cursor-pointer">
                  SQL Expression (e.g., price * quantity, CONCAT(...))
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="constant" id="constant" />
                <Label htmlFor="constant" className="font-normal cursor-pointer">
                  Constant Value (e.g., 'USA', 0, CURRENT_TIMESTAMP)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Column Name */}
          <div className="space-y-2">
            <Label htmlFor="column_name">Column Name *</Label>
            <Input
              id="column_name"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              placeholder="total_price"
            />
            <p className="text-xs text-muted-foreground">
              Must start with a letter or underscore
            </p>
          </div>

          {/* Expression Mode */}
          {mode === 'expression' && (
            <div className="space-y-2">
              <Label htmlFor="expression">SQL Expression *</Label>
              <Textarea
                id="expression"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="price * quantity"
                rows={3}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Reference other columns by name (e.g., column_name, price, quantity)
              </p>

              {/* Common Expressions */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Common Expressions</Label>
                <Select onValueChange={handleExpressionSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_EXPRESSIONS.map((expr) => (
                      <SelectItem key={expr.value} value={expr.value}>
                        {expr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Constant Mode */}
          {mode === 'constant' && (
            <div className="space-y-2">
              <Label htmlFor="constant">Constant Value *</Label>
              <Input
                id="constant"
                value={constantValue}
                onChange={(e) => setConstantValue(e.target.value)}
                placeholder="'USA'"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                String values must be quoted (e.g., 'USA'). Numbers and keywords don't need quotes.
              </p>

              {/* Common Constants */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Common Constants</Label>
                <Select onValueChange={handleConstantSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_CONSTANTS.map((constant) => (
                      <SelectItem key={constant.value} value={constant.value}>
                        {constant.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Data Type */}
          <div className="space-y-2">
            <Label htmlFor="data_type">Data Type *</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SQL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nullable */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="nullable"
              checked={isNullable}
              onCheckedChange={(checked) => setIsNullable(checked === true)}
            />
            <Label htmlFor="nullable" className="font-normal cursor-pointer">
              Allow NULL values
            </Label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={validateAndAdd}>
            Add Column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
