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
    <nav aria-label="Progress" className="px-4 py-6">
      <ol role="list" className="flex items-start gap-0">
        {steps.map((step, stepIdx) => {
          const isCompleted = completedSteps.has(step.id)
          const isCurrent = currentStep === step.id
          const canNavigate = isCompleted || step.id < currentStep

          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center',
                stepIdx === 0 ? 'flex-[0_0_auto]' : 'flex-1'
              )}
            >
              {/* Connector line before step (except first) */}
              {stepIdx !== 0 && (
                <div
                  className="flex-1 h-0.5 mx-2"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      'h-full w-full transition-colors',
                      completedSteps.has(steps[stepIdx - 1].id) ? 'bg-primary' : 'bg-muted-foreground/20'
                    )}
                  />
                </div>
              )}

              {/* Step indicator button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => canNavigate && onStepClick(step.id)}
                  disabled={!canNavigate}
                  className={cn(
                    'flex flex-col items-center group transition-all',
                    canNavigate ? 'cursor-pointer' : 'cursor-not-allowed'
                  )}
                >
                  {/* Circle with number or checkmark */}
                  <span
                    className={cn(
                      'h-12 w-12 flex items-center justify-center rounded-full border-2 transition-all shadow-sm',
                      isCompleted && 'bg-primary border-primary shadow-md',
                      isCurrent && !isCompleted && 'border-primary bg-primary/10 ring-4 ring-primary/20',
                      !isCurrent && !isCompleted && 'border-muted-foreground/30 bg-background',
                      canNavigate && 'group-hover:border-primary/80 group-hover:shadow-md'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-6 w-6 text-white" />
                    ) : (
                      <span
                        className={cn(
                          'text-base font-semibold',
                          isCurrent && 'text-primary',
                          !isCurrent && 'text-muted-foreground'
                        )}
                      >
                        {step.id + 1}
                      </span>
                    )}
                  </span>

                  {/* Step title and description */}
                  <div className="mt-3 text-center max-w-[140px]">
                    <span
                      className={cn(
                        'text-sm font-medium block leading-tight',
                        isCurrent && 'text-primary',
                        isCompleted && 'text-foreground',
                        !isCurrent && !isCompleted && 'text-muted-foreground'
                      )}
                    >
                      {step.title}
                    </span>
                    <span className="text-xs text-muted-foreground hidden md:block mt-1 leading-tight">
                      {step.description}
                    </span>
                  </div>
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
