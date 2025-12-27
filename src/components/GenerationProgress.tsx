interface GenerationProgressProps {
  currentStep: string;
  steps: Array<{ label: string; description?: string }>;
}

export default function GenerationProgress({ currentStep, steps }: GenerationProgressProps) {
  const currentIndex = steps.findIndex(step => step.label === currentStep);
  
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label={`Generation progress: ${currentStep}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isUpcoming = index > currentIndex;
          
          return (
            <div key={step.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-blue-500 text-white ring-4 ring-blue-500/20'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                  aria-label={isCompleted ? `${step.label} completed` : isActive ? `${step.label} in progress` : `${step.label} pending`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <p className={`text-xs mt-2 text-center ${isActive ? 'text-blue-400 font-medium' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {step.description && isActive && (
                  <p className="text-xs text-gray-500 mt-1 text-center">{step.description}</p>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 -mt-6 transition-all ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

