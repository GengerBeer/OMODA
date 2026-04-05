import React from 'react';
import { SessionStatus } from '@/types/api';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionStepperProps {
  status: SessionStatus;
  hasSelectedVariant: boolean;
}

const steps = [
  { key: 'upload', label: 'Upload' },
  { key: 'tryon', label: 'Try-On' },
  { key: 'select', label: 'Select Best' },
  { key: 'video', label: 'Video' },
];

export const SessionStepper: React.FC<SessionStepperProps> = ({ 
  status, 
  hasSelectedVariant 
}) => {
  const getStepState = (stepKey: string): 'completed' | 'active' | 'pending' => {
    switch (stepKey) {
      case 'upload':
        return 'completed';
      case 'tryon':
        if (status === 'processing') return 'active';
        if (['tryon_done', 'video_in_queue', 'video_done'].includes(status)) return 'completed';
        return 'pending';
      case 'select':
        if (status === 'tryon_done' && !hasSelectedVariant) return 'active';
        if (hasSelectedVariant || ['video_in_queue', 'video_done'].includes(status)) return 'completed';
        return 'pending';
      case 'video':
        if (status === 'video_in_queue') return 'active';
        if (status === 'video_done') return 'completed';
        return 'pending';
      default:
        return 'pending';
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((step, index) => {
        const state = getStepState(step.key);
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.key}>
            <div className="stepper-item">
              <div className={cn('stepper-dot', state)}>
                {state === 'completed' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span className={cn(
                'text-sm hidden sm:inline',
                state === 'pending' ? 'text-muted-foreground' : 'text-foreground font-medium'
              )}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={cn(
                'h-px w-8 sm:w-12',
                state === 'completed' || getStepState(steps[index + 1].key) !== 'pending' 
                  ? 'bg-primary' 
                  : 'bg-border'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
