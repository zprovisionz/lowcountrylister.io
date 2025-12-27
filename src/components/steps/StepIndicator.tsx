import { Check } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface Step {
  id: string;
  title: string;
  shortTitle: string;
  icon: LucideIcon;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export default function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="w-full">
      <div className="hidden sm:flex items-center justify-between relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-700" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && index <= currentStep;
          const StepIcon = step.icon;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={`relative z-10 flex flex-col items-center group transition-all duration-300 ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : isCurrent
                    ? 'bg-blue-500 text-white ring-4 ring-blue-500/20 shadow-lg shadow-blue-500/30'
                    : 'bg-gray-800 text-gray-500 border-2 border-gray-700'
                } ${isClickable && !isCurrent ? 'group-hover:scale-110' : ''}`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`mt-2 text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'text-blue-400'
                    : isCompleted
                    ? 'text-gray-300'
                    : 'text-gray-500'
                }`}
              >
                {step.title}
              </span>
            </button>
          );
        })}
      </div>

      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-sm font-medium text-blue-400">
            {steps[currentStep].title}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            return (
              <div
                key={step.id}
                className={`w-2 h-2 rounded-full transition-all ${
                  isCompleted || isCurrent ? 'bg-blue-500' : 'bg-gray-600'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
