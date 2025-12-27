/**
 * Visual step indicator for the wizard
 * Shows progress through wizard steps with clickable navigation
 */

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WizardStep } from './types'

interface WizardStepIndicatorProps {
  steps: WizardStep[]
  currentStep: number
  completedSteps: Set<number>
  onStepClick: (stepId: number) => void
}

export function WizardStepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: WizardStepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => {
          const isCompleted = completedSteps.has(step.id)
          const isCurrent = currentStep === step.id
          const canNavigate = isCompleted || step.id < currentStep

          return (
            <li
              key={step.id}
              className={cn(
                'relative',
                stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20 flex-1' : ''
              )}
            >
              {/* Connector line */}
              {stepIdx !== steps.length - 1 && (
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      'h-0.5 w-full',
                      isCompleted ? 'bg-primary' : 'bg-gray-200'
                    )}
                  />
                </div>
              )}

              {/* Step indicator */}
              <button
                type="button"
                onClick={() => canNavigate && onStepClick(step.id)}
                disabled={!canNavigate}
                className={cn(
                  'relative flex flex-col items-center group',
                  canNavigate ? 'cursor-pointer' : 'cursor-not-allowed'
                )}
              >
                {/* Circle with number or checkmark */}
                <span
                  className={cn(
                    'h-10 w-10 flex items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted && 'bg-primary border-primary',
                    isCurrent &&
                      !isCompleted &&
                      'border-primary bg-background',
                    !isCurrent &&
                      !isCompleted &&
                      'border-gray-300 bg-background',
                    canNavigate && 'group-hover:border-primary/60'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isCurrent && 'text-primary',
                        !isCurrent && 'text-gray-500'
                      )}
                    >
                      {step.id + 1}
                    </span>
                  )}
                </span>

                {/* Step title and description */}
                <div className="mt-2 text-center">
                  <span
                    className={cn(
                      'text-sm font-medium block',
                      isCurrent && 'text-primary',
                      isCompleted && 'text-foreground',
                      !isCurrent && !isCompleted && 'text-gray-500'
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:block mt-1">
                    {step.description}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
